import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateScore } from '../src/lib/scoring-engine';
import { getWinner } from '../src/lib/utils';

const prisma = new PrismaClient();

// High offsets keep synthetic externalIds from ever colliding with real
// football-data.org IDs if this DB later syncs real leagues/teams/matches.
const LEAGUE_EXT_BASE = 900_000;
const TEAM_EXT_BASE = 910_000;
const MATCH_EXT_BASE = 920_000;

const LEAGUES = [
  {
    name: 'Dev Premier League',
    country: 'England',
    teams: ['Redwood FC', 'Harbor United', 'Ironside Athletic', 'Meridian City', 'Stonegate Rovers', 'Cobalt Wanderers'],
  },
  {
    name: 'Dev La Liga',
    country: 'Spain',
    teams: ['Costa Azul', 'Sierra Blanca', 'Puerto Real', 'Alba Deportivo', 'Rio Norte', 'Vega Unidos'],
  },
];

const USERS = ['Sam', 'Jordan', 'Priya', 'Marcus', 'Elena'];

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(15, 0, 0, 0);
  return d;
}

function randomScore(): number {
  const r = Math.random();
  if (r < 0.35) return 0;
  if (r < 0.65) return 1;
  if (r < 0.85) return 2;
  if (r < 0.95) return 3;
  return 4;
}

function randomPrediction(actual: { homeScore: number; awayScore: number }, accuracy: number) {
  // accuracy in [0,1]: higher = more likely to guess exactly right, matching seeded "skill" per user
  const roll = Math.random();
  if (roll < accuracy) return { homeScore: actual.homeScore, awayScore: actual.awayScore };
  if (roll < accuracy + 0.25) {
    const diff = actual.homeScore - actual.awayScore;
    const base = randomScore();
    return { homeScore: Math.max(0, base + Math.max(diff, 0)), awayScore: Math.max(0, base - Math.min(diff, 0)) };
  }
  return { homeScore: randomScore(), awayScore: randomScore() };
}

