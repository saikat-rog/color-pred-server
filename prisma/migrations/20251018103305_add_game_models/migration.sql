-- CreateEnum
CREATE TYPE "Color" AS ENUM ('green', 'purple', 'red');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'bet_debit';
ALTER TYPE "TransactionType" ADD VALUE 'bet_win_credit';

-- CreateTable
CREATE TABLE "game_settings" (
    "id" SERIAL NOT NULL,
    "period_duration" INTEGER NOT NULL DEFAULT 180,
    "betting_duration" INTEGER NOT NULL DEFAULT 150,
    "win_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.8,
    "min_bet_amount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "max_bet_amount" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_periods" (
    "id" SERIAL NOT NULL,
    "period_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "betting_end_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "winning_color" "Color",
    "total_green_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_purple_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_red_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "game_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "period_id" TEXT NOT NULL,
    "game_period_id" INTEGER NOT NULL,
    "color" "Color" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "win_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_periods_period_id_key" ON "game_periods"("period_id");

-- CreateIndex
CREATE INDEX "game_periods_period_id_idx" ON "game_periods"("period_id");

-- CreateIndex
CREATE INDEX "game_periods_status_idx" ON "game_periods"("status");

-- CreateIndex
CREATE INDEX "game_periods_start_time_idx" ON "game_periods"("start_time");

-- CreateIndex
CREATE INDEX "bets_user_id_idx" ON "bets"("user_id");

-- CreateIndex
CREATE INDEX "bets_period_id_idx" ON "bets"("period_id");

-- CreateIndex
CREATE INDEX "bets_game_period_id_idx" ON "bets"("game_period_id");

-- CreateIndex
CREATE INDEX "bets_status_idx" ON "bets"("status");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_game_period_id_fkey" FOREIGN KEY ("game_period_id") REFERENCES "game_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
