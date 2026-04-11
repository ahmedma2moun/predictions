-- CreateTable
CREATE TABLE "ResultCheckSlot" (
    "id" TEXT NOT NULL,
    "kickoffTime" TIMESTAMP(3) NOT NULL,
    "qstashJobId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultCheckSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultCheckSlot_kickoffTime_key" ON "ResultCheckSlot"("kickoffTime");

-- CreateIndex
CREATE INDEX "ResultCheckSlot_status_scheduledAt_idx" ON "ResultCheckSlot"("status", "scheduledAt");
