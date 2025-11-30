/*
  Warnings:

  - You are about to drop the column `bigOrSmall` on the `bets` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bets" DROP COLUMN "bigOrSmall",
ADD COLUMN     "big_or_small" "BigOrSmall";
