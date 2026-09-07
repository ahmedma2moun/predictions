import '../helpers/mocks';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resetDb } from '../helpers/db';
import { seedUsers, seedGeneralGroup, seedActiveSeason, seedScoringRules } from '../fixtures/seed';
import { getGameHub, updateGame } from '@/lib/game/service';
import { saveSlip, getSlip } from '@/lib/game/slip-service';
import { upsertPrediction } from '@/lib/services/prediction-service';

beforeEach(async () => { await resetDb(); });
async function setup() {
  const users = await seedUsers(3);
  const group = await seedGeneralGroup([users[0].id, users[1].id]);
  const season = await seedActiveSeason();
  await seedScoringRules();
  return { users, group, season };
}
async function createMatch(seasonId: number, kickoffTime: Date, finished = false) {
  return prisma.match.create({ data: { seasonId, externalLeagueId: 0, homeTeamExtId: 0, awayTeamExtId: 0, homeTeamName: 'Home', awayTeamName: 'Away', kickoffTime, weekStart: kickoffTime, status: finished ? 'finished' : 'scheduled', scoresProcessed: finished, resultHomeScore: finished ? 2 : null, resultAwayScore: finished ? 1 : null, resultWinner: finished ? 'home' : null } });
}

describe('Club persistence and authorization', () => {
  it('denies reads and social mutations for a group the user does not belong to', async () => {
    const { users, group } = await setup();
    await expect(getGameHub(users[2].id, group.id)).rejects.toMatchObject({ status: 403 });
    await expect(updateGame(users[2].id, { groupId: group.id, action: 'rival', rivalId: users[0].id })).rejects.toMatchObject({ status: 403 });
  });
  it('persists a valid rival, prevents self/outside-group rivals, and allows removal', async () => {
    const { users, group } = await setup();
    const body = { groupId: group.id, action: 'rival', rivalId: users[1].id };
    expect((await updateGame(users[0].id, body)).rival?.userId).toBe(users[1].id);
    await expect(updateGame(users[0].id, { ...body, rivalId: users[0].id })).rejects.toThrow('another player');
    await expect(updateGame(users[0].id, { ...body, rivalId: users[2].id })).rejects.toThrow('another player');
    expect((await updateGame(users[0].id, { ...body, rivalId: null })).rival).toBeNull();
  });
  it('reveals only scored activity, persists one reaction per user, and supports removal', async () => {
    const { users, group, season } = await setup();
    const m = await createMatch(season.id, new Date('2026-08-20T15:00:00Z'), true);
    await prisma.prediction.create({ data: { userId: users[0].id, matchId: m.id, homeScore: 2, awayScore: 1, predictedWinner: 'home', pointsAwarded: 7 } });
    const future = await createMatch(season.id, new Date(Date.now() + 3600000));
    await upsertPrediction(users[0].id, future.id, 9, 8);
    const hub = await getGameHub(users[0].id, group.id);
    expect(hub.feed.some(e => e.matchId === future.id)).toBe(false);
    const eventKey = hub.feed.find(e => e.kind === 'exact')!.key;
    const action = { action: 'reaction', groupId: group.id, seasonId: season.id, eventKey, emoji: '🔥' };
    await updateGame(users[1].id, action); await updateGame(users[1].id, action);
    expect(await prisma.activityReaction.count()).toBe(1);
    const viewed = await getGameHub(users[0].id, group.id);
    expect(viewed.feed.find(e => e.key === eventKey)?.reactions.find(r => r.emoji === '🔥')).toEqual({ emoji: '🔥', count: 1, mine: false });
    await expect(updateGame(users[0].id, { ...action, eventKey: 'made-up' })).rejects.toMatchObject({ status: 404 });
    await updateGame(users[1].id, { ...action, emoji: null });
    expect(await prisma.activityReaction.count()).toBe(0);
  });
  it('validates achievement claims, persists titles, and never adds prediction points', async () => {
    const { users, group, season } = await setup();
    await expect(updateGame(users[0].id, { action: 'title', groupId: group.id, key: 'sharp_eye' })).rejects.toThrow('Complete');
    for (let i = 0; i < 3; i++) {
      const m = await createMatch(season.id, new Date(`2026-08-${20 + i}T15:00:00Z`), true);
      await prisma.prediction.create({ data: { userId: users[0].id, matchId: m.id, homeScore: 2, awayScore: 1, predictedWinner: 'home', pointsAwarded: 7 } });
    }
    const hub = await updateGame(users[0].id, { action: 'title', groupId: group.id, key: 'sharp_eye' });
    expect(hub.equippedTitle).toBe('Sharp Eye');
    expect(await prisma.playerAchievement.count()).toBe(1);
    expect(hub.recap?.totalPoints).toBe(21);
    expect(hub.players.find(p => p.id === users[0].id)?.title).toBe('Sharp Eye');
  });
  it('omits pre-group fixtures from weekly crowns and retains overall recap points', async () => {
    const { users, group, season } = await setup();
    await prisma.group.update({ where: { id: group.id }, data: { isDefault: false, createdAt: new Date('2026-08-25T00:00:00Z') } });
    const m = await createMatch(season.id, new Date('2026-08-20T15:00:00Z'), true);
    await prisma.prediction.create({ data: { userId: users[0].id, matchId: m.id, homeScore: 2, awayScore: 1, predictedWinner: 'home', pointsAwarded: 7 } });
    const hub = await getGameHub(users[0].id, group.id);
    expect(hub.weeks.every(w => w.matchCount === 0)).toBe(true);
    expect(hub.recap?.totalPoints).toBe(7);
  });
});

describe('Matchday slip deadline and partial success', () => {
  it('saves open matches while preserving a locked match and returns per-match outcomes', async () => {
    const { users, season } = await setup();
    const open = await createMatch(season.id, new Date(Date.now() + 3600000));
    const closed = await createMatch(season.id, new Date(Date.now() - 3600000));
    const result = await saveSlip(users[0].id, { predictions: [{ matchId: open.id, homeScore: 1, awayScore: 0 }, { matchId: closed.id, homeScore: 2, awayScore: 0 }] });
    expect(result.results.map(r => r.saved)).toEqual([true, false]);
    expect(await prisma.prediction.count()).toBe(1);
    expect((await getSlip(users[0].id)).remaining).toBe(0);
    expect((await getSlip(users[1].id)).remaining).toBe(1);
  });
  it('rejects live status even when kickoff data incorrectly says future', async () => {
    const { users, season } = await setup();
    const m = await createMatch(season.id, new Date(Date.now() + 3600000));
    await prisma.match.update({ where: { id: m.id }, data: { status: 'live' } });
    expect(await upsertPrediction(users[0].id, m.id, 1, 0)).toMatchObject({ status: 409 });
  });
  it('validates the whole batch before saving and makes retrying idempotent', async () => {
    const { users, season } = await setup();
    const m = await createMatch(season.id, new Date(Date.now() + 3600000));
    const prediction = { matchId: m.id, homeScore: 2, awayScore: 1 };
    await expect(saveSlip(users[0].id, { predictions: [prediction, { ...prediction, homeScore: 1.5 }] })).rejects.toThrow('whole numbers');
    expect(await prisma.prediction.count()).toBe(0);
    await saveSlip(users[0].id, { predictions: [prediction] });
    await saveSlip(users[0].id, { predictions: [prediction] });
    expect(await prisma.prediction.count()).toBe(1);
  });
});
