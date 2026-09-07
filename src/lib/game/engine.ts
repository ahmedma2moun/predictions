import { cairoDay, gameWeek, gameWeekKey } from './calendar';
import type { Challenge, GameEvent, GameMatch, GamePlayer, PlayerRecap, WeekCompetition, WeekRow } from './types';

export const REACTIONS = ['👏', '🔥', '😮'] as const;
export const CHALLENGES = [
  { key: 'sharp_eye', name: 'Three of a kind', title: 'Sharp Eye', description: 'Get three exact scores in one Cairo calendar month.', target: 3 },
  { key: 'ever_present', name: 'Full house', title: 'Ever Present', description: 'Predict every eligible match in a completed game week.', target: 1 },
  { key: 'comeback', name: 'Back in the game', title: 'Comeback Kid', description: 'After a zero-point prediction, score points on your next three predictions.', target: 3 },
  { key: 'weekly_crown', name: 'Weekly crown', title: 'Weekly Champion', description: 'Win a completed group week. Tied leaders share the crown.', target: 1 },
] as const;

export function scored(m: GameMatch) {
  return m.status === 'finished' && m.scoresProcessed && m.resultHomeScore !== null && m.resultAwayScore !== null;
}
export function exact(p: GameMatch['predictions'][number], m: GameMatch) {
  return p.homeScore === m.resultHomeScore && p.awayScore === m.resultAwayScore;
}

export function rankRows(rows: Omit<WeekRow, 'rank'>[]): WeekRow[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.exact - a.exact || a.name.localeCompare(b.name) || a.userId - b.userId);
  let rank = 1;
  return sorted.map((row, index) => {
    if (index && (row.points !== sorted[index - 1].points || row.exact !== sorted[index - 1].exact)) rank = index + 1;
    return { ...row, rank };
  });
}

export function buildWeeks(matches: GameMatch[], players: GamePlayer[], now: Date, includeCurrent = true): WeekCompetition[] {
  const buckets = new Map<string, GameMatch[]>();
  for (const match of matches) {
    if (match.status === 'cancelled') continue;
    const key = gameWeekKey(match.kickoffTime);
    buckets.set(key, [...(buckets.get(key) ?? []), match]);
  }
  const current = gameWeek(now);
  if (includeCurrent && !buckets.has(current.key)) buckets.set(current.key, []);
  return [...buckets].map(([key, weekMatches]) => {
    const end = gameWeek(`${key}T12:00:00Z`).to;
    const state = end > now ? 'open' : weekMatches.some(m => !scored(m)) ? 'awaiting_results' : 'complete';
    const standings = rankRows(players.map(player => {
      const mine = weekMatches.filter(scored).flatMap(m => m.predictions.filter(p => p.userId === player.id).map(p => ({ p, m })));
      return { userId: player.id, name: player.name, title: player.title, points: mine.reduce((n, { p }) => n + p.pointsAwarded, 0), exact: mine.filter(({ p, m }) => exact(p, m)).length, predicted: mine.length };
    }));
    const winnerIds = state === 'complete' && standings.some(p => p.predicted > 0) ? standings.filter(p => p.rank === 1 && p.predicted > 0).map(p => p.userId) : [];
    return { key, end: end.toISOString(), state, standings, winnerIds, matchCount: weekMatches.length } satisfies WeekCompetition;
  }).sort((a, b) => b.key.localeCompare(a.key));
}

export function buildFeed(matches: GameMatch[], players: GamePlayer[], weeks: WeekCompetition[]): GameEvent[] {
  const names = new Map(players.map(p => [p.id, p.name]));
  const events: GameEvent[] = [];
  const totals = new Map(players.map(p => [p.id, 0]));
  let leaders: number[] = [];
  // Batch simultaneous kickoffs: never invent a leader change from row order.
  const batches = new Map<string, GameMatch[]>();
  for (const match of [...matches].filter(scored).sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime) || a.id - b.id)) {
    batches.set(match.kickoffTime, [...(batches.get(match.kickoffTime) ?? []), match]);
  }
  for (const [at, batch] of batches) {
    for (const match of batch) for (const p of match.predictions) {
      if (!names.has(p.userId)) continue;
      totals.set(p.userId, (totals.get(p.userId) ?? 0) + p.pointsAwarded);
      if (exact(p, match)) events.push({ key: `exact:${match.id}:${p.userId}`, at, kind: 'exact', text: `${names.get(p.userId)} nailed ${match.homeTeamName} ${p.homeScore}–${p.awayScore} ${match.awayTeamName}.`, matchId: match.id, reactions: [] });
    }
    const max = Math.max(0, ...totals.values());
    const next = [...totals].filter(([, points]) => points === max && max > 0).map(([id]) => id).sort((a, b) => a - b);
    if (next.length && next.join(',') !== leaders.join(',')) {
      events.push({ key: `lead:${batch.map(m => m.id).join('-')}:${next.join('-')}`, at, kind: 'lead', text: `${next.map(id => names.get(id)).join(' & ')} ${next.length === 1 ? 'took' : 'share'} the prediction-points lead after this matchday.`, matchId: batch[0].id, reactions: [] });
    }
    leaders = next;
  }
  for (const week of weeks) if (week.winnerIds.length) {
    events.push({ key: `week:${week.key}:${week.winnerIds.join('-')}`, at: week.end, kind: 'weekly_win', text: `${week.winnerIds.map(id => names.get(id)).join(' & ')} won the week of ${week.key}. 🏆`, matchId: null, reactions: [] });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key)).slice(0, 50);
}

