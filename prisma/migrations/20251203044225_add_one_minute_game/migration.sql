-- CreateTable
CREATE TABLE "one_minute_game_periods" (
    "id" SERIAL NOT NULL,
    "period_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "betting_end_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "winning_color" "Color",
    "winning_number" "Number",
    "winning_big_or_small" "BigOrSmall",
    "total_green_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_purple_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_red_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_zero_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_one_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_two_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_three_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_four_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_five_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_six_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_seven_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_eight_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_nine_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_big_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_small_bets" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "one_minute_game_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_minute_bets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "period_id" TEXT NOT NULL,
    "game_period_id" INTEGER NOT NULL,
    "color" "Color",
    "number" "Number",
    "big_or_small" "BigOrSmall",
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "win_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "one_minute_bets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "one_minute_game_periods_period_id_key" ON "one_minute_game_periods"("period_id");

-- CreateIndex
CREATE INDEX "one_minute_game_periods_period_id_idx" ON "one_minute_game_periods"("period_id");

-- CreateIndex
CREATE INDEX "one_minute_game_periods_status_idx" ON "one_minute_game_periods"("status");

-- CreateIndex
CREATE INDEX "one_minute_game_periods_start_time_idx" ON "one_minute_game_periods"("start_time");

-- CreateIndex
CREATE INDEX "one_minute_bets_user_id_idx" ON "one_minute_bets"("user_id");

-- CreateIndex
CREATE INDEX "one_minute_bets_period_id_idx" ON "one_minute_bets"("period_id");

-- CreateIndex
CREATE INDEX "one_minute_bets_game_period_id_idx" ON "one_minute_bets"("game_period_id");

-- CreateIndex
CREATE INDEX "one_minute_bets_status_idx" ON "one_minute_bets"("status");

-- CreateIndex
CREATE INDEX "one_minute_bets_game_period_id_status_idx" ON "one_minute_bets"("game_period_id", "status");

-- CreateIndex
CREATE INDEX "one_minute_bets_game_period_id_number_idx" ON "one_minute_bets"("game_period_id", "number");

-- AddForeignKey
ALTER TABLE "one_minute_bets" ADD CONSTRAINT "one_minute_bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_minute_bets" ADD CONSTRAINT "one_minute_bets_game_period_id_fkey" FOREIGN KEY ("game_period_id") REFERENCES "one_minute_game_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
