import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/services/user-service';
import { DeviceTokenService } from '@/lib/services/device-service';
import { sendPredictionReminderEmail, sendCronRunEmail, type UnpredictedMatch } from '@/lib/email';
import { addDays } from 'date-fns';
import { sendPushToUsers } from '@/lib/fcm';
import { verifyCronRequest } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { PredictionRepository } from '@/lib/repositories/prediction-repository';

export async function GET(req: NextRequest) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now     = new Date();
  const in7Days = addDays(now, 7);

  // Find all scheduled matches in the next 7 days
  const upcomingMatches = await MatchRepository.findMany({
    where: {
      status:      'scheduled',
      kickoffTime: { gte: now, lte: in7Days },
    },
    include: { league: { select: { name: true } } },
    orderBy: { kickoffTime: 'asc' },
  });

  logger.info(`[cron/prediction-reminder] ${upcomingMatches.length} upcoming matches in the next 7 days`);

  if (upcomingMatches.length === 0) {
    const summary = { remindedUsers: 0, skippedUsers: 0, upcomingMatches: 0, timestamp: now.toISOString() };
    logger.info('[cron/prediction-reminder] No upcoming matches — nothing to do');
    try { await sendCronRunEmail('prediction-reminder', summary); } catch {}
    return NextResponse.json(summary);
  }

  const upcomingMatchIds = upcomingMatches.map(m => m.id);

  // Users who have a notificationEmail set
  const users = await UserService.getAll({
    where:  { notificationEmail: { not: null } },
    select: { id: true, notificationEmail: true },
  });

  const userIds = users.map(u => u.id);
  const allPredictions = await PredictionRepository.findMany({
    where: { userId: { in: userIds }, matchId: { in: upcomingMatchIds } },
    select: { userId: true, matchId: true },
  });
  const predsByUser = new Map<number, Set<number>>();
  for (const p of allPredictions) {
    if (!predsByUser.has(p.userId)) predsByUser.set(p.userId, new Set());
    predsByUser.get(p.userId)!.add(p.matchId);
  }

  let remindedUsers = 0, skippedUsers = 0, errors = 0;
  const remindedUserIds: number[] = [];
  const remindedEmails: string[] = [];

  for (const user of users) {
    if (!user.notificationEmail) continue;

    // Find which upcoming matches this user already predicted
    const predictedMatchIds = predsByUser.get(user.id) ?? new Set();

    // Matches this user hasn't predicted yet
    const missing = upcomingMatches.filter(m => !predictedMatchIds.has(m.id));

    if (missing.length === 0) {
      skippedUsers++;
      logger.info(`[cron/prediction-reminder] User ${user.id} has all predictions — skipping`);
      continue;
    }

    const matchesForEmail: UnpredictedMatch[] = missing.map(m => ({
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      kickoffTime:  m.kickoffTime,
      leagueName:   m.externalLeagueId === 0 ? 'Others' : (m.league?.name ?? 'Unknown League'),
    }));

    try {
      await sendPredictionReminderEmail(user.notificationEmail, matchesForEmail);
      remindedUsers++;
      remindedUserIds.push(user.id);
      remindedEmails.push(user.notificationEmail);
      logger.info(`[cron/prediction-reminder] Reminder sent to user ${user.id} (${missing.length} missing predictions)`);
    } catch (e) {
      logger.error(`[cron/prediction-reminder] Failed to email user ${user.id}:`, { error: e instanceof Error ? e.message : String(e) });
      errors++;
    }
  }

  // FCM push — only send to mobile users who still have missing predictions
  const allMobileUserIds = (await DeviceTokenService.getAll({
    select: { userId: true },
    distinct: ['userId'],
  })).map(d => d.userId);

  if (allMobileUserIds.length > 0) {
    const predCounts = (await PredictionRepository.groupBy({
      by: ['userId'],
      where: { userId: { in: allMobileUserIds }, matchId: { in: upcomingMatchIds } },
      _count: { matchId: true },
    })) as any[];
    const fullyPredicted = new Set(
      predCounts
        .filter(u => u._count.matchId >= upcomingMatchIds.length)
        .map(u => u.userId),
    );
    const emailUserIds = new Set(users.map(u => u.id));
    const mobileUsersToNotify = allMobileUserIds.filter(
      id => !fullyPredicted.has(id) && !emailUserIds.has(id),
    );

    if (mobileUsersToNotify.length > 0) {
      try {
        await sendPushToUsers(mobileUsersToNotify, {
          title: "Don't forget to predict!",
          body: 'You still have matches without a prediction this week.',
          data: { type: 'prediction_reminder' },
        });
      } catch (e) {
        logger.error('[cron/prediction-reminder] FCM push failed:', { error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const summary = {
    upcomingMatches: upcomingMatches.length,
    remindedUsers,
    skippedUsers,
    errors,
    timestamp: now.toISOString(),
  };
  logger.info('[cron/prediction-reminder] Done —', JSON.parse(JSON.stringify(summary)));

  try {
    await sendCronRunEmail('prediction-reminder', summary, remindedEmails);
  } catch (e) {
    logger.error('[cron/prediction-reminder] Failed to send cron notification email:', { error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json(summary);
}
