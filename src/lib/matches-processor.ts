import { TeamService } from '@/lib/services/team-service';
import { LeagueService } from '@/lib/services/league-service';
import { logger } from '@/lib/logger';
import { UserRepository } from '@/lib/repositories/user-repository';
import { DeviceTokenRepository } from '@/lib/repositories/device-repository';
import { fetchFixtures, mapFixtureStatus, type APIFixture } from '@/lib/football/service';
import { sendNewMatchesEmail, type MatchForEmail } from '@/lib/email';
import { sendPushToUsers } from './fcm';
import { registerLiveGoalChain } from '@/lib/live-goal-service';
import { MatchRepository } from '@/lib/repositories/match-repository';
import { SeasonService } from '@/lib/services/season-service';
import { requireString, requireDate } from '@/lib/validation';
import { format, addDays, addMonths, startOfMonth, endOfMonth, startOfISOWeek } from 'date-fns';

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

export interface MatchSummaryItem {
  leagueName: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffTime: Date;
}

export interface FetchMatchesSummary {
  inserted: number;
  skipped: number;
  errors: number;
  debug: Record<string, unknown>[];
  insertedMatches: MatchSummaryItem[];
  skippedMatches: MatchSummaryItem[];
}

/**
 * Fetches fixtures from the football API for the given date window, inserts new
 * ones into the DB, assigns knockout leg numbers, and sends new-match emails.
 * Used by both the Vercel cron and the admin "Fetch" buttons.
 *
 * @param from        - Start date string (yyyy-MM-dd)
 * @param to          - End date string (yyyy-MM-dd)
 * @param fromDate    - The Date written onto inserted matches' `weekStart` column (fetch-batch marker, not a calendar week)
 * @param leagueId    - Optional DB league id to restrict to a single league
 * @param filterByTeams - When true, only keep fixtures involving active teams
 * @param logPrefix   - Prefix for console log lines
 */
export async function fetchAndInsertMatches(params: {
  from: string;
  to: string;
  fromDate: Date;
  leagueId?: number;
  filterByTeams?: boolean;
  logPrefix: string;
}): Promise<FetchMatchesSummary> {
  const { from, to, fromDate, leagueId, filterByTeams = false, logPrefix } = params;

  const [leagues, activeTeamsByLeague, activeSeason] = await Promise.all([
    leagueId
      ? LeagueService.getById({ where: { id: leagueId } }).then(l => (l ? [l] : []))
      : LeagueService.getAll({ where: { isActive: true } }),
    filterByTeams ? getActiveTeamsByLeague() : Promise.resolve(new Map<number, Set<number>>()),
    SeasonService.getActiveSeason(),
  ]);
  const activeSeasonId = activeSeason?.id ?? null;

  let inserted = 0, skipped = 0, errors = 0;
  const debug: Record<string, unknown>[] = [];
  const insertedMatches: MatchSummaryItem[] = [];
  const skippedMatches: MatchSummaryItem[] = [];

  logger.info(`[${logPrefix}] Starting — ${leagues.length} league(s), window: ${from} → ${to}`);

  for (const league of leagues) {
    try {
      const activeTeamIds = activeTeamsByLeague.get(league.externalId);
      if (filterByTeams && !activeTeamIds?.size) {
        logger.info(`[${logPrefix}] ${league.name}: skipped — no active teams`);
        debug.push({ league: league.name, externalId: league.externalId, skippedReason: 'no active teams' });
        continue;
      }

      const allFixtures = await fetchFixtures({ league: league.externalId, season: league.season, from, to });
      const fixtures = filterByTeams
        ? filterByActiveTeams(allFixtures, activeTeamIds!)
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
      const alreadyExisting = fixtures.filter((f: APIFixture) => existing.has(f.fixture.id));
      skipped += alreadyExisting.length;

      for (const f of alreadyExisting) {
        skippedMatches.push({
          leagueName: league.name,
          homeTeamName: f.teams.home.name,
          awayTeamName: f.teams.away.name,
          kickoffTime: new Date(f.fixture.date),
        });
      }

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
            weekStart: fromDate,
            seasonId: activeSeasonId,
          })),
        });
        inserted += toCreate.length;
        for (const f of toCreate) {
          insertedMatches.push({
            leagueName: league.name,
            homeTeamName: f.teams.home.name,
            awayTeamName: f.teams.away.name,
            kickoffTime: new Date(f.fixture.date),
          });
        }
        logger.info(`[${logPrefix}] ${league.name}: inserted=${toCreate.length}, skipped=${alreadyExisting.length}`);

        await assignKnockoutLegs(league.externalId);
        await registerLiveGoalChains(toCreate, logPrefix);
      }
    } catch (e: unknown) {
      logger.error(`[${logPrefix}] ERROR league ${league.name} (${league.externalId}):`, { error: e instanceof Error ? e.message : String(e) });
      debug.push({ league: league.name, externalId: league.externalId, error: e instanceof Error ? e.message : String(e) });
      errors++;
    }
  }

  await sendNewMatchNotifications(fromDate, inserted, logPrefix);

  return { inserted, skipped, errors, debug, insertedMatches, skippedMatches };
}

