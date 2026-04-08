import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchFixtures, mapFixtureStatus, type APIFixture } from '@/lib/football-api';
import { sendNewMatchesEmail, type MatchForEmail } from '@/lib/email';
import { format, addDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
            scoresProcessed: false,
            weekStart: fridayStart,
          })),
        });
        inserted += toCreate.length;
        console.log(`[cron/fetch-matches] ${league.name}: inserted=${toCreate.length}, skipped=${fixtures.length - toCreate.length}`);
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
  return NextResponse.json(summary);
}
