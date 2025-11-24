-- CreateTable
CREATE TABLE "bow_game_settings" (
    "id" SERIAL NOT NULL,
    "period_duration" INTEGER NOT NULL DEFAULT 300,
    "betting_duration" INTEGER NOT NULL DEFAULT 270,
    "win_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.8,
    "win_multiplier_for_number_bet" DOUBLE PRECISION NOT NULL DEFAULT 9.0,
    "win_multiplier_for_number_bet_on_zero_or_five" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "min_bet_amount" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "max_bet_amount" DOUBLE PRECISION NOT NULL DEFAULT 10000000000,
    "referral_commission_l1" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "referral_commission_l2" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "referral_commission_l3" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "referral_signup_bonus" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "min_recharge_for_bonus" DOUBLE PRECISION NOT NULL DEFAULT 500.0,
    "min_recharge_amount" DOUBLE PRECISION NOT NULL DEFAULT 200.0,
    "max_recharge_amount" DOUBLE PRECISION NOT NULL DEFAULT 50000.00,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bow_game_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bow_game_periods" (
    "id" SERIAL NOT NULL,
    "period_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "betting_end_time" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "winning_color" "Color",
    "winning_number" "Numbers",
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "bow_game_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bow_bets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "period_id" TEXT NOT NULL,
    "game_period_id" INTEGER NOT NULL,
    "color" "Color",
    "number" "Numbers",
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "win_amount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "bow_bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bow_referral_commissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "from_user_id" INTEGER NOT NULL,
    "bet_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bow_referral_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bow_game_periods_period_id_key" ON "bow_game_periods"("period_id");

-- CreateIndex
CREATE INDEX "bow_game_periods_period_id_idx" ON "bow_game_periods"("period_id");

-- CreateIndex
CREATE INDEX "bow_game_periods_status_idx" ON "bow_game_periods"("status");

-- CreateIndex
CREATE INDEX "bow_game_periods_start_time_idx" ON "bow_game_periods"("start_time");

-- CreateIndex
CREATE INDEX "bow_bets_user_id_idx" ON "bow_bets"("user_id");

-- CreateIndex
CREATE INDEX "bow_bets_period_id_idx" ON "bow_bets"("period_id");

-- CreateIndex
CREATE INDEX "bow_bets_game_period_id_idx" ON "bow_bets"("game_period_id");

-- CreateIndex
CREATE INDEX "bow_bets_status_idx" ON "bow_bets"("status");

-- CreateIndex
CREATE INDEX "bow_bets_game_period_id_status_idx" ON "bow_bets"("game_period_id", "status");

-- CreateIndex
CREATE INDEX "bow_bets_game_period_id_number_idx" ON "bow_bets"("game_period_id", "number");

-- CreateIndex
CREATE INDEX "bow_referral_commissions_user_id_idx" ON "bow_referral_commissions"("user_id");

-- CreateIndex
CREATE INDEX "bow_referral_commissions_from_user_id_idx" ON "bow_referral_commissions"("from_user_id");

-- CreateIndex
CREATE INDEX "bow_referral_commissions_bet_id_idx" ON "bow_referral_commissions"("bet_id");

-- CreateIndex
CREATE INDEX "bow_referral_commissions_created_at_idx" ON "bow_referral_commissions"("created_at");

-- AddForeignKey
ALTER TABLE "bow_bets" ADD CONSTRAINT "bow_bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bow_bets" ADD CONSTRAINT "bow_bets_game_period_id_fkey" FOREIGN KEY ("game_period_id") REFERENCES "bow_game_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bow_referral_commissions" ADD CONSTRAINT "bow_referral_commissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
