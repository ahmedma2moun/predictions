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
    matches: Array<{
      id: number;
      matchday: number | null;
      venue: string | null;
    }>;
  };
  return data.matches;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const matches = await prisma.match.findMany({
    where: { matchday: null },
    select: { id: true, externalId: true, externalLeagueId: true, kickoffTime: true },
  });

  if (matches.length === 0) {
    console.log('No matches missing matchday — nothing to do.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${matches.length} matches to backfill.`);

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
          data: { matchday: f.matchday ?? null, venue: f.venue ?? null },
        });
        updated++;
        console.log(`  ✓ match ${f.id} → matchday=${f.matchday ?? '—'}, venue=${f.venue ?? '—'}`);
      }
    } catch (e) {
      console.error(`  ERROR league ${externalLeagueId}:`, e);
    }
  }

  console.log(`\nDone. ${updated}/${matches.length} matches updated.`);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
