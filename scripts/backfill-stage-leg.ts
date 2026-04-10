import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

const prisma = new PrismaClient();

async function fetchFixtures(leagueId: number, season: number, from: string, to: string) {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) throw new Error('FOOTBALL_API_KEY is not set');

  const url = new URL(`https://api.football-data.org/v4/competitions/${leagueId}/matches`);
  url.searchParams.set('season', String(season));
  url.searchParams.set('dateFrom', from);
  url.searchParams.set('dateTo', to);

  const res = await fetch(url.toString(), { headers: { 'X-Auth-Token': apiKey } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`football-data.org ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    matches: Array<{ id: number; stage?: string }>;
  };
  return data.matches;
}

const SINGLE_LEG_STAGES = new Set(['FINAL', 'THIRD_PLACE', 'THIRD_PLACE_PLAY_OFF']);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function assignKnockoutLegs(externalLeagueId: number) {
  const knockoutMatches = await prisma.match.findMany({
    where: {
      externalLeagueId,
      stage: { not: null },
      NOT: [{ stage: 'GROUP_STAGE' }, { stage: 'REGULAR_SEASON' }],
    },
    select: { id: true, stage: true, matchday: true },
  });

  if (knockoutMatches.length === 0) return;

  // Collect distinct sorted matchdays per stage
  const stageMatchdays = new Map<string, number[]>();
  for (const m of knockoutMatches) {
    if (!m.stage || m.matchday == null) continue;
    if (!stageMatchdays.has(m.stage)) stageMatchdays.set(m.stage, []);
    const days = stageMatchdays.get(m.stage)!;
    if (!days.includes(m.matchday)) days.push(m.matchday);
  }
  for (const days of stageMatchdays.values()) days.sort((a, b) => a - b);

  let assigned = 0;
  for (const m of knockoutMatches) {
    if (!m.stage) continue;
    if (SINGLE_LEG_STAGES.has(m.stage) || m.matchday == null) {
      await prisma.match.update({ where: { id: m.id }, data: { leg: null } });
      continue;
    }
    const days = stageMatchdays.get(m.stage) ?? [];
    const legIndex = days.indexOf(m.matchday);
    const leg = legIndex === 0 ? 1 : legIndex === 1 ? 2 : null;
    await prisma.match.update({ where: { id: m.id }, data: { leg } });
    if (leg) {
      console.log(`  match ${m.id} → ${m.stage} matchday ${m.matchday} = Leg ${leg}`);
      assigned++;
    }
  }
  if (assigned > 0) console.log(`  → ${assigned} match(es) got leg numbers`);
}

async function run() {
  const matches = await prisma.match.findMany({
    where: { stage: null },
    select: { id: true, externalId: true, externalLeagueId: true, kickoffTime: true },
  });

  if (matches.length === 0) {
    console.log('All matches already have a stage — running leg computation only.');
  } else {
    console.log(`Found ${matches.length} matches without stage to backfill.`);
  }

  // Group by league, track date range and externalId→dbId map
  const byLeague = new Map<number, { externalIds: Map<number, number>; minDate: Date; maxDate: Date }>();
  for (const m of matches) {
    if (!byLeague.has(m.externalLeagueId)) {
      byLeague.set(m.externalLeagueId, { externalIds: new Map(), minDate: m.kickoffTime, maxDate: m.kickoffTime });
    }
    const entry = byLeague.get(m.externalLeagueId)!;
    entry.externalIds.set(m.externalId, m.id);
    if (m.kickoffTime < entry.minDate) entry.minDate = m.kickoffTime;
    if (m.kickoffTime > entry.maxDate) entry.maxDate = m.kickoffTime;
  }

  const leagues = await prisma.league.findMany({
    where: { externalId: { in: [...byLeague.keys()] } },
    select: { externalId: true, season: true, name: true },
  });
  const leagueInfo = new Map(leagues.map(l => [l.externalId, l]));

  let updated = 0;
  let leagueIdx = 0;

  for (const [externalLeagueId, { externalIds, minDate, maxDate }] of byLeague) {
    if (leagueIdx++ > 0) {
      console.log('Waiting 7 s to respect rate limit...');
      await sleep(7000);
    }

    const league = leagueInfo.get(externalLeagueId);
    if (!league) {
      console.warn(`League ${externalLeagueId} not in DB — skipping.`);
      continue;
    }

    const from = format(minDate, 'yyyy-MM-dd');
    const to   = format(maxDate, 'yyyy-MM-dd');
    console.log(`\n[${league.name}] Fetching ${from} → ${to} (season ${league.season})`);

    try {
      const fixtures = await fetchFixtures(externalLeagueId, league.season, from, to);
      console.log(`  ${fixtures.length} fixtures returned`);

      for (const f of fixtures) {
        const dbId = externalIds.get(f.id);
        if (dbId === undefined) continue;

        await prisma.match.update({
          where: { id: dbId },
          data: { stage: f.stage ?? null },
        });
        updated++;
        if (f.stage) console.log(`  ✓ match ${f.id} → stage=${f.stage}`);
      }

      console.log(`  Computing legs for knockout matches in ${league.name}...`);
      await assignKnockoutLegs(externalLeagueId);
    } catch (e) {
      console.error(`  ERROR league ${externalLeagueId}:`, e);
    }
  }

  // Also run leg computation for leagues that already had stage but might not have legs
  if (matches.length === 0) {
    const allLeagues = await prisma.league.findMany({ where: { isActive: true }, select: { externalId: true, name: true } });
    for (const league of allLeagues) {
      console.log(`\nComputing legs for ${league.name}...`);
      await assignKnockoutLegs(league.externalId);
    }
  }

  console.log(`\nDone. ${updated}/${matches.length} matches updated with stage.`);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
