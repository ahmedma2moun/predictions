-- CreateTable
CREATE TABLE "TeamLeague" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "externalLeagueId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "TeamLeague_pkey" PRIMARY KEY ("id")
);

-- Migrate existing Team rows into TeamLeague
INSERT INTO "TeamLeague" ("teamId", "leagueId", "externalLeagueId", "isActive", "updatedAt")
SELECT "id", "leagueId", "externalLeagueId", "isActive", NOW()
FROM "Team";

-- CreateIndex
CREATE UNIQUE INDEX "TeamLeague_teamId_leagueId_key" ON "TeamLeague"("teamId", "leagueId");

-- CreateIndex
CREATE INDEX "TeamLeague_leagueId_idx" ON "TeamLeague"("leagueId");

-- CreateIndex
CREATE INDEX "TeamLeague_externalLeagueId_idx" ON "TeamLeague"("externalLeagueId");

-- AddForeignKey
ALTER TABLE "TeamLeague" ADD CONSTRAINT "TeamLeague_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamLeague" ADD CONSTRAINT "TeamLeague_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_leagueId_fkey";

-- AlterTable: remove the old columns from Team
ALTER TABLE "Team" DROP COLUMN "leagueId",
DROP COLUMN "externalLeagueId",
DROP COLUMN "isActive";
