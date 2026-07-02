import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import type { APIFixture } from '@/lib/football/types';

let externalIdCounter = 1;
function nextExternalId(): number {
  return externalIdCounter++;
}

export async function seedScoringRules() {
  const rules = [
    { name: 'Correct Winner/Draw', description: 'Predicted winner matches actual winner', key: 'correct_winner', points: 2, priority: 1, isActive: true },
    { name: 'Exact Score', description: 'Both predicted scores match exactly', key: 'exact_score', points: 5, priority: 2, isActive: true },
    { name: 'Correct Score Difference', description: 'Goal difference matches', key: 'score_difference', points: 3, priority: 3, isActive: true },
    { name: 'One Team Correct Score', description: 'Either predicted score matches', key: 'one_team_score', points: 1, priority: 4, isActive: true },
  ];
  for (const rule of rules) {
    await prisma.scoringRule.upsert({ where: { key: rule.key }, create: rule, update: {} });
  }
  return prisma.scoringRule.findMany();
}

export async function seedUsers(count: number, opts?: { admin?: boolean }) {
  const users = [];
  if (opts?.admin) {
    users.push(await prisma.user.create({
      data: { name: 'Admin', email: 'admin@test.local', password: await bcrypt.hash('test', 4), role: 'admin' },
    }));
  }
  for (let i = 0; i < count; i++) {
    users.push(await prisma.user.create({
      data: { name: `User ${i + 1}`, email: `user${i + 1}@test.local`, password: await bcrypt.hash('test', 4), role: 'user' },
    }));
  }
  return users;
}

export async function seedGeneralGroup(userIds: number[]) {
  const group = await prisma.group.create({ data: { name: 'General', isDefault: true } });
  if (userIds.length) {
    await prisma.groupMember.createMany({ data: userIds.map(userId => ({ groupId: group.id, userId })) });
  }
  return group;
}

export interface SeededTeam { id: number; externalId: number; name: string }

export async function seedLeague(params: { externalId?: number; name?: string; teams: number; season?: number }) {
  const externalId = params.externalId ?? nextExternalId();
  const season = params.season ?? 2026;
  const league = await prisma.league.create({
    data: { externalId, name: params.name ?? `Test League ${externalId}`, country: 'Testland', season, isActive: true },
  });

  const teams: SeededTeam[] = [];
  for (let i = 0; i < params.teams; i++) {
    const teamExternalId = nextExternalId();
    const team = await prisma.team.create({
      data: { externalId: teamExternalId, name: `Team ${teamExternalId}` },
    });
    await prisma.teamLeague.create({
      data: { teamId: team.id, leagueId: league.id, externalLeagueId: externalId, isActive: true },
    });
    teams.push({ id: team.id, externalId: team.externalId, name: team.name });
  }

  return { league, teams };
}

export async function seedActiveSeason(name = 'Test Season') {
  return prisma.season.create({
    data: { name, status: 'ACTIVE', startDate: new Date('2026-01-01'), startedAt: new Date('2026-01-01') },
  });
}

export interface MatchSpec {
  home: SeededTeam;
  away: SeededTeam;
  kickoff: Date;
  result?: { homeScore: number; awayScore: number; penaltyHomeScore?: number; penaltyAwayScore?: number };
  status?: 'scheduled' | 'finished';
}

