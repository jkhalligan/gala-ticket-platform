/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,reference_code]` on the table `GuestAssignment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[event_id,reference_code]` on the table `Table` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organization_id` to the `GuestAssignment` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GuestAssignment_qr_code_token_idx";

-- AlterTable
ALTER TABLE "GuestAssignment" ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "reference_code" TEXT,
ADD COLUMN     "tier" "ProductTier" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "reference_code" TEXT;

-- CreateIndex
CREATE INDEX "GuestAssignment_organization_id_idx" ON "GuestAssignment"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "GuestAssignment_organization_id_reference_code_key" ON "GuestAssignment"("organization_id", "reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "Table_event_id_reference_code_key" ON "Table"("event_id", "reference_code");

-- AddForeignKey
ALTER TABLE "GuestAssignment" ADD CONSTRAINT "GuestAssignment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
