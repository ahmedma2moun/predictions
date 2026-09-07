-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equippedTitle" TEXT,
ADD COLUMN     "rivalId" INTEGER;

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "userId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "ActivityReaction" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityReaction_groupId_seasonId_eventKey_idx" ON "ActivityReaction"("groupId", "seasonId", "eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityReaction_groupId_seasonId_eventKey_userId_key" ON "ActivityReaction"("groupId", "seasonId", "eventKey", "userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_rivalId_fkey" FOREIGN KEY ("rivalId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReaction" ADD CONSTRAINT "ActivityReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

