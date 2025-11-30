-- CreateEnum
CREATE TYPE "BigOrSmall" AS ENUM ('big', 'small');

-- AlterTable
ALTER TABLE "game_periods" ADD COLUMN     "total_big_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_small_bets" DOUBLE PRECISION NOT NULL DEFAULT 0;
