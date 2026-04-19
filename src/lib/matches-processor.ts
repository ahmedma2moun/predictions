import { TeamService } from '@/lib/services/team-service';
import { LeagueService } from '@/lib/services/league-service';
import { logger } from '@/lib/logger';
import { UserRepository } from '@/lib/repositories/user-repository';
import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { fetchFixtures, mapFixtureStatus, type APIFixture } from '@/lib/football/service';
import { sendNewMatchesEmail, type MatchForEmail } from '@/lib/email';
import { sendPushToUsers } from './fcm';
import { MatchRepository } from '@/lib/repositories/match-repository';

// Stages that are always single-leg (no leg numbers shown)
const SINGLE_LEG_STAGES = new Set(['FINAL', 'THIRD_PLACE', 'THIRD_PLACE_PLAY_OFF']);

/**
 * For knockout rounds, derive leg numbers from matchday within a given stage:
 * lower matchday = Leg 1, higher = Leg 2.
 * Final / third-place stages never get a leg number.
 */
async function assignKnockoutLegs(externalLeagueId: number) {
  const knockoutMatches = await MatchRepository.findMany({
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
    updates.push(MatchRepository.update({ where: { id: m.id }, data: { leg } }));
  }
  if (updates.length > 0) {
    await MatchRepository.transaction(updates);
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
      ? LeagueService.getById({ where: { id: leagueId } }).then(l => (l ? [l] : []))
      : LeagueService.getAll({ where: { isActive: true } }),
    filterByTeams ? getActiveTeamsByLeague() : Promise.resolve(new Map<number, Set<number>>()),
  ]);

  let inserted = 0, skipped = 0, errors = 0;
  const debug: Record<string, unknown>[] = [];

  logger.info(`[${logPrefix}] Starting — ${leagues.length} league(s), window: ${from} → ${to}`);

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
        (await MatchRepository.findMany({ where: { externalId: { in: fixtureIds } }, select: { externalId: true } }))
          .map(m => m.externalId)
      );

      const toCreate = fixtures.filter((f: APIFixture) => !existing.has(f.fixture.id));
      skipped += fixtures.length - toCreate.length;

      if (toCreate.length > 0) {
        await MatchRepository.createMany({
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
        logger.info(`[${logPrefix}] ${league.name}: inserted=${toCreate.length}, skipped=${fixtures.length - toCreate.length}`);

        await assignKnockoutLegs(league.externalId);
      }
    } catch (e: unknown) {
      logger.error(`[${logPrefix}] ERROR league ${league.name} (${league.externalId}):`, { error: e instanceof Error ? e.message : String(e) });
      debug.push({ league: league.name, externalId: league.externalId, error: e instanceof Error ? e.message : String(e) });
      errors++;
    }
  }

  await sendNewMatchNotifications(weekStart, inserted, logPrefix);

  return { inserted, skipped, errors, debug };
}

export async function sendNewMatchNotifications(weekStart: Date, insertedCount: number, logPrefix: string) {
  if (insertedCount === 0) return;
  try {
    const newMatches = await MatchRepository.findMany({
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
    const recipients = await UserRepository.findMany({
      where: { notificationEmail: { not: null } },
      select: { notificationEmail: true },
    });
    for (const user of recipients) {
      if (user.notificationEmail) {
        await sendNewMatchesEmail(user.notificationEmail, matchesForEmail);
        logger.info(`[${logPrefix}] Notification sent to ${user.notificationEmail}`);
      }
    }
    // FCM push — send to ALL users with device tokens, independent of email recipients
    const mobileUserIds = await DeviceTokenRepository.findMany({
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
      logger.error(`[${logPrefix}] FCM push failed:`, { error: e instanceof Error ? e.message : String(e) });
    }
  } catch (e) {
    logger.error(`[${logPrefix}] Failed to send new matches emails:`, { error: e instanceof Error ? e.message : String(e) });
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

async function getActiveTeamsByLeague(): Promise<Map<number, Set<number>>> {
  return TeamService.getActiveTeamsByLeagueMap();
}

function filterByActiveTeams(fixtures: APIFixture[], activeTeamIds: Set<number> | undefined) {
  if (!activeTeamIds || activeTeamIds.size === 0) return fixtures;
  return fixtures.filter(f =>
    activeTeamIds.has(f.teams.home.id) || activeTeamIds.has(f.teams.away.id)
  );
}
