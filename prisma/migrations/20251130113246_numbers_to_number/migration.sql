/*
  Warnings:

  - The `number` column on the `bets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `number` column on the `bow_bets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `winning_number` column on the `bow_game_periods` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `winning_number` column on the `game_periods` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Number" AS ENUM ('zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine');

-- AlterTable
ALTER TABLE "bets" DROP COLUMN "number",
ADD COLUMN     "number" "Number";

-- AlterTable
ALTER TABLE "bow_bets" DROP COLUMN "number",
ADD COLUMN     "number" "Number";

-- AlterTable
ALTER TABLE "bow_game_periods" DROP COLUMN "winning_number",
ADD COLUMN     "winning_number" "Number";

-- AlterTable
ALTER TABLE "game_periods" DROP COLUMN "winning_number",
ADD COLUMN     "winning_number" "Number";

-- DropEnum
DROP TYPE "Numbers";

-- CreateIndex
CREATE INDEX "bets_game_period_id_number_idx" ON "bets"("game_period_id", "number");

-- CreateIndex
CREATE INDEX "bow_bets_game_period_id_number_idx" ON "bow_bets"("game_period_id", "number");
