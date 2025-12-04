/*
  Warnings:

  - A unique constraint covering the columns `[event_id,name]` on the table `Product` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Product_event_id_name_key" ON "Product"("event_id", "name");
