/*
  Warnings:

  - A unique constraint covering the columns `[userId,vaultId]` on the table `user_vaults` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[vaultPlanId,token]` on the table `vaults` will be added. If there are existing duplicate values, this will fail.
  - Made the column `vaultPlanId` on table `vaults` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'send';
ALTER TYPE "TransactionType" ADD VALUE 'receive';

-- DropIndex
DROP INDEX "vaults_vaultPubkey_key";

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "sender" TEXT;

-- AlterTable
ALTER TABLE "vault_plans" ADD COLUMN     "vaultPubkey" TEXT;

-- AlterTable
ALTER TABLE "vaults" ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "vaultPlanId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_vaults_userId_vaultId_key" ON "user_vaults"("userId", "vaultId");

-- CreateIndex
CREATE INDEX "vaults_vaultPubkey_idx" ON "vaults"("vaultPubkey");

-- CreateIndex
CREATE UNIQUE INDEX "vaults_vaultPlanId_token_key" ON "vaults"("vaultPlanId", "token");
