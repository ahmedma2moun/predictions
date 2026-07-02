import { ChampionBonusRepository } from '@/lib/repositories/champion-bonus-repository';
import { SeasonRepository } from '@/lib/repositories/season-repository';
import { TeamLeagueRepository } from '@/lib/repositories/team-league-repository';
import { TeamRepository } from '@/lib/repositories/team-repository';
import { UserRepository } from '@/lib/repositories/user-repository';
import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { sendPushToUsers } from '@/lib/fcm';
import type { ChampionBonus, ChampionBonusTeam, League, Team } from '@prisma/client';
import {
  sendChampionBonusEnabledEmail,
  sendChampionBonusLockedEmail,
  sendChampionBonusWinEmail,
  sendChampionBonusCancelledEmail,
} from '@/lib/email';
import { logger } from '@/lib/logger';

// Exponent cap keeps 2^n inside a 32-bit signed int (2^20 = 1,048,576).
const MAX_EXPONENT = 20;
const winPoints = (gameNumber: number) => 2 ** Math.min(gameNumber, MAX_EXPONENT);

// ── Local shapes for the `include`d config variants we fetch throughout ───────
type ConfigWithTeamRows = ChampionBonus & { teams: ChampionBonusTeam[] };
type ConfigWithLeague = ChampionBonus & { league: League };
type ConfigWithTeamsAndLeague = ChampionBonus & { league: League; teams: (ChampionBonusTeam & { team: Team })[] };
type ConfigWithTeamRowsAndLeague = ChampionBonus & { league: League; teams: ChampionBonusTeam[] };

// ── Public payload shapes (ids stringified for the frontend) ──────────────────

export interface AllowedTeamDTO {
  teamId: string;
  name: string;
  logo: string | null;
}

export interface AwardTileDTO {
  matchId: string;
  gameNumber: number;
  opponentName: string;
  homeAway: 'home' | 'away';
  teamScore: number | null;
  opponentScore: number | null;
  kickoffTime: string;
  isWin: boolean;
  points: number;
}

export interface RevealTeamDTO {
  teamId: string;
  name: string;
  logo: string | null;
  awards: AwardTileDTO[];
  totalPoints: number;
  nextWinPoints: number;
}

export interface RevealPickDTO {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  teamId: string;
  teamName: string;
  teamLogo: string | null;
  totalBonus: number;
}

export type UserStateDTO =
  | { enabled: false }
  | {
      enabled: true;
      status: 'OPEN';
      league: { id: string; name: string; logo: string | null };
      allowedTeams: AllowedTeamDTO[];
      pickCount: number;
      myPick: { teamId: string } | null;
    }
  | {
      enabled: true;
      status: 'LOCKED';
      league: { id: string; name: string; logo: string | null };
      lockedAt: string;
      myPick: { teamId: string } | null;
      teams: Record<string, RevealTeamDTO>;
      picks: RevealPickDTO[];
    };

export type AdminStateDTO =
  | { enabled: false }
  | {
      enabled: true;
      status: 'OPEN' | 'LOCKED';
      league: { id: string; name: string; logo: string | null };
      lockedAt: string | null;
      allowedTeams: AllowedTeamDTO[];
      pickCount: number;
      picks: RevealPickDTO[]; // populated once LOCKED
    };

interface ServiceError { ok: false; error: string; status: number }
type SetPickResult = { ok: true; teamId: number } | ServiceError;

// ── Service ───────────────────────────────────────────────────────────────────

