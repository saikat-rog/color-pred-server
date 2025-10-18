-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'referral_bonus';

-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "min_recharge_for_bonus" DOUBLE PRECISION NOT NULL DEFAULT 500.0,
ADD COLUMN     "referral_signup_bonus" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "has_claimed_referral_bonus" BOOLEAN NOT NULL DEFAULT false;
