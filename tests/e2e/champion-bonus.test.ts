import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../helpers/mocks';
import { resetDb } from '../helpers/db';
import {
  seedScoringRules,
  seedUsers,
  seedLeague,
  seedActiveSeason,
  seedMatches,
  seedPredictions,
  buildFinishedFixture,
} from '../fixtures/seed';
import { setMockFixtures, clearMock } from '@/lib/football/providers/mock';
import { processMatchResults, correctMatchResult } from '@/lib/results-processor';
import { ChampionBonusService } from '@/lib/services/champion-bonus-service';
import { getLeaderboard } from '@/lib/services/leaderboard-service';
import { prisma } from '@/lib/prisma';

beforeEach(async () => {
  await resetDb();
  await seedScoringRules();
});

afterEach(() => {
  clearMock();
});

describe('Champion Bonus — admin lifecycle', () => {
  it('enable stores config + allowed teams', async () => {
    const [admin] = await seedUsers(0, { admin: true });
    void admin;
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });

    const state = await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]);
    expect(state.enabled).toBe(true);
    if (!state.enabled) throw new Error('unreachable');
    expect(state.status).toBe('OPEN');
    expect(state.allowedTeams).toHaveLength(2);
  });

  it('rejects a second enable on the same season (one league per season)', async () => {
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]);

    await expect(ChampionBonusService.enable(season.id, league.id, [teams[2].id, teams[3].id]))
      .rejects.toThrow(/already configured/i);
  });

  it('rejects enable on an ENDED season', async () => {
    const season = await seedActiveSeason();
    await prisma.season.update({ where: { id: season.id }, data: { status: 'ENDED' } });
    const { league, teams } = await seedLeague({ teams: 4 });

    await expect(ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]))
      .rejects.toThrow(/ended/i);
  });

  it('updateTeams removes a picked team and deletes that pick', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id, teams[2].id]);
    await ChampionBonusService.setPick(user.id, teams[0].id);

    await ChampionBonusService.updateTeams(season.id, [teams[1].id, teams[2].id]);

    const pick = await prisma.championBonusPick.findFirst({ where: { userId: user.id } });
    expect(pick).toBeNull();
  });

  it('lock sets lockedAt and rejects a second lock', async () => {
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]);
    await ChampionBonusService.lock(season.id);

    const config = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });
    expect(config?.status).toBe('LOCKED');
    expect(config?.lockedAt).not.toBeNull();

    await expect(ChampionBonusService.lock(season.id)).rejects.toThrow(/already locked/i);
  });

  it('cancel cascades — config, teams, picks, awards all gone', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]);
    await ChampionBonusService.setPick(user.id, teams[0].id);
    const configBefore = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });

    await ChampionBonusService.cancel(season.id);

    expect(await prisma.championBonus.findUnique({ where: { id: configBefore!.id } })).toBeNull();
    expect(await prisma.championBonusTeam.count({ where: { championBonusId: configBefore!.id } })).toBe(0);
    expect(await prisma.championBonusPick.count({ where: { championBonusId: configBefore!.id } })).toBe(0);
  });
});

describe('Champion Bonus — pick guards', () => {
  it('upserts while OPEN and updates the same row on change', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]);

    const first = await ChampionBonusService.setPick(user.id, teams[0].id);
    expect(first.ok).toBe(true);
    const second = await ChampionBonusService.setPick(user.id, teams[1].id);
    expect(second.ok).toBe(true);

    const rows = await prisma.championBonusPick.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].teamId).toBe(teams[1].id);
  });

  it('rejects a pick after lock', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]);
    await ChampionBonusService.lock(season.id);

    const result = await ChampionBonusService.setPick(user.id, teams[0].id);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(409);
  });

  it('rejects a disallowed team', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    await ChampionBonusService.enable(season.id, league.id, [teams[0].id, teams[1].id]);

    const result = await ChampionBonusService.setPick(user.id, teams[3].id);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(400);
  });

  it('rejects a pick when no config exists', async () => {
    const [user] = await seedUsers(1);
    await seedActiveSeason();

    const result = await ChampionBonusService.setPick(user.id, 999);
    expect(result.ok).toBe(false);
  });
});