export const ChampionBonusService = {
  // ---- Admin lifecycle ----
  async enable(seasonId: number, leagueId: number, teamIds: number[]): Promise<AdminStateDTO> {
    const uniqueTeamIds = [...new Set(teamIds)];
    const season = await SeasonRepository.findUnique({ where: { id: seasonId } });
    if (!season) throw new Error('Season not found');
    if (season.status === 'ENDED') throw new Error('Cannot enable Champion Bonus on an ended season');

    const existing = await ChampionBonusRepository.findConfigBySeasonId(seasonId);
    if (existing) throw new Error('Champion Bonus already configured for this season — cancel it first to switch league');

    if (uniqueTeamIds.length < 2) throw new Error('Select at least 2 teams');
    await assertTeamsInLeague(leagueId, uniqueTeamIds);

    const config = await ChampionBonusRepository.createConfig({
      data: {
        seasonId,
        leagueId,
        status: 'OPEN',
        teams: { create: uniqueTeamIds.map(teamId => ({ teamId })) },
      },
      include: { league: true },
    });

    dispatchToAll(
      (email) => sendChampionBonusEnabledEmail(email, config.league.name),
      {
        title: 'Champion Bonus is live! 👑',
        body: `Pick your champion from ${config.league.name} before picks lock.`,
        data: { type: 'champion_bonus_enabled' },
      },
    );

    return this.getAdminState(seasonId);
  },

  async updateTeams(seasonId: number, teamIds: number[]): Promise<AdminStateDTO> {
    const uniqueTeamIds = [...new Set(teamIds)];
    const config = (await ChampionBonusRepository.findConfigBySeasonId(seasonId, {
      include: { teams: true },
    })) as ConfigWithTeamRows | null;
    if (!config) throw new Error('Champion Bonus not configured for this season');
    if (config.status !== 'OPEN') throw new Error('Teams can only be edited while picks are open');
    if (uniqueTeamIds.length < 2) throw new Error('Select at least 2 teams');
    await assertTeamsInLeague(config.leagueId, uniqueTeamIds);

    const keep = new Set(uniqueTeamIds);
    const removedTeamIds = config.teams
      .map(t => t.teamId)
      .filter(id => !keep.has(id));

    await ChampionBonusRepository.transaction([
      ChampionBonusRepository.deleteTeamsNotIn(config.id, uniqueTeamIds),
      ChampionBonusRepository.createTeams(config.id, uniqueTeamIds),
      ChampionBonusRepository.deletePicksForTeams(config.id, removedTeamIds),
    ]);

    return this.getAdminState(seasonId);
  },

  async lock(seasonId: number): Promise<AdminStateDTO> {
    const config = (await ChampionBonusRepository.findConfigBySeasonId(seasonId, { include: { league: true } })) as ConfigWithLeague | null;
    if (!config) throw new Error('Champion Bonus not configured for this season');
    if (config.status !== 'OPEN') throw new Error('Champion Bonus is already locked');

    await ChampionBonusRepository.updateConfig({
      where: { id: config.id },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });

    dispatchToAll(
      (email) => sendChampionBonusLockedEmail(email, config.league.name),
      {
        title: 'Champion picks are locked 🔒',
        body: 'See who everyone chose! Every game your champion plays now counts.',
        data: { type: 'champion_bonus_locked' },
      },
    );

    return this.getAdminState(seasonId);
  },

  async cancel(seasonId: number): Promise<{ enabled: false }> {
    const config = await ChampionBonusRepository.findConfigBySeasonId(seasonId);
    if (config) {
      await ChampionBonusRepository.deleteConfig(config.id);
      dispatchToAll(
        (email) => sendChampionBonusCancelledEmail(email),
        {
          title: 'Champion Bonus cancelled',
          body: 'Bonus points were removed from the leaderboard.',
          data: { type: 'champion_bonus_cancelled' },
        },
      );
    }
    return { enabled: false };
  },

  // ---- State reads ----
  async getAdminState(seasonId: number): Promise<AdminStateDTO> {
    const config = (await ChampionBonusRepository.findConfigBySeasonId(seasonId, {
      include: { league: true, teams: { include: { team: true } } },
    })) as ConfigWithTeamsAndLeague | null;
    if (!config) return { enabled: false };

    const allowedTeams: AllowedTeamDTO[] = config.teams.map(t => ({
      teamId: t.team.id.toString(),
      name: t.team.name,
      logo: t.team.logo ?? null,
    }));
    const pickCount = await ChampionBonusRepository.countPicks(config.id);

    const picks = config.status === 'LOCKED' ? (await buildReveal(config)).picks : [];

    return {
      enabled: true,
      status: config.status,
      league: { id: config.league.id.toString(), name: config.league.name, logo: config.league.logo ?? null },
      lockedAt: config.lockedAt ? config.lockedAt.toISOString() : null,
      allowedTeams,
      pickCount,
      picks,
    };
  },

  async getUserState(userId: number): Promise<UserStateDTO> {
    const season = await SeasonRepository.findFirst({ where: { status: 'ACTIVE' } });
    if (!season) return { enabled: false };

    const config = (await ChampionBonusRepository.findConfigBySeasonId(season.id, {
      include: { league: true, teams: { include: { team: true } } },
    })) as ConfigWithTeamsAndLeague | null;
    if (!config) return { enabled: false };

    const myPickRow = await ChampionBonusRepository.findMyPick(config.id, userId);
    const myPick = myPickRow ? { teamId: myPickRow.teamId.toString() } : null;
    const league = { id: config.league.id.toString(), name: config.league.name, logo: config.league.logo ?? null };

    if (config.status === 'OPEN') {
      const allowedTeams: AllowedTeamDTO[] = config.teams.map(t => ({
        teamId: t.team.id.toString(),
        name: t.team.name,
        logo: t.team.logo ?? null,
      }));
      const pickCount = await ChampionBonusRepository.countPicks(config.id);
      return { enabled: true, status: 'OPEN', league, allowedTeams, pickCount, myPick };
    }

    const { teams, picks } = await buildReveal(config);
    return {
      enabled: true,
      status: 'LOCKED',
      league,
      lockedAt: config.lockedAt!.toISOString(),
      myPick,
      teams,
      picks,
    };
  },

  // ---- User pick ----
  async setPick(userId: number, teamId: number): Promise<SetPickResult> {
    const season = await SeasonRepository.findFirst({ where: { status: 'ACTIVE' } });
    if (!season) return { ok: false, error: 'No active season', status: 400 };

    const config = (await ChampionBonusRepository.findConfigBySeasonId(season.id, { include: { teams: true } })) as ConfigWithTeamRows | null;
    if (!config) return { ok: false, error: 'Champion Bonus is not enabled', status: 400 };
    if (config.status !== 'OPEN') return { ok: false, error: 'Picks are locked', status: 409 };

    const allowed = new Set(config.teams.map(t => t.teamId));
    if (!allowed.has(teamId)) return { ok: false, error: 'Team is not selectable', status: 400 };

    await ChampionBonusRepository.upsertPick(config.id, userId, teamId);
    return { ok: true, teamId };
  },

  // ---- Scoring pipeline hooks ----
  /**
   * Called after every finished/corrected match. No-op unless a LOCKED config
   * matches the match's season + league and the match kicked off after lock.
   * Rebuilds the affected team(s)' award ledger from scratch and fires win
   * notifications for newly-created win awards only.
   */
  async processFinishedMatch(match: {
    seasonId: number | null;
    externalLeagueId: number;
    homeTeamExtId: number;
    awayTeamExtId: number;
    kickoffTime: Date;
  }): Promise<void> {
    if (match.seasonId == null) return;
    const config = (await ChampionBonusRepository.findConfigBySeasonId(match.seasonId, {
      include: { league: true, teams: { include: { team: true } } },
    })) as ConfigWithTeamsAndLeague | null;
    if (!config || config.status !== 'LOCKED' || !config.lockedAt) return;
    if (config.league.externalId !== match.externalLeagueId) return;
    if (new Date(match.kickoffTime).getTime() <= new Date(config.lockedAt).getTime()) return;

    const involved = config.teams.filter(
      t => t.team.externalId === match.homeTeamExtId || t.team.externalId === match.awayTeamExtId,
    );

    for (const t of involved) {
      const newWins = await recomputeTeamAwards(config, t.teamId);
      if (newWins.length > 0) {
        const latest = newWins[newWins.length - 1];
        await notifyBonusWin(config.id, t.teamId, t.team.name, latest.points, latest.nextWinPoints).catch(e =>
          logger.error('[champion-bonus] win notification failed:', { error: e instanceof Error ? e.message : String(e) }),
        );
      }
    }
  },

  /** Safety-net recompute for every allowed team (used by admin recalculate). */
  async recomputeSeason(seasonId: number): Promise<void> {
    const config = (await ChampionBonusRepository.findConfigBySeasonId(seasonId, {
      include: { league: true, teams: true },
    })) as ConfigWithTeamRowsAndLeague | null;
    if (!config || config.status !== 'LOCKED' || !config.lockedAt) return;
    for (const t of config.teams) {
      await recomputeTeamAwards(config, t.teamId);
    }
  },
};

