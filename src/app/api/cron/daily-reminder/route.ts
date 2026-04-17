import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDailyReminderEmail, sendCronRunEmail, type UnpredictedMatch } from '@/lib/email';
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

  const now = new Date();

  // End of today in CLT (UTC+2): today at 22:00 UTC
  const endOfTodayCLT = new Date(now);
  endOfTodayCLT.setUTCHours(22, 0, 0, 0);
  // If already past 22:00 UTC, advance to next day (shouldn't happen at 09:00 UTC, but be safe)
  if (now >= endOfTodayCLT) {
    endOfTodayCLT.setUTCDate(endOfTodayCLT.getUTCDate() + 1);
  }

  // Scheduled matches that haven't kicked off yet today (CLT)
  const todayMatches = await prisma.match.findMany({
    where: {
      status:      'scheduled',
      kickoffTime: { gte: now, lte: endOfTodayCLT },
    },
    include: { league: { select: { name: true } } },
    orderBy: { kickoffTime: 'asc' },
  });

  console.log(`[cron/daily-reminder] ${todayMatches.length} matches remaining today (CLT)`);

  if (todayMatches.length === 0) {
    const summary = { remindedUsers: 0, skippedUsers: 0, todayMatches: 0, timestamp: now.toISOString() };
    console.log('[cron/daily-reminder] No matches today — nothing to do');
    try { await sendCronRunEmail('daily-reminder', summary); } catch {}
    return NextResponse.json(summary);
  }

  const todayMatchIds = todayMatches.map(m => m.id);

  const users = await prisma.user.findMany({
    where:  { notificationEmail: { not: null } },
    select: { id: true, notificationEmail: true },
  });

  let remindedUsers = 0, skippedUsers = 0, errors = 0;
  const remindedEmails: string[] = [];

  for (const user of users) {
    if (!user.notificationEmail) continue;

    const existingPredictions = await prisma.prediction.findMany({
      where:  { userId: user.id, matchId: { in: todayMatchIds } },
      select: { matchId: true },
    });
    const predictedMatchIds = new Set(existingPredictions.map(p => p.matchId));

    const missing = todayMatches.filter(m => !predictedMatchIds.has(m.id));

    if (missing.length === 0) {
      skippedUsers++;
      console.log(`[cron/daily-reminder] User ${user.id} has all predictions for today — skipping`);
      continue;
    }

    const matchesForEmail: UnpredictedMatch[] = missing.map(m => ({
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      kickoffTime:  m.kickoffTime,
      leagueName:   m.league?.name ?? 'Unknown League',
    }));

    try {
      await sendDailyReminderEmail(user.notificationEmail, matchesForEmail);
      remindedUsers++;
      remindedEmails.push(user.notificationEmail);
      console.log(`[cron/daily-reminder] Reminder sent to user ${user.id} (${missing.length} unpredicted today)`);
    } catch (e) {
      console.error(`[cron/daily-reminder] Failed to email user ${user.id}:`, e);
      errors++;
    }
  }

  // FCM push — send to all mobile users (app shows current state when opened)
  const allMobileUsers = await prisma.deviceToken.findMany({
    select: { userId: true },
    distinct: ['userId'],
  });
  try {
    await sendPushToUsers(allMobileUsers.map(d => d.userId), {
      title: 'Matches today!',
      body: `${todayMatches.length} match${todayMatches.length > 1 ? 'es kick' : ' kicks'} off today — predict before the whistle!`,
      data: { type: 'daily_reminder' },
    });
  } catch (e) {
    console.error('[cron/daily-reminder] FCM push failed:', e);
  }

  const summary = {
    todayMatches: todayMatches.length,
    remindedUsers,
    skippedUsers,
    errors,
    timestamp: now.toISOString(),
  };
  console.log('[cron/daily-reminder] Done —', JSON.stringify(summary));

  try {
    await sendCronRunEmail('daily-reminder', summary, remindedEmails);
  } catch (e) {
    console.error('[cron/daily-reminder] Failed to send cron notification email:', e);
  }

  return NextResponse.json(summary);
}
