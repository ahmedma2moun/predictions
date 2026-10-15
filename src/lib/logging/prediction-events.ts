import { logger } from '@/lib/logger';

export type PredictionOutcome = 'ok' | 'invalid_body' | 'invalid_scores' | 'not_found' | 'locked';

interface UpsertEvent {
  platform: 'web' | 'mobile';
  userId: number;
  body?: { matchId?: unknown; homeScore?: unknown; awayScore?: unknown } | null;
  outcome: PredictionOutcome;
  reason?: string;
  msToKickoff?: number;
}

export function logPredictionUpsert(e: UpsertEvent) {
  logger.info('prediction.upsert', {
    event: 'prediction.upsert',
    platform: e.platform,
    userId: e.userId,
    matchId: e.body?.matchId ?? null,
    homeScore: e.body?.homeScore ?? null,
    awayScore: e.body?.awayScore ?? null,
    outcome: e.outcome,
    ...(e.reason && { reason: e.reason }),
    ...(e.msToKickoff !== undefined && { msToKickoff: e.msToKickoff }),
  });
}

export function logGroupViewDenied(platform: 'web' | 'mobile', userId: number, matchId: string, groupId: number, message: string) {
  logger.warn('prediction.group_view_denied', {
    event: 'prediction.group_view_denied',
    platform, userId, matchId, groupId, reason: message,
  });
}
