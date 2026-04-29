-- AlterTable: make externalId nullable to support custom (non-external) matches
ALTER TABLE "Match" ALTER COLUMN "externalId" DROP NOT NULL;
