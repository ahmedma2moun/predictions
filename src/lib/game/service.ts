import { gameWeekKey } from './calendar';
import { prisma } from '@/lib/prisma';
import { getLeaderboard } from '@/lib/services/leaderboard-service';
import { buildChallenges, buildFeed, buildRecap, buildWeeks, CHALLENGES, playerStats, REACTIONS } from './engine';
import type { GameHub, GameMatch } from './types';

export class GameError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function positiveId(value: unknown): number {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new GameError('Invalid ID');
  return id;
}

export async function getGameHub(userId: number, groupId?: number, seasonId?: number): Promise<GameHub> {
  const [user, groups, seasons] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { achievements: true } }),
    prisma.group.findMany({ where: { members: { some: { userId } } }, select: { id: true, name: true, isDefault: true, createdAt: true }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] }),
    prisma.season.findMany({ where: { status: { in: ['ACTIVE', 'ENDED'] } }, select: { id: true, name: true, status: true, startDate: true, endedAt: true }, orderBy: [{ startDate: 'desc' }, { id: 'desc' }] }),
  ]);
  if (!user) throw new GameError('Sign in again', 401);
  const group = groupId === undefined ? groups[0] : groups.find(g => g.id === groupId);
  if (groupId !== undefined && !group) throw new GameError('You are not a member of this group', 403);
  const season = seasonId === undefined ? (seasons.find(s => s.status === 'ACTIVE') ?? seasons[0]) : seasons.find(s => s.id === seasonId);
  if (seasonId !== undefined && !season) throw new GameError('Season not found', 404);
  const earned = user.achievements.map(a => a.key);
  const base: GameHub = { currentWeekKey: gameWeekKey(new Date()), userId, groups: groups.map(g => ({ id: g.id, name: g.name })), groupId: group?.id ?? null, seasons, seasonId: season?.id ?? null, players: [], weeks: [], feed: [], challenges: [], equippedTitle: user.equippedTitle, unlockedTitles: CHALLENGES.filter(c => earned.includes(c.key)).map(c => ({ key: c.key, title: c.title })), rival: null, recap: null };
  if (!season) return base;
  const members = group ? await prisma.user.findMany({ where: { role: 'user', groupMembers: { some: { groupId: group.id } } }, select: { id: true, name: true, equippedTitle: true }, orderBy: { name: 'asc' } }) : [];
  const ids = [...new Set([userId, ...members.map(m => m.id)])];
  const now = new Date();
  const rawMatches = await prisma.match.findMany({
    where: { seasonId: season.id, kickoffTime: { gte: season.startDate, ...(season.endedAt ? { lte: season.endedAt } : {}) } },
    select: { id: true, kickoffTime: true, homeTeamName: true, awayTeamName: true, status: true, scoresProcessed: true, resultHomeScore: true, resultAwayScore: true, predictions: { where: { userId: { in: ids } }, select: { userId: true, homeScore: true, awayScore: true, pointsAwarded: true } } },
    orderBy: [{ kickoffTime: 'asc' }, { id: 'asc' }],
  });
  // Never derive social events from a future result accidentally entered by an admin.
  const matches: GameMatch[] = rawMatches.map(m => ({ ...m, kickoffTime: m.kickoffTime.toISOString(), scoresProcessed: m.scoresProcessed && m.kickoffTime <= now }));
  const players = members.map(m => ({ id: m.id, name: m.name, title: m.equippedTitle }));
  const groupMatches = matches.filter(m => !group || group.isDefault || new Date(m.kickoffTime) >= group.createdAt);
  const weeks = group ? buildWeeks(groupMatches, players, now, season.status === 'ACTIVE') : [];
  const feed = group ? buildFeed(groupMatches, players, weeks) : [];
  const reactions = group && feed.length ? await prisma.activityReaction.findMany({ where: { groupId: group.id, seasonId: season.id, eventKey: { in: feed.map(e => e.key) }, user: { groupMembers: { some: { groupId: group.id } } } }, select: { eventKey: true, userId: true, emoji: true } }) : [];
  for (const event of feed) event.reactions = REACTIONS.map(emoji => ({ emoji, count: reactions.filter(r => r.eventKey === event.key && r.emoji === emoji).length, mine: reactions.some(r => r.eventKey === event.key && r.emoji === emoji && r.userId === userId) }));
  const overall = await getLeaderboard({ seasonId: season.id });
  const me = overall.find(e => e.userId === userId);
  const snapshot = season.status === 'ENDED' ? await prisma.seasonStanding.findFirst({ where: { seasonId: season.id, userId, groupId: null }, orderBy: { recordedAt: 'desc' } }) : null;
  const myRank = me ? overall.findIndex(e => e.userId === userId) + 1 : null;
  const rival = players.find(p => p.id === user.rivalId);
  let rivalry: GameHub['rival'] = null;
  if (rival) {
    const myStats = playerStats(userId, matches);
    const theirStats = playerStats(rival.id, matches);
    const theirs = new Map(theirStats.mine.map(({ p, m }) => [m.id, p.pointsAwarded]));
    const compared = myStats.mine.filter(({ m }) => theirs.has(m.id)).map(({ p, m }) => p.pointsAwarded - theirs.get(m.id)!);
    const theirPoints = overall.find(e => e.userId === rival.id)?.totalPoints ?? 0;
    rivalry = { userId: rival.id, name: rival.name, myPoints: me?.totalPoints ?? 0, theirPoints, gap: (me?.totalPoints ?? 0) - theirPoints, wins: compared.filter(n => n > 0).length, losses: compared.filter(n => n < 0).length, draws: compared.filter(n => n === 0).length, myAccuracy: myStats.accuracy, theirAccuracy: theirStats.accuracy };
  }
  return { ...base, players, weeks, feed, challenges: buildChallenges(userId, matches, weeks, earned), rival: rivalry, recap: buildRecap(userId, user.name, season.name, season.status === 'ENDED', matches, weeks, { rank: snapshot?.rank ?? myRank, points: snapshot?.totalPoints ?? me?.totalPoints ?? 0 }) };
}

