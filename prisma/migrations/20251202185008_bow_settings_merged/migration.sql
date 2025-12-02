-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "bow_betting_duration" INTEGER NOT NULL DEFAULT 55,
ADD COLUMN     "bow_period_duration" INTEGER NOT NULL DEFAULT 60,
ALTER COLUMN "one_minute_betting_duration" SET DEFAULT 55;
