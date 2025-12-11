/*
  Warnings:

  - A unique constraint covering the columns `[event_id,table_id,user_id]` on the table `GuestAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "GuestAssignment_event_id_table_id_user_id_key" ON "GuestAssignment"("event_id", "table_id", "user_id");