export async function updateGame(userId: number, body: Record<string, unknown>) {
  const groupId = body.groupId == null ? undefined : positiveId(body.groupId);
  const seasonId = body.seasonId == null ? undefined : positiveId(body.seasonId);
  const hub = await getGameHub(userId, groupId, seasonId);
  if (body.action === 'rival') {
    const rivalId = body.rivalId === null ? null : positiveId(body.rivalId);
    if (rivalId !== null && (rivalId === userId || !hub.players.some(p => p.id === rivalId))) throw new GameError('Choose another player in your group');
    await prisma.user.update({ where: { id: userId }, data: { rivalId } });
  } else if (body.action === 'reaction') {
    if (!hub.groupId || !hub.seasonId || typeof body.eventKey !== 'string' || !hub.feed.some(e => e.key === body.eventKey)) throw new GameError('This activity is no longer available', 404);
    const where = { groupId: hub.groupId, seasonId: hub.seasonId, eventKey: body.eventKey, userId };
    if (body.emoji === null) await prisma.activityReaction.deleteMany({ where });
    else {
      if (typeof body.emoji !== 'string' || !REACTIONS.some(e => e === body.emoji)) throw new GameError('Choose a supported reaction');
      await prisma.activityReaction.upsert({ where: { groupId_seasonId_eventKey_userId: where }, create: { ...where, emoji: body.emoji }, update: { emoji: body.emoji } });
    }
  } else if (body.action === 'title') {
    if (body.key === null) await prisma.user.update({ where: { id: userId }, data: { equippedTitle: null } });
    else {
      const challenge = hub.challenges.find(c => c.key === body.key && c.unlocked) ?? hub.unlockedTitles.find(c => c.key === body.key);
      if (!challenge) throw new GameError('Complete the challenge to unlock this title');
      await prisma.$transaction([
        prisma.playerAchievement.upsert({ where: { userId_key: { userId, key: challenge.key } }, create: { userId, key: challenge.key }, update: {} }),
        prisma.user.update({ where: { id: userId }, data: { equippedTitle: challenge.title } }),
      ]);
    }
  } else throw new GameError('Unknown action');
  return getGameHub(userId, groupId, seasonId);
}
