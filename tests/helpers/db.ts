import { assertLocalTestDatabase } from './test-database';
import { prisma } from '@/lib/prisma';

/**
 * Truncates every application table and resets identity sequences. Run in
 * `beforeEach` so each test starts from a clean, deterministic DB. Restricted
 * to the local test DB by `.env.test` — never point this at a real database.
 */
export async function resetDb(): Promise<void> {
  assertLocalTestDatabase();

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ChampionBonusAward",
      "ChampionBonusPick",
      "ChampionBonusTeam",
      "ChampionBonus",
      "SeasonStanding",
      "MatchOdds",
      "Prediction",
      "Match",
      "Season",
      "TeamStanding",
      "TeamLeague",
      "Team",
      "League",
      "DeviceToken",
      "UserBadge",
      "GroupMember",
      "Group",
      "ScoringRule",
      "User"
    RESTART IDENTITY CASCADE
  `);
}