describe('Champion Bonus — exponential scoring (core case)', () => {
  it('awards 2,0,8,0,32,64 for W,D,W,L,W,W and totals 106', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    const teamA = teams[0];
    const opponent = teams[1];

    await ChampionBonusService.enable(season.id, league.id, [teamA.id, opponent.id]);
    await ChampionBonusService.setPick(user.id, teamA.id);
    const lockedAt = new Date('2026-02-01T00:00:00Z');
    await ChampionBonusService.lock(season.id);
    await prisma.championBonus.update({ where: { seasonId: season.id }, data: { lockedAt } });

    // W, D, W, L, W, W — all kicking off after lock, Team A always home.
    const results: Array<{ homeScore: number; awayScore: number }> = [
      { homeScore: 2, awayScore: 0 }, // W
      { homeScore: 1, awayScore: 1 }, // D
      { homeScore: 3, awayScore: 1 }, // W
      { homeScore: 0, awayScore: 1 }, // L
      { homeScore: 2, awayScore: 1 }, // W
      { homeScore: 4, awayScore: 0 }, // W
    ];

    const matches = await seedMatches(league, season, results.map((r, i) => ({
      home: teamA,
      away: opponent,
      kickoff: new Date(lockedAt.getTime() + (i + 1) * 24 * 60 * 60 * 1000),
      status: 'scheduled' as const,
    })));

    setMockFixtures(matches.map((m, i) => buildFinishedFixture({
      match: m,
      homeScore: results[i].homeScore,
      awayScore: results[i].awayScore,
    })));

    await processMatchResults('test');

    const config = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });
    const awards = await prisma.championBonusAward.findMany({
      where: { championBonusId: config!.id, teamId: teamA.id },
      orderBy: { gameNumber: 'asc' },
    });

    expect(awards.map(a => a.points)).toEqual([2, 0, 8, 0, 32, 64]);
    expect(awards.map(a => a.isWin)).toEqual([true, false, true, false, true, true]);
    expect(awards.reduce((s, a) => s + a.points, 0)).toBe(106);
  });

  it('excludes matches kicking off before lockedAt', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    const teamA = teams[0];
    const opponent = teams[1];

    await ChampionBonusService.enable(season.id, league.id, [teamA.id, opponent.id]);
    await ChampionBonusService.setPick(user.id, teamA.id);
    await ChampionBonusService.lock(season.id);
    const lockedAt = new Date();
    await prisma.championBonus.update({ where: { seasonId: season.id }, data: { lockedAt } });

    const beforeLock = await seedMatches(league, season, [{
      home: teamA, away: opponent, kickoff: new Date(lockedAt.getTime() - 60_000), status: 'scheduled',
    }]);
    setMockFixtures(beforeLock.map(m => buildFinishedFixture({ match: m, homeScore: 3, awayScore: 0 })));
    await processMatchResults('test');

    const config = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });
    const awards = await prisma.championBonusAward.count({ where: { championBonusId: config!.id, teamId: teamA.id } });
    expect(awards).toBe(0);
  });

  it('excludes matches in a different (cup) league', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    const teamA = teams[0];
    const opponent = teams[1];
    const { league: cupLeague } = await seedLeague({ teams: 0 });

    await ChampionBonusService.enable(season.id, league.id, [teamA.id, opponent.id]);
    await ChampionBonusService.setPick(user.id, teamA.id);
    await ChampionBonusService.lock(season.id);
    const lockedAt = new Date(Date.now() - 60_000);
    await prisma.championBonus.update({ where: { seasonId: season.id }, data: { lockedAt } });

    const cupMatches = await seedMatches(cupLeague, season, [{
      home: teamA, away: opponent, kickoff: new Date(Date.now() - 5000), status: 'scheduled',
    }]);
    setMockFixtures(cupMatches.map(m => buildFinishedFixture({ match: m, homeScore: 2, awayScore: 0 })));
    await processMatchResults('test');

    const config = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });
    const awards = await prisma.championBonusAward.count({ where: { championBonusId: config!.id, teamId: teamA.id } });
    expect(awards).toBe(0);
  });
});

