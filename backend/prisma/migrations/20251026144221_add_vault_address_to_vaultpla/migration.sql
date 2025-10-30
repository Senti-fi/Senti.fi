/*
  Warnings:

  - You are about to drop the column `vaultId` on the `rewards` table. All the data in the column will be lost.
  - The `status` column on the `transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `vaultPlanId` on the `user_vaults` table. All the data in the column will be lost.
  - You are about to drop the column `token` on the `vault_plans` table. All the data in the column will be lost.
  - You are about to drop the column `vaultAddress` on the `vault_plans` table. All the data in the column will be lost.
  - Made the column `userVaultId` on table `rewards` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `type` on the `transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `symbol` to the `vaults` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'withdraw', 'fee', 'reward', 'onramp', 'offramp');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'confirmed', 'failed');

-- DropForeignKey
ALTER TABLE "rewards" DROP CONSTRAINT "rewards_userVaultId_fkey";

-- DropForeignKey
ALTER TABLE "rewards" DROP CONSTRAINT "rewards_vaultId_fkey";

-- DropForeignKey
ALTER TABLE "user_vaults" DROP CONSTRAINT "user_vaults_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_vaults" DROP CONSTRAINT "user_vaults_vaultId_fkey";

-- DropForeignKey
ALTER TABLE "user_vaults" DROP CONSTRAINT "user_vaults_vaultPlanId_fkey";

-- DropForeignKey
ALTER TABLE "vaults" DROP CONSTRAINT "vaults_vaultPlanId_fkey";

-- DropIndex
DROP INDEX "vault_plans_vaultAddress_key";

-- AlterTable
ALTER TABLE "rewards" DROP COLUMN "vaultId",
ALTER COLUMN "userVaultId" SET NOT NULL;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "user_vaults" DROP COLUMN "vaultPlanId";

-- AlterTable
ALTER TABLE "vault_plans" DROP COLUMN "token",
DROP COLUMN "vaultAddress";

-- AlterTable
ALTER TABLE "vaults" ADD COLUMN     "symbol" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "rewards_userVaultId_idx" ON "rewards"("userVaultId");

-- CreateIndex
CREATE INDEX "transactions_userId_idx" ON "transactions"("userId");

-- CreateIndex
CREATE INDEX "transactions_token_idx" ON "transactions"("token");

-- CreateIndex
CREATE INDEX "user_vaults_userId_idx" ON "user_vaults"("userId");

-- CreateIndex
CREATE INDEX "user_vaults_vaultId_idx" ON "user_vaults"("vaultId");

-- AddForeignKey
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_vaultPlanId_fkey" FOREIGN KEY ("vaultPlanId") REFERENCES "vault_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vaults" ADD CONSTRAINT "user_vaults_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_vaults" ADD CONSTRAINT "user_vaults_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_userVaultId_fkey" FOREIGN KEY ("userVaultId") REFERENCES "user_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
