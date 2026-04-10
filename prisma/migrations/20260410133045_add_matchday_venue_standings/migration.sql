-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "matchday" INTEGER,
ADD COLUMN     "venue" TEXT;

-- CreateTable
CREATE TABLE "TeamStanding" (
    "id" SERIAL NOT NULL,
    "externalTeamId" INTEGER NOT NULL,
    "externalLeagueId" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "goalDifference" INTEGER NOT NULL,
    "form" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamStanding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamStanding_externalTeamId_externalLeagueId_key" ON "TeamStanding"("externalTeamId", "externalLeagueId");
