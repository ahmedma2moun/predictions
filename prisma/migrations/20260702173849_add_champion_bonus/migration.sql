-- CreateEnum
CREATE TYPE "ChampionBonusStatus" AS ENUM ('OPEN', 'LOCKED');

-- CreateTable
CREATE TABLE "ChampionBonus" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "status" "ChampionBonusStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChampionBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChampionBonusTeam" (
    "id" SERIAL NOT NULL,
    "championBonusId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,

    CONSTRAINT "ChampionBonusTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChampionBonusPick" (
    "id" SERIAL NOT NULL,
    "championBonusId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChampionBonusPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChampionBonusAward" (
    "id" SERIAL NOT NULL,
    "championBonusId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "matchId" INTEGER NOT NULL,
    "gameNumber" INTEGER NOT NULL,
    "isWin" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "ChampionBonusAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChampionBonus_seasonId_key" ON "ChampionBonus"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionBonusTeam_championBonusId_teamId_key" ON "ChampionBonusTeam"("championBonusId", "teamId");

-- CreateIndex
CREATE INDEX "ChampionBonusPick_championBonusId_teamId_idx" ON "ChampionBonusPick"("championBonusId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionBonusPick_championBonusId_userId_key" ON "ChampionBonusPick"("championBonusId", "userId");

-- CreateIndex
CREATE INDEX "ChampionBonusAward_championBonusId_teamId_idx" ON "ChampionBonusAward"("championBonusId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionBonusAward_championBonusId_teamId_matchId_key" ON "ChampionBonusAward"("championBonusId", "teamId", "matchId");

-- AddForeignKey
ALTER TABLE "ChampionBonus" ADD CONSTRAINT "ChampionBonus_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonus" ADD CONSTRAINT "ChampionBonus_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusTeam" ADD CONSTRAINT "ChampionBonusTeam_championBonusId_fkey" FOREIGN KEY ("championBonusId") REFERENCES "ChampionBonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusTeam" ADD CONSTRAINT "ChampionBonusTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusPick" ADD CONSTRAINT "ChampionBonusPick_championBonusId_fkey" FOREIGN KEY ("championBonusId") REFERENCES "ChampionBonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusPick" ADD CONSTRAINT "ChampionBonusPick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusPick" ADD CONSTRAINT "ChampionBonusPick_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusAward" ADD CONSTRAINT "ChampionBonusAward_championBonusId_fkey" FOREIGN KEY ("championBonusId") REFERENCES "ChampionBonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusAward" ADD CONSTRAINT "ChampionBonusAward_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionBonusAward" ADD CONSTRAINT "ChampionBonusAward_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