export function playerStats(userId: number, matches: GameMatch[]) {
  const mine = matches.filter(scored).sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime) || a.id - b.id).flatMap(m => m.predictions.filter(p => p.userId === userId).map(p => ({ p, m })));
  let streak = 0, longestStreak = 0, comeback = 0, recovery = 0;
  let lost = false;
  const monthlyExact = new Map<string, number>();
  for (const { p, m } of mine) {
    if (p.pointsAwarded > 0) { streak++; if (lost) recovery++; }
    else { streak = 0; recovery = 0; lost = true; }
    longestStreak = Math.max(longestStreak, streak);
    comeback = Math.max(comeback, recovery);
    if (exact(p, m)) { const month = cairoDay(m.kickoffTime).slice(0, 7); monthlyExact.set(month, (monthlyExact.get(month) ?? 0) + 1); }
  }
  const correctOutcomes = mine.filter(({ p, m }) => Math.sign(p.homeScore - p.awayScore) === Math.sign(m.resultHomeScore! - m.resultAwayScore!)).length;
  return { mine, longestStreak, comeback, monthlyExact: Math.max(0, ...monthlyExact.values()), accuracy: mine.length ? Math.round(correctOutcomes / mine.length * 100) : 0 };
}

export function buildChallenges(userId: number, matches: GameMatch[], weeks: WeekCompetition[], earned: string[]): Challenge[] {
  const stats = playerStats(userId, matches);
  const fullWeeks = weeks.filter(w => w.state === 'complete' && w.matchCount > 0 && w.standings.some(p => p.userId === userId && p.predicted === w.matchCount)).length;
  const progress: Record<string, number> = { sharp_eye: stats.monthlyExact, ever_present: fullWeeks, comeback: stats.comeback, weekly_crown: weeks.filter(w => w.winnerIds.includes(userId)).length };
  return CHALLENGES.map(c => ({ ...c, progress: Math.min(c.target, progress[c.key]), unlocked: earned.includes(c.key) || progress[c.key] >= c.target }));
}

export function buildRecap(userId: number, name: string, seasonName: string, final: boolean, matches: GameMatch[], weeks: WeekCompetition[], totals: { rank: number | null; points: number }): PlayerRecap {
  const stats = playerStats(userId, matches);
  const best = [...stats.mine].sort((a, b) => b.p.pointsAwarded - a.p.pointsAwarded || a.m.id - b.m.id)[0];
  const weeklyWins = weeks.filter(w => w.winnerIds.includes(userId)).length;
  let biggestComeback = 0;
  const ranks = [...weeks].reverse().filter(w => w.state === 'complete').flatMap(w => w.standings.filter(p => p.userId === userId && p.predicted > 0).map(p => p.rank));
  for (let i = 1; i < ranks.length; i++) biggestComeback = Math.max(biggestComeback, ranks[i - 1] - ranks[i]);
  const recap: PlayerRecap = { name, seasonName, final, rank: totals.rank, totalPoints: totals.points, predictions: stats.mine.length, exactScores: stats.mine.filter(({ p, m }) => exact(p, m)).length, accuracy: stats.accuracy, longestStreak: stats.longestStreak, weeklyWins, biggestComeback, bestPrediction: best ? { matchId: best.m.id, label: `${best.m.homeTeamName} vs ${best.m.awayTeamName}`, score: `${best.p.homeScore}–${best.p.awayScore}`, points: best.p.pointsAwarded } : null, shareText: '' };
  recap.shareText = `${name} · ${seasonName}${final ? ' — season recap' : ' — season so far'}\n${totals.points} points${totals.rank ? ` · #${totals.rank} overall` : ''}\n${recap.exactScores} exact scores · ${recap.accuracy}% correct outcomes\n${weeklyWins} group weekly crowns · best streak: ${stats.longestStreak}\nFootball Predictions ⚽`;
  return recap;
}
