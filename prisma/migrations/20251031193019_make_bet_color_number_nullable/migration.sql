-- AlterTable
ALTER TABLE "bets" ADD COLUMN     "number" "Numbers",
ALTER COLUMN "color" DROP NOT NULL;

-- AlterTable
ALTER TABLE "game_periods" ADD COLUMN     "winning_number" "Numbers";