// ── Internals ───────────────────────────────────────────────────────────────

async function assertTeamsInLeague(leagueId: number, teamIds: number[]): Promise<void> {
  const rows = await TeamLeagueRepository.findMany({
    where: { leagueId, teamId: { in: teamIds } },
    select: { teamId: true },
  });
  if (rows.length !== teamIds.length) {
    throw new Error('One or more selected teams do not belong to this league');
  }
}

interface NewWin { matchId: number; gameNumber: number; points: number; nextWinPoints: number }

/**
 * Rebuilds the full award ledger for one allowed team from scratch, ordered by
 * kickoff. Returns the win awards that are newly created (or newly flipped to a
 * win) since the previous ledger — used to fire win notifications exactly once.
 */
async function recomputeTeamAwards(config: { id: number; seasonId: number; lockedAt: Date | null; league?: { externalId: number } }, teamId: number): Promise<NewWin[]> {
  const team = await TeamRepository.findUnique({ where: { id: teamId }, select: { externalId: true } });
  if (!team || config.lockedAt == null) return [];

  const externalLeagueId = config.league?.externalId
    ?? ((await ChampionBonusRepository.findConfigById(config.id, { include: { league: true } })) as ConfigWithLeague | null)?.league.externalId;

  const matches = await MatchRepository.findMany({
    where: {
      status: 'finished',
      resultWinner: { not: null },
      seasonId: config.seasonId,
      externalLeagueId,
      kickoffTime: { gt: config.lockedAt },
      OR: [{ homeTeamExtId: team.externalId }, { awayTeamExtId: team.externalId }],
    },
    orderBy: [{ kickoffTime: 'asc' }, { id: 'asc' }],
    select: { id: true, homeTeamExtId: true, awayTeamExtId: true, resultWinner: true },
  });

  const priorAwards = await ChampionBonusRepository.findAwards({
    where: { championBonusId: config.id, teamId },
    select: { matchId: true, isWin: true },
  });
  const priorWin = new Map(priorAwards.map(a => [a.matchId, a.isWin]));

  const rows = matches.map((m, i) => {
    const gameNumber = i + 1;
    const isWin =
      (m.resultWinner === 'home' && m.homeTeamExtId === team.externalId) ||
      (m.resultWinner === 'away' && m.awayTeamExtId === team.externalId);
    return {
      championBonusId: config.id,
      teamId,
      matchId: m.id,
      gameNumber,
      isWin,
      points: isWin ? winPoints(gameNumber) : 0,
    };
  });

  await ChampionBonusRepository.transaction([
    ChampionBonusRepository.deleteAwardsForTeam(config.id, teamId),
    ChampionBonusRepository.createAwards(rows),
  ]);

  return rows
    .filter(r => r.isWin && priorWin.get(r.matchId) !== true)
    .map(r => ({
      matchId: r.matchId,
      gameNumber: r.gameNumber,
      points: r.points,
      nextWinPoints: winPoints(r.gameNumber + 1),
    }));
}