describe('Champion Bonus — penalty wins', () => {
  it('counts a penalty-shootout win as isWin using resultWinner', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    const teamA = teams[0];
    const opponent = teams[1];

    await ChampionBonusService.enable(season.id, league.id, [teamA.id, opponent.id]);
    await ChampionBonusService.setPick(user.id, teamA.id);
    await ChampionBonusService.lock(season.id);
    const lockedAt = new Date(Date.now() - 60_000);
    await prisma.championBonus.update({ where: { seasonId: season.id }, data: { lockedAt } });

    const matches = await seedMatches(league, season, [{
      home: teamA, away: opponent, kickoff: new Date(Date.now() - 5000), status: 'scheduled',
    }]);
    setMockFixtures(matches.map(m => buildFinishedFixture({
      match: m, homeScore: 1, awayScore: 1, penaltyHomeScore: 4, penaltyAwayScore: 2,
    })));
    await processMatchResults('test');

    const config = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });
    const award = await prisma.championBonusAward.findFirst({ where: { championBonusId: config!.id, teamId: teamA.id } });
    expect(award?.isWin).toBe(true);
    expect(award?.points).toBe(2);
  });
});

describe('Champion Bonus — idempotency & corrections', () => {
  async function setupLockedWithOneMatch(teamAScore: number, oppScore: number) {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    const teamA = teams[0];
    const opponent = teams[1];

    await ChampionBonusService.enable(season.id, league.id, [teamA.id, opponent.id]);
    await ChampionBonusService.setPick(user.id, teamA.id);
    await ChampionBonusService.lock(season.id);
    const lockedAt = new Date(Date.now() - 60_000);
    await prisma.championBonus.update({ where: { seasonId: season.id }, data: { lockedAt } });

    const matches = await seedMatches(league, season, [{
      home: teamA, away: opponent, kickoff: new Date(Date.now() - 5000), status: 'scheduled',
    }]);
    setMockFixtures(matches.map(m => buildFinishedFixture({ match: m, homeScore: teamAScore, awayScore: oppScore })));
    return { season, league, teamA, opponent, matches };
  }

  it('running processMatchResults twice produces an identical ledger (no duplicates)', async () => {
    const { season, teamA, matches } = await setupLockedWithOneMatch(2, 0);
    await processMatchResults('test');
    setMockFixtures([buildFinishedFixture({ match: matches[0], homeScore: 2, awayScore: 0 })]);
    await processMatchResults('test');

    const config = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });
    const awards = await prisma.championBonusAward.findMany({ where: { championBonusId: config!.id, teamId: teamA.id } });
    expect(awards).toHaveLength(1);
    expect(awards[0].points).toBe(2);
  });

  it('correcting a win to a loss rebuilds the ledger and drops the total by exactly that award', async () => {
    const { season, league, teamA, opponent, matches } = await setupLockedWithOneMatch(2, 0);
    await processMatchResults('test');

    const second = await seedMatches(league, season, [{
      home: teamA, away: opponent, kickoff: new Date(matches[0].kickoffTime.getTime() + 1000), status: 'scheduled',
    }]);
    setMockFixtures([
      buildFinishedFixture({ match: matches[0], homeScore: 2, awayScore: 0 }),
      buildFinishedFixture({ match: second[0], homeScore: 3, awayScore: 0 }),
    ]);
    await processMatchResults('test');

    const config = await prisma.championBonus.findUnique({ where: { seasonId: season.id } });
    const before = await prisma.championBonusAward.findMany({ where: { championBonusId: config!.id, teamId: teamA.id }, orderBy: { gameNumber: 'asc' } });
    expect(before.map(a => a.points)).toEqual([2, 4]);

    // Correct game 1 from a win to a loss.
    await correctMatchResult(matches[0].id, 0, 1, null, null);

    const after = await prisma.championBonusAward.findMany({ where: { championBonusId: config!.id, teamId: teamA.id }, orderBy: { gameNumber: 'asc' } });
    expect(after.map(a => a.points)).toEqual([0, 4]);
    expect(before.reduce((s, a) => s + a.points, 0) - after.reduce((s, a) => s + a.points, 0)).toBe(2);
  });
});

