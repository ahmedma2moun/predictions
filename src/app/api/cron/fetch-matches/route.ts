import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchFixtures, mapFixtureStatus, type APIFixture } from '@/lib/football-api';
import { sendNewMatchesEmail, sendCronRunEmail, type MatchForEmail } from '@/lib/email';
import { format, addDays } from 'date-fns';

// Stages that are always single-leg (no leg numbers shown)
const SINGLE_LEG_STAGES = new Set(['FINAL', 'THIRD_PLACE', 'THIRD_PLACE_PLAY_OFF']);

/**
 * For knockout rounds, derive leg numbers from matchday:
 * within a given stage the lower matchday = Leg 1, higher = Leg 2.
 * Works correctly whether one or both legs are in the DB.
 * Final / third-place stages never get a leg number.
 */
async function assignKnockoutLegs(externalLeagueId: number) {
  const knockoutMatches = await prisma.match.findMany({
    where: {
      externalLeagueId,
      stage: { not: null },
      NOT: [{ stage: 'GROUP_STAGE' }, { stage: 'REGULAR_SEASON' }],
    },
    select: { id: true, stage: true, matchday: true },
  });

  // Group by stage, collect distinct sorted matchdays
  const stageMatchdays = new Map<string, number[]>();
  for (const m of knockoutMatches) {
    if (!m.stage || m.matchday == null) continue;
    if (!stageMatchdays.has(m.stage)) stageMatchdays.set(m.stage, []);
    const days = stageMatchdays.get(m.stage)!;
    if (!days.includes(m.matchday)) days.push(m.matchday);
  }
  // Sort each stage's matchdays ascending
  for (const days of stageMatchdays.values()) days.sort((a, b) => a - b);

  for (const m of knockoutMatches) {
    if (!m.stage) continue;
    if (SINGLE_LEG_STAGES.has(m.stage) || m.matchday == null) {
      await prisma.match.update({ where: { id: m.id }, data: { leg: null } });
      continue;
    }
    const days = stageMatchdays.get(m.stage) ?? [];
    const legIndex = days.indexOf(m.matchday);
    // legIndex 0 → Leg 1, 1 → Leg 2; anything unexpected → null
    const leg = legIndex === 0 ? 1 : legIndex === 1 ? 2 : null;
    await prisma.match.update({ where: { id: m.id }, data: { leg } });
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
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

  const fridayStart = new Date();
  fridayStart.setUTCHours(0, 0, 0, 0);
  const nextFriday = addDays(fridayStart, 7);
  const from = format(fridayStart, 'yyyy-MM-dd');
  const to   = format(nextFriday,  'yyyy-MM-dd');

  const leagues = await prisma.league.findMany({ where: { isActive: true } });
  let inserted = 0, skipped = 0, errors = 0;

  console.log(`[cron/fetch-matches] Starting — ${leagues.length} active leagues, window: ${from} → ${to}`);

  for (const league of leagues) {
    try {
      const fixtures = await fetchFixtures({ league: league.externalId, season: league.season, from, to });
      console.log(`[cron/fetch-matches] ${league.name}: ${fixtures.length} fixtures returned from API`);

      const fixtureIds = fixtures.map((f: APIFixture) => f.fixture.id);
      const existing = new Set(
        (await prisma.match.findMany({ where: { externalId: { in: fixtureIds } }, select: { externalId: true } }))
          .map(m => m.externalId)
      );

      const toCreate = fixtures.filter((f: APIFixture) => !existing.has(f.fixture.id));
      skipped += fixtures.length - toCreate.length;

      if (toCreate.length > 0) {
        await prisma.match.createMany({
          data: toCreate.map((f: APIFixture) => ({
            externalId: f.fixture.id,
            leagueId: league.id,
            externalLeagueId: league.externalId,
            homeTeamExtId: f.teams.home.id,
            homeTeamName: f.teams.home.name,
            homeTeamLogo: f.teams.home.logo,
            awayTeamExtId: f.teams.away.id,
            awayTeamName: f.teams.away.name,
            awayTeamLogo: f.teams.away.logo,
            kickoffTime: new Date(f.fixture.date),
            status: mapFixtureStatus(f.fixture.status.short),
            stage: f.fixture.stage ?? null,
            matchday: f.fixture.matchday ?? null,
            venue: f.fixture.venue ?? null,
            scoresProcessed: false,
            weekStart: fridayStart,
          })),
        });
        inserted += toCreate.length;
        console.log(`[cron/fetch-matches] ${league.name}: inserted=${toCreate.length}, skipped=${fixtures.length - toCreate.length}`);

        // Auto-assign leg numbers for knockout rounds in this league
        await assignKnockoutLegs(league.externalId);
      }
    } catch (e) {
      console.error(`[cron/fetch-matches] ERROR league ${league.name} (${league.externalId}):`, e);
      errors++;
    }
  }

  // Send email notifications if new matches were inserted
  if (inserted > 0) {
    try {
      const newMatches = await prisma.match.findMany({
        where: { weekStart: fridayStart, status: 'scheduled' },
        include: { league: { select: { name: true } } },
        orderBy: { kickoffTime: 'asc' },
      });

      const matchesForEmail: MatchForEmail[] = newMatches.map(m => ({
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        kickoffTime: m.kickoffTime,
        leagueName: m.league?.name ?? 'Unknown League',
      }));

      const recipients = await prisma.user.findMany({
        where: { notificationEmail: { not: null } },
        select: { notificationEmail: true },
      });

      for (const user of recipients) {
        if (user.notificationEmail) {
          await sendNewMatchesEmail(user.notificationEmail, matchesForEmail);
          console.log(`[cron/fetch-matches] Notification sent to ${user.notificationEmail}`);
        }
      }
    } catch (e) {
      console.error('[cron/fetch-matches] Failed to send email notifications:', e);
    }
  }

  const summary = { inserted, skipped, errors, timestamp: new Date().toISOString() };
  console.log('[cron/fetch-matches] Done —', JSON.stringify(summary));

  try {
    await sendCronRunEmail('fetch-matches', summary);
  } catch (e) {
    console.error('[cron/fetch-matches] Failed to send cron notification email:', e);
  }

  return NextResponse.json(summary);
}
