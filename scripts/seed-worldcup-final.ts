import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { startOfISOWeek } from 'date-fns';

const prisma = new PrismaClient();

// Real TheSportsDB IDs (FOOTBALL_PROVIDER=thesportsdb) for the 2026 World Cup
// final, so /api/matches/[matchId]/live hits the real event and returns real
// goal/card timeline data — for testing MatchEvents / MatchEventRow display.
async function main() {
  const league = await prisma.league.upsert({
    where: { externalId: 4429 },
    create: {
      externalId: 4429,
      name: 'FIFA World Cup',
      country: 'Worldwide',
      logo: 'https://r2.thesportsdb.com/images/media/league/badge/e7er5g1696521789.png',
      season: 2026,
      isActive: true,
    },
    update: { isActive: true },
  });
  console.log(`League ready: ${league.name} (id=${league.id}, externalId=${league.externalId})`);

  const kickoffTime = new Date('2026-07-19T19:00:00.000Z');
  const weekStart = startOfISOWeek(kickoffTime);
  weekStart.setUTCHours(0, 0, 0, 0);

  const match = await prisma.match.upsert({
    where: { externalId: 2533361 },
    create: {
      externalId: 2533361,
      leagueId: league.id,
      externalLeagueId: 4429,
      homeTeamExtId: 133909,
      homeTeamName: 'Spain',
      homeTeamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/ncgqyr1726166942.png',
      awayTeamExtId: 134509,
      awayTeamName: 'Argentina',
      awayTeamLogo: 'https://r2.thesportsdb.com/images/media/team/badge/3zplhu1726167477.png',
      kickoffTime,
      status: 'finished',
      stage: 'FINAL',
      venue: 'MetLife Stadium',
      resultHomeScore: 1,
      resultAwayScore: 0,
      resultWinner: 'home',
      scoresProcessed: true,
      weekStart,
    },
    update: {
      leagueId: league.id,
      status: 'finished',
      stage: 'FINAL',
      resultHomeScore: 1,
      resultAwayScore: 0,
      resultWinner: 'home',
      scoresProcessed: true,
    },
  });
  console.log(`Match ready: ${match.homeTeamName} vs ${match.awayTeamName} (id=${match.id}, externalId=${match.externalId})`);
  console.log(`Visit /matches/${match.id} (web) to test the events display.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
