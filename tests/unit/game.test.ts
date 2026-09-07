import { describe, expect, it } from 'vitest';
import { cairoDayStart, gameWeek } from '@/lib/game/calendar';
import { buildChallenges, buildFeed, buildRecap, buildWeeks } from '@/lib/game/engine';
import type { GameMatch } from '@/lib/game/types';

const players = [{ id: 1, name: 'Ahmed', title: null }, { id: 2, name: 'Sara', title: null }];
function match(id: number, changes: Partial<GameMatch> = {}): GameMatch {
  return { id, homeTeamName: 'Home', awayTeamName: 'Away', kickoffTime: '2026-08-29T15:00:00.000Z', status: 'finished', scoresProcessed: true, resultHomeScore: 2, resultAwayScore: 1, predictions: [{ userId: 1, homeScore: 2, awayScore: 1, pointsAwarded: 7 }], ...changes };
}
const now = new Date('2026-09-07T12:00:00Z');

describe('Cairo game calendar', () => {
  it('starts weeks on Friday in Cairo, independent of host timezone', () => {
    const week = gameWeek('2026-09-03T22:30:00Z');
    expect(week.key).toBe('2026-09-04');
    expect(week.from.toISOString()).toBe('2026-09-03T21:00:00.000Z');
  });
  it('handles the skipped midnight at spring DST and the long autumn day', () => {
    expect(cairoDayStart('2026-04-24').toISOString()).toBe('2026-04-23T22:00:00.000Z');
    expect(cairoDayStart('2026-10-30').toISOString()).toBe('2026-10-29T22:00:00.000Z');
    expect((gameWeek('2026-10-29T12:00:00Z').to.getTime() - gameWeek('2026-10-29T12:00:00Z').from.getTime()) / 3600000).toBe(169);
  });
});

describe('Weekly competition and private activity', () => {
  it('uses prediction points, exact-score tiebreaks and shares fully tied crowns', () => {
    const m = match(1, { predictions: [{ userId: 1, homeScore: 2, awayScore: 1, pointsAwarded: 7 }, { userId: 2, homeScore: 2, awayScore: 1, pointsAwarded: 7 }] });
    const weeks = buildWeeks([m], players, now);
    expect(weeks.find(w => w.key === '2026-08-28')?.winnerIds).toEqual([1, 2]);
    m.predictions[1].homeScore = 3;
    expect(buildWeeks([m], players, now).find(w => w.key === '2026-08-28')?.winnerIds).toEqual([1]);
  });
  it('does not crown a week with pending or unscored results', () => {
    const weeks = buildWeeks([match(1), match(2, { scoresProcessed: false })], players, now);
    const week = weeks.find(w => w.key === '2026-08-28')!;
    expect(week.state).toBe('awaiting_results'); expect(week.winnerIds).toEqual([]);
  });
  it('does not treat cancelled matches as unfinished work', () => {
    const weeks = buildWeeks([match(1), match(2, { status: 'cancelled', scoresProcessed: false })], players, now);
    expect(weeks.find(w => w.key === '2026-08-28')?.winnerIds).toEqual([1]);
  });
  it('never reveals predictions from an unscored or scheduled match', () => {
    const matches = [match(1, { status: 'scheduled' }), match(2, { scoresProcessed: false })];
    expect(buildFeed(matches, players, buildWeeks(matches, players, now))).toEqual([]);
  });
  it('rebuilds corrected activities without duplicate events', () => {
    const m = match(1);
    const original = buildFeed([m], players, buildWeeks([m], players, now));
    expect(original.filter(e => e.kind === 'exact')).toHaveLength(1);
    m.resultHomeScore = 0; m.predictions[0].pointsAwarded = 0;
    expect(buildFeed([m], players, buildWeeks([m], players, now)).filter(e => e.kind === 'exact')).toHaveLength(0);
  });
  it('batches simultaneous kickoffs instead of emitting transient leader changes', () => {
    const first = match(1);
    const second = match(2, { predictions: [{ userId: 2, homeScore: 2, awayScore: 1, pointsAwarded: 7 }] });
    const feed = buildFeed([first, second], players, []);
    expect(feed.filter(e => e.kind === 'lead')).toHaveLength(1);
    expect(feed.find(e => e.kind === 'lead')?.text).toContain('Ahmed & Sara');
  });
});

describe('Cosmetic challenges and recaps', () => {
  it('keeps month boundaries and requires three wins after a zero for the comeback', () => {
    const matches = [match(1, { kickoffTime: '2026-08-31T20:00:00.000Z' }), match(2, { kickoffTime: '2026-08-31T22:00:00.000Z' }), match(3, { kickoffTime: '2026-09-01T15:00:00.000Z' })];
    expect(buildChallenges(1, matches, [], []).find(c => c.key === 'sharp_eye')?.progress).toBe(2);
    expect(buildChallenges(1, matches, [], []).find(c => c.key === 'comeback')?.unlocked).toBe(false);
    const zero = match(0, { kickoffTime: '2026-08-30T12:00:00.000Z', predictions: [{ userId: 1, homeScore: 0, awayScore: 0, pointsAwarded: 0 }] });
    expect(buildChallenges(1, [zero, ...matches], [], []).find(c => c.key === 'comeback')?.unlocked).toBe(true);
  });
  it('does not unlock participation on an empty week and retains claimed titles', () => {
    const challenges = buildChallenges(1, [], buildWeeks([], players, now), ['sharp_eye']);
    expect(challenges.find(c => c.key === 'ever_present')?.unlocked).toBe(false);
    expect(challenges.find(c => c.key === 'sharp_eye')?.unlocked).toBe(true);
  });
  it('shares only scored aggregate performance, not future picks', () => {
    const matches = [match(1), match(2, { status: 'scheduled', homeTeamName: 'Secret future team' })];
    const recap = buildRecap(1, 'Ahmed', 'Summer', true, matches, [], { rank: 2, points: 7 });
    expect(recap.predictions).toBe(1); expect(recap.accuracy).toBe(100); expect(recap.shareText).not.toContain('Secret'); expect(recap.shareText).toContain('#2');
  });
});
