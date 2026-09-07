import { prisma } from '@/lib/prisma';
import { cairoDay, cairoDayStart, shiftDay } from './calendar';
import { GameError, positiveId } from './service';
import { upsertPrediction } from '@/lib/services/prediction-service';
import type { SlipData, SlipResult } from './types';

export async function getSlip(userId: number): Promise<SlipData> {
  const now = new Date();
  const day = cairoDay(now);
  const from = cairoDayStart(day);
  const to = cairoDayStart(shiftDay(day, 7));
  const matches = await prisma.match.findMany({ where: { predictionsEnabled: true, kickoffTime: { gte: from, lt: to }, status: { in: ['scheduled', 'live'] } }, include: { league: { select: { name: true } }, predictions: { where: { userId }, select: { homeScore: true, awayScore: true } } }, orderBy: [{ kickoffTime: 'asc' }, { id: 'asc' }] });
  const rows = matches.map(m => ({ id: m.id, homeTeamName: m.homeTeamName, awayTeamName: m.awayTeamName, kickoffTime: m.kickoffTime.toISOString(), league: m.league?.name ?? 'Others', homeScore: m.predictions[0]?.homeScore ?? null, awayScore: m.predictions[0]?.awayScore ?? null, locked: m.status !== 'scheduled' || m.kickoffTime <= now }));
  return { matches: rows, remaining: rows.filter(m => !m.locked && m.homeScore === null).length, from: from.toISOString(), to: to.toISOString() };
}

export async function saveSlip(userId: number, body: Record<string, unknown>): Promise<{ results: SlipResult[] }> {
  if (!Array.isArray(body.predictions) || body.predictions.length === 0 || body.predictions.length > 50) throw new GameError('Save between 1 and 50 predictions at a time');
  const predictions = body.predictions.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new GameError('Invalid prediction');
    const p = value as Record<string, unknown>;
    const matchId = positiveId(p.matchId);
    if (typeof p.homeScore !== 'number' || typeof p.awayScore !== 'number' || !Number.isInteger(p.homeScore) || !Number.isInteger(p.awayScore) || p.homeScore < 0 || p.awayScore < 0 || p.homeScore > 99 || p.awayScore > 99) throw new GameError('Scores must be whole numbers from 0 to 99');
    return { matchId, homeScore: p.homeScore, awayScore: p.awayScore };
  });
  if (new Set(predictions.map(p => p.matchId)).size !== predictions.length) throw new GameError('A match can only appear once');
  const results: SlipResult[] = [];
  for (const p of predictions) {
    const result = await upsertPrediction(userId, p.matchId, p.homeScore, p.awayScore);
    results.push(result.error ? { matchId: p.matchId, saved: false, error: result.error } : { matchId: p.matchId, saved: true });
  }
  return { results };
}