export async function seedMatches(league: { id: number; externalId: number }, season: { id: number } | null, specs: MatchSpec[]) {
  const matches = [];
  for (const spec of specs) {
    const scoringWinner = spec.result
      ? spec.result.homeScore > spec.result.awayScore ? 'home' : spec.result.homeScore < spec.result.awayScore ? 'away' : 'draw'
      : null;
    let resultWinner: 'home' | 'away' | 'draw' | null = scoringWinner;
    if (spec.result && scoringWinner === 'draw' && spec.result.penaltyHomeScore != null && spec.result.penaltyAwayScore != null) {
      resultWinner = spec.result.penaltyHomeScore > spec.result.penaltyAwayScore ? 'home' : 'away';
    }

    const match = await prisma.match.create({
      data: {
        externalId: nextExternalId(),
        leagueId: league.id,
        externalLeagueId: league.externalId,
        homeTeamExtId: spec.home.externalId,
        homeTeamName: spec.home.name,
        awayTeamExtId: spec.away.externalId,
        awayTeamName: spec.away.name,
        kickoffTime: spec.kickoff,
        weekStart: spec.kickoff,
        seasonId: season?.id ?? null,
        status: spec.result ? 'finished' : (spec.status ?? 'scheduled'),
        resultHomeScore: spec.result?.homeScore ?? null,
        resultAwayScore: spec.result?.awayScore ?? null,
        resultPenaltyHomeScore: spec.result?.penaltyHomeScore ?? null,
        resultPenaltyAwayScore: spec.result?.penaltyAwayScore ?? null,
        resultWinner,
        scoresProcessed: false,
      },
    });
    matches.push(match);
  }
  return matches;
}

export async function seedPredictions(userId: number, matches: { id: number }[], scores: Array<{ homeScore: number; awayScore: number }>) {
  const preds = [];
  for (let i = 0; i < matches.length; i++) {
    const s = scores[i];
    const predictedWinner = s.homeScore > s.awayScore ? 'home' : s.homeScore < s.awayScore ? 'away' : 'draw';
    preds.push(await prisma.prediction.create({
      data: { userId, matchId: matches[i].id, homeScore: s.homeScore, awayScore: s.awayScore, predictedWinner },
    }));
  }
  return preds;
}

export async function seedChampionBonus(params: {
  season: { id: number };
  league: { id: number };
  allowedTeams: SeededTeam[];
  picks?: Record<number, number>; // userId -> teamId
  locked?: Date | boolean;
}) {
  const config = await prisma.championBonus.create({
    data: {
      seasonId: params.season.id,
      leagueId: params.league.id,
      status: params.locked ? 'LOCKED' : 'OPEN',
      lockedAt: params.locked === true ? new Date() : params.locked instanceof Date ? params.locked : null,
      teams: { create: params.allowedTeams.map(t => ({ teamId: t.id })) },
    },
  });

  if (params.picks) {
    for (const [userId, teamId] of Object.entries(params.picks)) {
      await prisma.championBonusPick.create({
        data: { championBonusId: config.id, userId: Number(userId), teamId },
      });
    }
  }

  return config;
}

/** Builds an APIFixture (mock provider shape) for a finished match's DB row + result. */
export function buildFinishedFixture(params: {
  match: { externalId: number | null; externalLeagueId: number; homeTeamExtId: number; awayTeamExtId: number; homeTeamName: string; awayTeamName: string; kickoffTime: Date };
  homeScore: number;
  awayScore: number;
  penaltyHomeScore?: number;
  penaltyAwayScore?: number;
  season?: number;
}): APIFixture {
  const isPenalty = params.penaltyHomeScore != null && params.penaltyAwayScore != null;
  return {
    fixture: {
      id: params.match.externalId!,
      date: params.match.kickoffTime.toISOString(),
      status: { short: isPenalty ? 'PEN' : 'FT', long: 'Match Finished' },
    },
    league: { id: params.match.externalLeagueId, name: 'Test League', logo: '', season: params.season ?? 2026 },
    teams: {
      home: { id: params.match.homeTeamExtId, name: params.match.homeTeamName, logo: '' },
      away: { id: params.match.awayTeamExtId, name: params.match.awayTeamName, logo: '' },
    },
    goals: {
      home: isPenalty ? params.homeScore + params.penaltyHomeScore! : params.homeScore,
      away: isPenalty ? params.awayScore + params.penaltyAwayScore! : params.awayScore,
    },
    score: {
      fulltime: {
        home: isPenalty ? params.homeScore + params.penaltyHomeScore! : params.homeScore,
        away: isPenalty ? params.awayScore + params.penaltyAwayScore! : params.awayScore,
      },
      penalties: isPenalty ? { home: params.penaltyHomeScore!, away: params.penaltyAwayScore! } : null,
      duration: isPenalty ? 'PENALTY_SHOOTOUT' : 'REGULAR',
    },
  };
}
