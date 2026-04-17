import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPredictionReminderEmail, sendCronRunEmail, type UnpredictedMatch } from '@/lib/email';
import { addDays } from 'date-fns';
import { sendPushToUsers } from '@/lib/fcm';

export async function GET(req: NextRequest) {
  const authHeader    = req.headers.get('authorization');
  const cronSecret    = process.env.CRON_SECRET;
  const triggerSecret = process.env.TRIGGER_SECRET;
  const isVercelCron  = !!req.headers.get('x-vercel-cron-schedule');
  const authorized =
    isVercelCron ||
    (cronSecret    && authHeader === `Bearer ${cronSecret}`) ||
    (triggerSecret && authHeader === `Bearer ${triggerSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now     = new Date();
  const in7Days = addDays(now, 7);

  // Find all scheduled matches in the next 7 days
  const upcomingMatches = await prisma.match.findMany({
    where: {
      status:      'scheduled',
      kickoffTime: { gte: now, lte: in7Days },
    },
    include: { league: { select: { name: true } } },
    orderBy: { kickoffTime: 'asc' },
  });

  console.log(`[cron/prediction-reminder] ${upcomingMatches.length} upcoming matches in the next 7 days`);

  if (upcomingMatches.length === 0) {
    const summary = { remindedUsers: 0, skippedUsers: 0, upcomingMatches: 0, timestamp: now.toISOString() };
    console.log('[cron/prediction-reminder] No upcoming matches — nothing to do');
    try { await sendCronRunEmail('prediction-reminder', summary); } catch {}
    return NextResponse.json(summary);
  }

  const upcomingMatchIds = upcomingMatches.map(m => m.id);

  // Users who have a notificationEmail set
  const users = await prisma.user.findMany({
    where:  { notificationEmail: { not: null } },
    select: { id: true, notificationEmail: true },
  });

  let remindedUsers = 0, skippedUsers = 0, errors = 0;
  const remindedUserIds: number[] = [];
  const remindedEmails: string[] = [];

  for (const user of users) {
    if (!user.notificationEmail) continue;

    // Find which upcoming matches this user already predicted
    const existingPredictions = await prisma.prediction.findMany({
      where:  { userId: user.id, matchId: { in: upcomingMatchIds } },
      select: { matchId: true },
    });
    const predictedMatchIds = new Set(existingPredictions.map(p => p.matchId));

    // Matches this user hasn't predicted yet
    const missing = upcomingMatches.filter(m => !predictedMatchIds.has(m.id));

    if (missing.length === 0) {
      skippedUsers++;
      console.log(`[cron/prediction-reminder] User ${user.id} has all predictions — skipping`);
      continue;
    }

    const matchesForEmail: UnpredictedMatch[] = missing.map(m => ({
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      kickoffTime:  m.kickoffTime,
      leagueName:   m.league?.name ?? 'Unknown League',
    }));

    try {
      await sendPredictionReminderEmail(user.notificationEmail, matchesForEmail);
      remindedUsers++;
      remindedUserIds.push(user.id);
      remindedEmails.push(user.notificationEmail);
      console.log(`[cron/prediction-reminder] Reminder sent to user ${user.id} (${missing.length} missing predictions)`);
    } catch (e) {
      console.error(`[cron/prediction-reminder] Failed to email user ${user.id}:`, e);
      errors++;
    }
  }

  // FCM push — send to all mobile users regardless of email setting
  const allMobileUsers = await prisma.deviceToken.findMany({
    select: { userId: true },
    distinct: ['userId'],
  });
  try {
    await sendPushToUsers(allMobileUsers.map(d => d.userId), {
      title: "Don't forget to predict!",
      body: 'You still have matches without a prediction this week.',
      data: { type: 'prediction_reminder' },
    });
  } catch (e) {
    console.error('[cron/prediction-reminder] FCM push failed:', e);
  }

  const summary = {
    upcomingMatches: upcomingMatches.length,
    remindedUsers,
    skippedUsers,
    errors,
    timestamp: now.toISOString(),
  };
  console.log('[cron/prediction-reminder] Done —', JSON.stringify(summary));

  try {
    await sendCronRunEmail('prediction-reminder', summary, remindedEmails);
  } catch (e) {
    console.error('[cron/prediction-reminder] Failed to send cron notification email:', e);
  }

  return NextResponse.json(summary);
}
