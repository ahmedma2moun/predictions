/**
 * Debug script: find France vs Senegal match in DB, then test the football API
 * with its externalId and league to see why fetch-results isn't picking it up.
 *
 * Run: npx ts-node --project tsconfig.json -e "$(cat scripts/test-fetch-results.ts)"
 * Or:  npx tsx scripts/test-fetch-results.ts
 */

import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

const prisma = new PrismaClient({ log: ['error'] });

async function main() {
  // ── 1. Find France / Senegal match in DB ────────────────────────────────────
  const match = await prisma.match.findFirst({
    where: {
      OR: [
        { homeTeamName: { contains: 'France', mode: 'insensitive' } },
        { awayTeamName: { contains: 'France', mode: 'insensitive' } },
        { homeTeamName: { contains: 'Senegal', mode: 'insensitive' } },
        { awayTeamName: { contains: 'Senegal', mode: 'insensitive' } },
      ],
    },
    include: { league: true },
    orderBy: { kickoffTime: 'desc' },
  });

  if (!match) {
    console.log('❌  No France/Senegal match found in DB');
    return;
  }

  console.log('\n── DB Match ────────────────────────────────────────────────────');
  console.log(`  id:               ${match.id}`);
  console.log(`  externalId:       ${match.externalId}`);
  console.log(`  home:             ${match.homeTeamName}`);
  console.log(`  away:             ${match.awayTeamName}`);
  console.log(`  kickoffTime:      ${match.kickoffTime.toISOString()}`);
  console.log(`  status:           ${match.status}`);
  console.log(`  scoresProcessed:  ${match.scoresProcessed}`);
  console.log(`  resultHomeScore:  ${match.resultHomeScore}`);
  console.log(`  resultAwayScore:  ${match.resultAwayScore}`);
  console.log(`  externalLeagueId: ${match.externalLeagueId}`);
  console.log(`  league:           ${match.league?.name ?? '(null)'} — season ${match.league?.season}`);

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    console.log('\n❌  FOOTBALL_API_KEY not set — skipping API tests');
    return;
  }

  const baseUrl = 'https://api.football-data.org/v4';
  const headers = { 'X-Auth-Token': apiKey };

  // ── 2. Fetch the fixture directly by externalId ──────────────────────────────
  if (match.externalId) {
    console.log(`\n── GET /matches/${match.externalId} ────────────────────────────`);
    try {
      const r = await fetch(`${baseUrl}/matches/${match.externalId}`, { headers });
      const body = await r.text();
      console.log(`  HTTP ${r.status}`);
      if (r.ok) {
        const json = JSON.parse(body);
        console.log(`  status:    ${json.status}`);
        console.log(`  fullTime:  ${JSON.stringify(json.score?.fullTime)}`);
        console.log(`  penalties: ${JSON.stringify(json.score?.penalties)}`);
        console.log(`  duration:  ${json.score?.duration}`);
        console.log(`  winner:    ${json.score?.winner}`);
      } else {
        console.log('  body:', body.slice(0, 300));
      }
    } catch (e) {
      console.log('  ERROR:', e);
    }
  }

  // ── 3. Fetch fixtures by league + date range (what processMatchResults does) ──
  if (match.externalLeagueId && match.league) {
    const from = format(match.kickoffTime, 'yyyy-MM-dd');
    const to   = format(match.kickoffTime, 'yyyy-MM-dd');
    const url  = `${baseUrl}/competitions/${match.externalLeagueId}/matches?season=${match.league.season}&dateFrom=${from}&dateTo=${to}`;
    console.log(`\n── GET ${url} ────────────────────`);
    try {
      const r = await fetch(url, { headers });
      const body = await r.text();
      console.log(`  HTTP ${r.status}`);
      if (r.ok) {
        const json = JSON.parse(body);
        const fixtures: any[] = json.matches ?? [];
        console.log(`  fixtures returned: ${fixtures.length}`);
        const found = fixtures.find((f: any) => f.id === match.externalId);
        if (found) {
          console.log(`  ✅  Match found in response`);
          console.log(`  status:    ${found.status}`);
          console.log(`  fullTime:  ${JSON.stringify(found.score?.fullTime)}`);
          console.log(`  penalties: ${JSON.stringify(found.score?.penalties)}`);
          console.log(`  duration:  ${found.score?.duration}`);
        } else {
          console.log(`  ❌  Match externalId ${match.externalId} NOT found in the ${fixtures.length} fixtures returned`);
          if (fixtures.length > 0) {
            console.log('  IDs returned:', fixtures.map((f: any) => f.id).join(', '));
          }
        }
      } else {
        console.log('  body:', body.slice(0, 300));
      }
    } catch (e) {
      console.log('  ERROR:', e);
    }
  }

  // ── 4. Check what processMatchResults would see for pending matches ───────────
  const now = new Date();
  const pending = await prisma.match.findMany({
    where: {
      kickoffTime: { lt: now },
      status: { notIn: ['finished', 'cancelled'] },
    },
    select: { id: true, homeTeamName: true, awayTeamName: true, status: true, kickoffTime: true, externalId: true, externalLeagueId: true },
    orderBy: { kickoffTime: 'asc' },
    take: 30,
  });

  console.log(`\n── Pending (unfinished, past kickoff) matches in DB: ${pending.length} ─────`);
  for (const m of pending) {
    const isFranceSenegal =
      ['france', 'senegal'].some(t =>
        m.homeTeamName.toLowerCase().includes(t) || m.awayTeamName.toLowerCase().includes(t)
      );
    const flag = isFranceSenegal ? ' ◀ FRANCE/SENEGAL' : '';
    console.log(`  [${m.id}] ${m.homeTeamName} vs ${m.awayTeamName} — status: ${m.status} — kickoff: ${m.kickoffTime.toISOString()} — extId: ${m.externalId}${flag}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