export async function sendNewMatchNotifications(fromDate: Date, insertedCount: number, logPrefix: string) {
  if (insertedCount === 0) return;
  const newMatches = await MatchRepository.findMany({
    where: { weekStart: fromDate, status: 'scheduled' },
    include: { league: { select: { name: true } } },
    orderBy: { kickoffTime: 'asc' },
  });
  const matchesForEmail: MatchForEmail[] = newMatches.map(m => ({
    homeTeamName: m.homeTeamName,
    awayTeamName: m.awayTeamName,
    kickoffTime: m.kickoffTime,
    leagueName: m.externalLeagueId === 0 ? 'Others' : (m.league?.name ?? 'Unknown League'),
  }));
  await notifyUsersOfNewMatches(
    matchesForEmail,
    `${insertedCount} match${insertedCount > 1 ? 'es' : ''} added — place your predictions!`,
    logPrefix,
  );
}

/** Emails + pushes every user about newly added matches. Never throws — failures are logged, not surfaced, since this always runs alongside a match-creation flow that must not fail because a notification did. */
export async function notifyUsersOfNewMatches(matches: MatchForEmail[], pushBody: string, logPrefix: string) {
  if (matches.length === 0) return;
  try {
    const recipients = await UserRepository.findMany({
      where: { notificationEmail: { not: null } },
      select: { notificationEmail: true },
    });
    for (const user of recipients) {
      if (user.notificationEmail) {
        await sendNewMatchesEmail(user.notificationEmail, matches);
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
        title: matches.length > 1 ? 'New matches this week' : 'New match added',
        body: pushBody,
        data: { type: 'new_matches' },
      });
    } catch (e) {
      logger.error(`[${logPrefix}] FCM push failed:`, { error: e instanceof Error ? e.message : String(e) });
    }
  } catch (e) {
    logger.error(`[${logPrefix}] Failed to send new matches emails:`, { error: e instanceof Error ? e.message : String(e) });
  }
}

export async function fetchThisWeekFixtures(leagueId?: number): Promise<FetchMatchesSummary> {
  const fromDate = new Date();
  fromDate.setUTCHours(0, 0, 0, 0);
  const from = format(fromDate, 'yyyy-MM-dd');
  const to = format(addDays(fromDate, 6), 'yyyy-MM-dd');
  return fetchAndInsertMatches({ from, to, fromDate, leagueId, filterByTeams: true, logPrefix: 'admin/matches fetch' });
}

export async function fetchNextMonthFixtures(leagueId?: number): Promise<FetchMatchesSummary> {
  const fromDate = new Date();
  fromDate.setUTCHours(0, 0, 0, 0);
  const nextMonth = addMonths(fromDate, 1);
  const from = format(startOfMonth(nextMonth), 'yyyy-MM-dd');
  const to = format(endOfMonth(nextMonth), 'yyyy-MM-dd');
  return fetchAndInsertMatches({ from, to, fromDate, leagueId, filterByTeams: true, logPrefix: 'admin/matches fetch-next-month' });
}

export interface CreateCustomMatchInput {
  homeTeamName: unknown;
  awayTeamName: unknown;
  kickoffTime: unknown;
}

export async function createCustomMatch(input: CreateCustomMatchInput) {
  const homeTeamName = requireString(input.homeTeamName, 'homeTeamName');
  const awayTeamName = requireString(input.awayTeamName, 'awayTeamName');
  const kickoff = requireDate(input.kickoffTime, 'kickoffTime');

  const weekStart = startOfISOWeek(kickoff);
  weekStart.setUTCHours(0, 0, 0, 0);

  const match = await MatchRepository.create({
    data: {
      externalId: null,
      externalLeagueId: 0,
      homeTeamExtId: 0,
      homeTeamName,
      awayTeamExtId: 0,
      awayTeamName,
      kickoffTime: kickoff,
      weekStart,
      status: 'scheduled',
      scoresProcessed: false,
    },
  });

  // Fire-and-forget: a notification failure must not fail match creation.
  notifyUsersOfNewMatches(
    [{ homeTeamName: match.homeTeamName, awayTeamName: match.awayTeamName, kickoffTime: match.kickoffTime, leagueName: 'Others' }],
    `${match.homeTeamName} vs ${match.awayTeamName} — place your prediction!`,
    'admin/matches create-custom',
  );

  return match;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Registers the live-goal QStash chain for each newly-inserted future fixture. Never throws — a scheduling failure must not fail match insertion. */
async function registerLiveGoalChains(fixtures: APIFixture[], logPrefix: string): Promise<void> {
  const now = new Date();
  const upcoming = fixtures.filter(f => new Date(f.fixture.date) > now);
  await Promise.all(
    upcoming.map(f =>
      registerLiveGoalChain({ externalId: f.fixture.id, kickoffTime: new Date(f.fixture.date) }).catch(e =>
        logger.error(`[${logPrefix}] Failed to register live-goal chain for fixture ${f.fixture.id}:`, {
          error: e instanceof Error ? e.message : String(e),
        }),
      ),
    ),
  );
}

async function getActiveTeamsByLeague(): Promise<Map<number, Set<number>>> {
  return TeamService.getActiveTeamsByLeagueMap();
}

function filterByActiveTeams(fixtures: APIFixture[], activeTeamIds: Set<number>) {
  return fixtures.filter(f =>
    activeTeamIds.has(f.teams.home.id) || activeTeamIds.has(f.teams.away.id)
  );
}