async function main() {
  console.log('Connected to PostgreSQL via Prisma');

  // ── Base seed (idempotent, mirrors scripts/seed.ts) ──────────────────────────
  let admin = await prisma.user.findUnique({ where: { email: 'admin@predictions.app' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { name: 'Admin', email: 'admin@predictions.app', password: await bcrypt.hash('changeme123', 12), role: 'admin' },
    });
    console.log('Admin user created');
  }

  const rules = [
    { name: 'Correct Winner/Draw', description: 'Predicted winner matches actual winner (home/away/draw)', key: 'correct_winner', points: 2, priority: 1, isActive: true },
    { name: 'Exact Score', description: 'Both predicted scores match exactly', key: 'exact_score', points: 5, priority: 2, isActive: true },
    { name: 'Correct Score Difference', description: 'Goal difference matches (e.g., predicted 3-1, actual 2-0)', key: 'score_difference', points: 3, priority: 3, isActive: true },
    { name: 'One Team Correct Score', description: 'Either the predicted home score or away score matches the actual', key: 'one_team_score', points: 1, priority: 4, isActive: true },
  ];
  for (const rule of rules) {
    await prisma.scoringRule.upsert({ where: { key: rule.key }, create: rule, update: {} });
  }
  const activeRules = await prisma.scoringRule.findMany({ where: { isActive: true } });
  console.log('Scoring rules seeded');

  let general = await prisma.group.findFirst({ where: { isDefault: true } });
  if (!general) {
    general = await prisma.group.create({ data: { name: 'General', isDefault: true } });
    console.log('General group created');
  }

  // ── Dev users ─────────────────────────────────────────────────────────────────
  const users = [];
  for (const name of USERS) {
    const email = `${name.toLowerCase()}@predictions.app`;
    const user = await prisma.user.upsert({
      where: { email },
      create: { name, email, password: await bcrypt.hash('password123', 10), role: 'user' },
      update: {},
    });
    users.push(user);
  }
  await prisma.groupMember.createMany({
    data: [admin, ...users].map(u => ({ groupId: general!.id, userId: u.id })),
    skipDuplicates: true,
  });
  console.log(`${users.length} dev users seeded (password: password123) + added to General group`);

  // ── Active season ─────────────────────────────────────────────────────────────
  let season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });
  if (!season) {
    season = await prisma.season.create({
      data: { name: 'Dev Season', status: 'ACTIVE', startDate: daysFromNow(-30), startedAt: daysFromNow(-30) },
    });
    console.log('Active season created: Dev Season');
  }

  // ── Leagues, teams, matches, predictions ────────────────────────────────────
  let leagueExtCounter = LEAGUE_EXT_BASE;
  let teamExtCounter = TEAM_EXT_BASE;
  let matchExtCounter = MATCH_EXT_BASE;
  const weekStart = new Date();

  let matchesCreated = 0;
  let predictionsCreated = 0;

  for (const leagueSpec of LEAGUES) {
    let league = await prisma.league.findFirst({ where: { name: leagueSpec.name } });
    if (!league) {
      league = await prisma.league.create({
        data: { externalId: leagueExtCounter++, name: leagueSpec.name, country: leagueSpec.country, season: 2026, isActive: true },
      });
    }

    const teams = [];
    for (const teamName of leagueSpec.teams) {
      let team = await prisma.team.findFirst({ where: { name: teamName } });
      if (!team) {
        team = await prisma.team.create({ data: { externalId: teamExtCounter++, name: teamName } });
      }
      await prisma.teamLeague.upsert({
        where: { teamId_leagueId: { teamId: team.id, leagueId: league.id } },
        create: { teamId: team.id, leagueId: league.id, externalLeagueId: league.externalId, isActive: true },
        update: {},
      });
      teams.push(team);
    }

    // Skip if this league's matches already exist (idempotent re-run)
    const existingMatchCount = await prisma.match.count({ where: { leagueId: league.id } });
    if (existingMatchCount > 0) {
      console.log(`${leagueSpec.name}: matches already seeded, skipping`);
      continue;
    }

    // 6 finished matches (past, results + predictions), 4 upcoming (scheduled, no results)
    const fixtures: Array<{ home: typeof teams[number]; away: typeof teams[number]; kickoff: Date; finished: boolean }> = [];
    for (let i = 0; i < 6; i++) {
      const home = teams[i % teams.length];
      const away = teams[(i + 1 + Math.floor(i / teams.length)) % teams.length];
      fixtures.push({ home, away, kickoff: daysFromNow(-14 + i * 2), finished: true });
    }
    for (let i = 0; i < 4; i++) {
      const home = teams[(i + 2) % teams.length];
      const away = teams[(i + 4) % teams.length];
      fixtures.push({ home, away, kickoff: daysFromNow(1 + i * 2), finished: false });
    }

    for (const fx of fixtures) {
      if (fx.home.id === fx.away.id) continue;
      const resultHomeScore = fx.finished ? randomScore() : null;
      const resultAwayScore = fx.finished ? randomScore() : null;
      const resultWinner = fx.finished ? getWinner(resultHomeScore!, resultAwayScore!) : null;

      const match = await prisma.match.create({
        data: {
          externalId: matchExtCounter++,
          leagueId: league.id,
          externalLeagueId: league.externalId,
          homeTeamExtId: fx.home.externalId,
          homeTeamName: fx.home.name,
          awayTeamExtId: fx.away.externalId,
          awayTeamName: fx.away.name,
          kickoffTime: fx.kickoff,
          weekStart,
          seasonId: season.id,
          status: fx.finished ? 'finished' : 'scheduled',
          resultHomeScore,
          resultAwayScore,
          resultWinner,
          scoresProcessed: fx.finished,
        },
      });
      matchesCreated++;

      if (fx.finished) {
        for (const [idx, user] of users.entries()) {
          const accuracy = 0.15 + idx * 0.08; // give each dev user a different "skill" level
          const pred = randomPrediction({ homeScore: resultHomeScore!, awayScore: resultAwayScore! }, accuracy);
          const predictedWinner = getWinner(pred.homeScore, pred.awayScore);
          const { totalPoints, breakdown } = calculateScore(
            pred,
            { homeScore: resultHomeScore!, awayScore: resultAwayScore!, winner: resultWinner! },
            activeRules,
          );
          await prisma.prediction.create({
            data: {
              userId: user.id,
              matchId: match.id,
              homeScore: pred.homeScore,
              awayScore: pred.awayScore,
              predictedWinner,
              pointsAwarded: totalPoints,
              baseScore: totalPoints,
              finalScore: totalPoints,
              scoringBreakdown: { rules: breakdown },
            },
          });
          predictionsCreated++;
        }
      } else if (Math.random() < 0.6) {
        // Some users have already predicted upcoming matches too
        for (const user of users.slice(0, 3)) {
          const pred = { homeScore: randomScore(), awayScore: randomScore() };
          await prisma.prediction.create({
            data: {
              userId: user.id,
              matchId: match.id,
              homeScore: pred.homeScore,
              awayScore: pred.awayScore,
              predictedWinner: getWinner(pred.homeScore, pred.awayScore),
            },
          });
          predictionsCreated++;
        }
      }
    }
    console.log(`${leagueSpec.name}: ${teams.length} teams, ${fixtures.length} matches seeded`);
  }

  // Bring current streaks up to date for the users we just scored.
  for (const user of users) {
    const recent = await prisma.prediction.findMany({
      where: { userId: user.id, match: { status: 'finished' } },
      orderBy: { match: { kickoffTime: 'desc' } },
      take: 20,
    });
    let streak = 0;
    for (const p of recent) {
      if (p.pointsAwarded > 0) streak++;
      else break;
    }
    const longest = Math.max(streak, (await prisma.user.findUnique({ where: { id: user.id } }))?.longestStreak ?? 0);
    await prisma.user.update({ where: { id: user.id }, data: { currentStreak: streak, longestStreak: longest } });
  }

  console.log(`\nDone — ${matchesCreated} matches, ${predictionsCreated} predictions created this run.`);
  console.log('Dev users: sam@predictions.app … elena@predictions.app / password123');
  console.log('Admin: admin@predictions.app / changeme123');

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
