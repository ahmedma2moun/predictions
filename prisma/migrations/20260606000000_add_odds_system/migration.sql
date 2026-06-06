-- Add odds config columns to Season
ALTER TABLE "Season"
  ADD COLUMN "oddsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "oddsMin"     DECIMAL(4,2) NOT NULL DEFAULT 1.1,
  ADD COLUMN "oddsMax"     DECIMAL(4,2) NOT NULL DEFAULT 5.0;

-- Add odds columns to Prediction
ALTER TABLE "Prediction"
  ADD COLUMN "baseScore"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "finalScore"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "outcomeOdds" DECIMAL(4,2) NOT NULL DEFAULT 1.0;

-- Create MatchOdds table
CREATE TABLE "MatchOdds" (
  "id"           SERIAL PRIMARY KEY,
  "matchId"      INTEGER NOT NULL,
  "homeWinVotes" INTEGER NOT NULL DEFAULT 0,
  "drawVotes"    INTEGER NOT NULL DEFAULT 0,
  "awayWinVotes" INTEGER NOT NULL DEFAULT 0,
  "homeWinOdds"  DECIMAL(4,2) NOT NULL DEFAULT 1.10,
  "drawOdds"     DECIMAL(4,2) NOT NULL DEFAULT 3.05,
  "awayWinOdds"  DECIMAL(4,2) NOT NULL DEFAULT 5.00,
  "lockedAt"     TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchOdds_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MatchOdds_matchId_key" ON "MatchOdds"("matchId");
