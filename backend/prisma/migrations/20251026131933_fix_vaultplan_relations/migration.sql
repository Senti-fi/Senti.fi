/*
  Warnings:

  - You are about to drop the column `vaultPubkey` on the `user_vaults` table. All the data in the column will be lost.
  - You are about to drop the column `lockPeriodDays` on the `vaults` table. All the data in the column will be lost.
  - You are about to drop the column `locked` on the `vaults` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `vaults` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `user_vaults` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `vaults` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "vaults" DROP CONSTRAINT "vaults_userId_fkey";

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "timestamp" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "user_vaults" DROP COLUMN "vaultPubkey",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vaultPlanId" UUID;

-- AlterTable
ALTER TABLE "vaults" DROP COLUMN "lockPeriodDays",
DROP COLUMN "locked",
DROP COLUMN "userId",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "vaultPlanId" UUID;

-- CreateTable
CREATE TABLE "vault_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "riskType" TEXT NOT NULL,
    "apy" DOUBLE PRECISION NOT NULL,
    "minLockDays" INTEGER NOT NULL,
    "minDeposit" DOUBLE PRECISION NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vault_plans_vaultAddress_key" ON "vault_plans"("vaultAddress");

-- AddForeignKey
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_vaultPlanId_fkey" FOREIGN KEY ("vaultPlanId") REFERENCES "vault_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vaults" ADD CONSTRAINT "user_vaults_vaultPlanId_fkey" FOREIGN KEY ("vaultPlanId") REFERENCES "vault_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