/** Builds the LOCKED reveal payload (per-team ledgers + per-user totals). */
async function buildReveal(config: ConfigWithTeamsAndLeague): Promise<{ teams: Record<string, RevealTeamDTO>; picks: RevealPickDTO[] }> {
  const teamExtMap = new Map<number, { name: string; logo: string | null; externalId: number }>(
    config.teams.map(t => [t.team.id, { name: t.team.name, logo: t.team.logo ?? null, externalId: t.team.externalId }]),
  );

  const awards = await ChampionBonusRepository.findAwards({
    where: { championBonusId: config.id },
    include: {
      match: {
        select: {
          id: true,
          homeTeamExtId: true,
          awayTeamExtId: true,
          homeTeamName: true,
          awayTeamName: true,
          resultHomeScore: true,
          resultAwayScore: true,
          kickoffTime: true,
        },
      },
    },
    orderBy: [{ teamId: 'asc' }, { gameNumber: 'asc' }],
  });

  const teams: Record<string, RevealTeamDTO> = {};
  const teamTotals = new Map<number, number>();

  // Seed every allowed team so teams with zero games still appear.
  for (const [id, meta] of teamExtMap) {
    teams[id.toString()] = { teamId: id.toString(), name: meta.name, logo: meta.logo, awards: [], totalPoints: 0, nextWinPoints: winPoints(1) };
  }

  for (const a of awards) {
    const meta = teamExtMap.get(a.teamId);
    if (!meta) continue;
    const isHome = a.match.homeTeamExtId === meta.externalId;
    const teamScore = isHome ? a.match.resultHomeScore : a.match.resultAwayScore;
    const opponentScore = isHome ? a.match.resultAwayScore : a.match.resultHomeScore;
    const dto = teams[a.teamId.toString()];
    dto.awards.push({
      matchId: a.match.id.toString(),
      gameNumber: a.gameNumber,
      opponentName: isHome ? a.match.awayTeamName : a.match.homeTeamName,
      homeAway: isHome ? 'home' : 'away',
      teamScore,
      opponentScore,
      kickoffTime: a.match.kickoffTime.toISOString(),
      isWin: a.isWin,
      points: a.points,
    });
    dto.totalPoints += a.points;
    teamTotals.set(a.teamId, (teamTotals.get(a.teamId) ?? 0) + a.points);
  }

  // nextWinPoints = value of the next counted game's win (games played + 1).
  for (const dto of Object.values(teams)) {
    dto.nextWinPoints = winPoints(dto.awards.length + 1);
  }

  const pickRows = await ChampionBonusRepository.findPicks({
    where: { championBonusId: config.id },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      team: { select: { id: true, name: true, logo: true } },
    },
  });

  const picks: RevealPickDTO[] = pickRows
    .map(p => ({
      userId: p.user.id.toString(),
      name: p.user.name,
      avatarUrl: p.user.avatarUrl ?? null,
      teamId: p.team.id.toString(),
      teamName: p.team.name,
      teamLogo: p.team.logo ?? null,
      totalBonus: teamTotals.get(p.teamId) ?? 0,
    }))
    .sort((a, b) => b.totalBonus - a.totalBonus || (a.name ?? '').localeCompare(b.name ?? ''));

  return { teams, picks };
}

