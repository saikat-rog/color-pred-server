/*
  Warnings:

  - You are about to drop the `bow_game_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thirty_second_bets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thirty_second_game_periods` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thirty_second_game_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thirty_second_referral_commissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "thirty_second_bets" DROP CONSTRAINT "thirty_second_bets_game_period_id_fkey";

-- DropForeignKey
ALTER TABLE "thirty_second_bets" DROP CONSTRAINT "thirty_second_bets_user_id_fkey";

-- DropForeignKey
ALTER TABLE "thirty_second_referral_commissions" DROP CONSTRAINT "thirty_second_referral_commissions_user_id_fkey";

-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "one_minute_betting_duration" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "one_minute_period_duration" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "thirty_second_betting_duration" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "thirty_second_period_duration" INTEGER NOT NULL DEFAULT 30;

-- DropTable
DROP TABLE "bow_game_settings";

-- DropTable
DROP TABLE "thirty_second_bets";

-- DropTable
DROP TABLE "thirty_second_game_periods";

-- DropTable
DROP TABLE "thirty_second_game_settings";

-- DropTable
DROP TABLE "thirty_second_referral_commissions";
