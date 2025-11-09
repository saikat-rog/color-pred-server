-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "max_recharge_amount" DOUBLE PRECISION NOT NULL DEFAULT 50000.00,
ADD COLUMN     "min_recharge_amount" DOUBLE PRECISION NOT NULL DEFAULT 200.0;