// ── Notification dispatch (fire-and-forget, never breaks the caller) ──────────

function dispatchToAll(
  emailFn: (email: string) => Promise<void>,
  push: { title: string; body: string; data?: Record<string, string> },
): void {
  (async () => {
    const users = await UserRepository.findMany({
      where: { role: { not: 'admin' } },
      select: { id: true, notificationEmail: true },
    });
    for (const u of users) {
      if (u.notificationEmail) {
        await emailFn(u.notificationEmail).catch(e =>
          logger.error(`[champion-bonus] email failed for user ${u.id}:`, { error: e instanceof Error ? e.message : String(e) }),
        );
      }
    }
    const deviceUsers = await DeviceTokenRepository.findMany({ select: { userId: true }, distinct: ['userId'] });
    await sendPushToUsers(deviceUsers.map(d => d.userId), push).catch(e =>
      logger.error('[champion-bonus] push failed:', { error: e instanceof Error ? e.message : String(e) }),
    );
  })().catch(e =>
    logger.error('[champion-bonus] notification dispatch failed:', { error: e instanceof Error ? e.message : String(e) }),
  );
}

async function notifyBonusWin(championBonusId: number, teamId: number, teamName: string, points: number, nextWinPoints: number): Promise<void> {
  const picks = await ChampionBonusRepository.findPicks({
    where: { championBonusId, teamId },
    include: { user: { select: { id: true, notificationEmail: true } } },
  });
  if (picks.length === 0) return;

  for (const p of picks) {
    if (p.user.notificationEmail) {
      await sendChampionBonusWinEmail(p.user.notificationEmail, { teamName, points, nextWinPoints }).catch(e =>
        logger.error(`[champion-bonus] win email failed for user ${p.user.id}:`, { error: e instanceof Error ? e.message : String(e) }),
      );
    }
  }
  await sendPushToUsers(picks.map(p => p.user.id), {
    title: `${teamName} won! 👑`,
    body: `You earned +${points} Champion Bonus points (next win = ${nextWinPoints}).`,
    data: { type: 'champion_bonus_win' },
  }).catch(e => logger.error('[champion-bonus] win push failed:', { error: e instanceof Error ? e.message : String(e) }));
}