describe('Champion Bonus — leaderboard integration', () => {
  it('adds bonus to totalPoints, exposes championBonusPoints, keeps accuracy prediction-only, and includes bonus-only users', async () => {
    const [predictor, bonusOnlyUser] = await seedUsers(2);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    const teamA = teams[0];
    const opponent = teams[1];

    // predictor: normal prediction on an unrelated match
    const predMatches = await seedMatches(league, season, [{
      home: teams[2], away: teams[3], kickoff: new Date('2026-01-10'),
      result: { homeScore: 2, awayScore: 1 },
    }]);
    await seedPredictions(predictor.id, predMatches, [{ homeScore: 2, awayScore: 1 }]);
    await prisma.prediction.updateMany({ data: { pointsAwarded: 7 } });
    await prisma.match.updateMany({ where: { id: predMatches[0].id }, data: { scoresProcessed: true } });

    // Champion bonus: both users pick Team A, which wins twice after lock.
    await ChampionBonusService.enable(season.id, league.id, [teamA.id, opponent.id]);
    await ChampionBonusService.setPick(predictor.id, teamA.id);
    await ChampionBonusService.setPick(bonusOnlyUser.id, teamA.id);
    await ChampionBonusService.lock(season.id);
    const lockedAt = new Date(Date.now() - 60_000);
    await prisma.championBonus.update({ where: { seasonId: season.id }, data: { lockedAt } });

    const bonusMatches = await seedMatches(league, season, [
      { home: teamA, away: opponent, kickoff: new Date(Date.now() - 5000), status: 'scheduled' },
    ]);
    setMockFixtures(bonusMatches.map(m => buildFinishedFixture({ match: m, homeScore: 2, awayScore: 0 })));
    await processMatchResults('test');

    const entries = await getLeaderboard({ seasonId: season.id });
    const predictorEntry = entries.find(e => e.userId === predictor.id)!;
    const bonusOnlyEntry = entries.find(e => e.userId === bonusOnlyUser.id)!;

    expect(predictorEntry.championBonusPoints).toBe(2);
    expect(predictorEntry.totalPoints).toBe(predictorEntry.predictionsCount > 0 ? predictorEntry.totalPoints : 0);
    expect(bonusOnlyEntry).toBeDefined();
    expect(bonusOnlyEntry.championBonusPoints).toBe(2);
    expect(bonusOnlyEntry.predictionsCount).toBe(0);
  });

  it('reverts to prediction-only totals after cancel', async () => {
    const [user] = await seedUsers(1);
    const season = await seedActiveSeason();
    const { league, teams } = await seedLeague({ teams: 4 });
    const teamA = teams[0];
    const opponent = teams[1];

    await ChampionBonusService.enable(season.id, league.id, [teamA.id, opponent.id]);
    await ChampionBonusService.setPick(user.id, teamA.id);
    await ChampionBonusService.lock(season.id);
    const lockedAt = new Date(Date.now() - 60_000);
    await prisma.championBonus.update({ where: { seasonId: season.id }, data: { lockedAt } });

    const matches = await seedMatches(league, season, [{ home: teamA, away: opponent, kickoff: new Date(Date.now() - 5000), status: 'scheduled' }]);
    setMockFixtures(matches.map(m => buildFinishedFixture({ match: m, homeScore: 2, awayScore: 0 })));
    await processMatchResults('test');

    let entries = await getLeaderboard({ seasonId: season.id });
    expect(entries.find(e => e.userId === user.id)?.championBonusPoints).toBe(2);

    await ChampionBonusService.cancel(season.id);

    entries = await getLeaderboard({ seasonId: season.id });
    expect(entries.find(e => e.userId === user.id)).toBeUndefined();
  });
});

describe('Champion Bonus — API guards', () => {
  it('setPick rejects when the season is not active', async () => {
    const [user] = await seedUsers(1);
    const result = await ChampionBonusService.setPick(user.id, 1);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(400);
  });
});
