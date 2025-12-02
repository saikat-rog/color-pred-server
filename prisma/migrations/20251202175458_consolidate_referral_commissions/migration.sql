/*
  Warnings:

  - You are about to drop the `bow_referral_commissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `thirty_second_referral_commissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bow_referral_commissions" DROP CONSTRAINT "bow_referral_commissions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "thirty_second_referral_commissions" DROP CONSTRAINT "thirty_second_referral_commissions_user_id_fkey";

-- AlterTable
ALTER TABLE "referral_commissions" ADD COLUMN     "game_type" TEXT NOT NULL DEFAULT 'main';

-- DropTable
DROP TABLE "bow_referral_commissions";

-- DropTable
DROP TABLE "thirty_second_referral_commissions";

-- CreateIndex
CREATE INDEX "referral_commissions_game_type_idx" ON "referral_commissions"("game_type");
