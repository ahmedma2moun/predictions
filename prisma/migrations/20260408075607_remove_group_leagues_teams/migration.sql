/*
  Warnings:

  - You are about to drop the `GroupLeague` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupTeam` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GroupLeague" DROP CONSTRAINT "GroupLeague_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupLeague" DROP CONSTRAINT "GroupLeague_leagueId_fkey";

-- DropForeignKey
ALTER TABLE "GroupTeam" DROP CONSTRAINT "GroupTeam_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupTeam" DROP CONSTRAINT "GroupTeam_teamId_fkey";

-- DropTable
DROP TABLE "GroupLeague";

-- DropTable
DROP TABLE "GroupTeam";
