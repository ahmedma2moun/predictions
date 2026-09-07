-- AlterTable
ALTER TABLE "TeamLeague" ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN "predictionsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UserReminderTeam" (
    "userId" INTEGER NOT NULL,
    "teamLeagueId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReminderTeam_pkey" PRIMARY KEY ("userId", "teamLeagueId")
);

-- CreateIndex
CREATE INDEX "UserReminderTeam_teamLeagueId_idx" ON "UserReminderTeam"("teamLeagueId");

-- AddForeignKey
ALTER TABLE "UserReminderTeam" ADD CONSTRAINT "UserReminderTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReminderTeam" ADD CONSTRAINT "UserReminderTeam_teamLeagueId_fkey" FOREIGN KEY ("teamLeagueId") REFERENCES "TeamLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
