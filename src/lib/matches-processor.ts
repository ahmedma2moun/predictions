import { prisma } from '@/lib/prisma';
import { fetchFixtures, mapFixtureStatus, type APIFixture } from '@/lib/football/service';
import { sendNewMatchesEmail, type MatchForEmail } from '@/lib/email';
import { sendPushToUsers } from './fcm';

// Stages that are always single-leg (no leg numbers shown)
const SINGLE_LEG_STAGES = new Set(['FINAL', 'THIRD_PLACE', 'THIRD_PLACE_PLAY_OFF']);

/**
 * For knockout rounds, derive leg numbers from matchday within a given stage:
 * lower matchday = Leg 1, higher = Leg 2.
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

  const updates = [];
  for (const m of knockoutMatches) {
    if (!m.stage) continue;
    const leg = SINGLE_LEG_STAGES.has(m.stage) || m.matchday == null ? null : m.matchday;
    updates.push(prisma.match.update({ where: { id: m.id }, data: { leg } }));
  }
  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

export interface FetchMatchesSummary {
  inserted: number;
  skipped: number;
  errors: number;
  debug: Record<string, unknown>[];
}

/**
 * Fetches fixtures from the football API for the given date window, inserts new
 * ones into the DB, assigns knockout leg numbers, and sends new-match emails.
 * Used by both the Vercel cron and the admin "Fetch" buttons.
 *
 * @param from        - Start date string (yyyy-MM-dd)
 * @param to          - End date string (yyyy-MM-dd)
 * @param weekStart   - The weekStart value written onto inserted matches
 * @param leagueId    - Optional DB league id to restrict to a single league
 * @param filterByTeams - When true, only keep fixtures involving active teams
 * @param logPrefix   - Prefix for console log lines
 */
export async function fetchAndInsertMatches(params: {
  from: string;
  to: string;
  weekStart: Date;
  leagueId?: number;
  filterByTeams?: boolean;
  logPrefix: string;
}): Promise<FetchMatchesSummary> {
  const { from, to, weekStart, leagueId, filterByTeams = false, logPrefix } = params;

  const [leagues, activeTeamsByLeague] = await Promise.all([
    leagueId
      ? prisma.league.findUnique({ where: { id: leagueId } }).then(l => (l ? [l] : []))
      : prisma.league.findMany({ where: { isActive: true } }),
    filterByTeams ? getActiveTeamsByLeague() : Promise.resolve(new Map<number, Set<number>>()),
  ]);

  let inserted = 0, skipped = 0, errors = 0;
  const debug: Record<string, unknown>[] = [];

  console.log(`[${logPrefix}] Starting — ${leagues.length} league(s), window: ${from} → ${to}`);

  for (const league of leagues) {
    try {
      const allFixtures = await fetchFixtures({ league: league.externalId, season: league.season, from, to });
      const fixtures = filterByTeams
        ? filterByActiveTeams(allFixtures, activeTeamsByLeague.get(league.externalId))
        : allFixtures;

      debug.push({
        league: league.name,
        externalId: league.externalId,
        season: league.season,
        from,
        to,
        allFixtures: allFixtures.length,
        activeTeams: filterByTeams ? (activeTeamsByLeague.get(league.externalId)?.size ?? 'none') : 'unfiltered',
        filtered: fixtures.length,
      });

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
            weekStart,
          })),
        });
        inserted += toCreate.length;
        console.log(`[${logPrefix}] ${league.name}: inserted=${toCreate.length}, skipped=${fixtures.length - toCreate.length}`);

        await assignKnockoutLegs(league.externalId);
      }
    } catch (e: any) {
      console.error(`[${logPrefix}] ERROR league ${league.name} (${league.externalId}):`, e);
      debug.push({ league: league.name, externalId: league.externalId, error: e?.message ?? String(e) });
      errors++;
    }
  }

  await sendNewMatchNotifications(weekStart, inserted, logPrefix);

  return { inserted, skipped, errors, debug };
}

export async function sendNewMatchNotifications(weekStart: Date, insertedCount: number, logPrefix: string) {
  if (insertedCount === 0) return;
  try {
    const newMatches = await prisma.match.findMany({
      where: { weekStart, status: 'scheduled' },
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
        console.log(`[${logPrefix}] Notification sent to ${user.notificationEmail}`);
      }
    }
    // FCM push — send to ALL users with device tokens, independent of email recipients
    const mobileUserIds = await prisma.deviceToken.findMany({
      select: { userId: true },
      distinct: ['userId'],
    });
    const pushUserIds = mobileUserIds.map(d => d.userId);
    try {
      await sendPushToUsers(pushUserIds, {
        title: 'New matches this week',
        body: `${insertedCount} match${insertedCount > 1 ? 'es' : ''} added — place your predictions!`,
        data: { type: 'new_matches' },
      });
    } catch (e) {
      console.error(`[${logPrefix}] FCM push failed:`, e);
    }
  } catch (e) {
    console.error(`[${logPrefix}] Failed to send new matches emails:`, e);
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function getActiveTeamsByLeague(): Promise<Map<number, Set<number>>> {
  const teams = await prisma.team.findMany({
    where: { isActive: true },
    select: { externalId: true, externalLeagueId: true },
  });
  const map = new Map<number, Set<number>>();
  for (const t of teams) {
    if (!map.has(t.externalLeagueId)) map.set(t.externalLeagueId, new Set());
    map.get(t.externalLeagueId)!.add(t.externalId);
  }
  return map;
}

function filterByActiveTeams(fixtures: APIFixture[], activeTeamIds: Set<number> | undefined) {
  if (!activeTeamIds || activeTeamIds.size === 0) return fixtures;
  return fixtures.filter(f =>
    activeTeamIds.has(f.teams.home.id) || activeTeamIds.has(f.teams.away.id)
  );
}
