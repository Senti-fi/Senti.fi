-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "provider" TEXT,
ADD COLUMN     "status" TEXT,
ALTER COLUMN "walletAddress" DROP NOT NULL;
