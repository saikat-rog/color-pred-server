-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'referral_commission';

-- AlterTable
ALTER TABLE "game_settings" ADD COLUMN     "referral_commission_l1" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "referral_commission_l2" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
ADD COLUMN     "referral_commission_l3" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
ALTER COLUMN "max_bet_amount" SET DEFAULT 10000000000;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referred_by_id" INTEGER;

-- CreateTable
CREATE TABLE "referral_commissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "from_user_id" INTEGER NOT NULL,
    "bet_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_commissions_user_id_idx" ON "referral_commissions"("user_id");

-- CreateIndex
CREATE INDEX "referral_commissions_from_user_id_idx" ON "referral_commissions"("from_user_id");

-- CreateIndex
CREATE INDEX "referral_commissions_bet_id_idx" ON "referral_commissions"("bet_id");

-- CreateIndex
CREATE INDEX "referral_commissions_created_at_idx" ON "referral_commissions"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_commissions" ADD CONSTRAINT "referral_commissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
