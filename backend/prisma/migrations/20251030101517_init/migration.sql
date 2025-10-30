/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `vault_plans` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "vault_plans_name_key" ON "vault_plans"("name");
