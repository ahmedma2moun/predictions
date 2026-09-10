-- CreateTable
CREATE TABLE "ReminderJob" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "kickoffTime" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "queuedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderDelivery" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderRefresh" (
    "leagueId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "completedRevision" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderRefresh_pkey" PRIMARY KEY ("leagueId")
);

-- CreateIndex
CREATE INDEX "ReminderJob_status_dueAt_idx" ON "ReminderJob"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderJob_matchId_kickoffTime_kind_key" ON "ReminderJob"("matchId", "kickoffTime", "kind");

-- CreateIndex
CREATE INDEX "ReminderDelivery_jobId_status_nextAttemptAt_idx" ON "ReminderDelivery"("jobId", "status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderDelivery_jobId_userId_channel_targetKey_key" ON "ReminderDelivery"("jobId", "userId", "channel", "targetKey");

-- AddForeignKey
ALTER TABLE "ReminderJob" ADD CONSTRAINT "ReminderJob_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReminderJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderRefresh" ADD CONSTRAINT "ReminderRefresh_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

