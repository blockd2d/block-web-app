/*
  Warnings:

  - You are about to drop the column `houseNumber` on the `MockHouse` table. All the data in the column will be lost.
  - You are about to drop the column `isCornerHouse` on the `MockHouse` table. All the data in the column will be lost.
  - You are about to drop the column `priorityScore` on the `MockHouse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MockHouse" DROP COLUMN "houseNumber",
DROP COLUMN "isCornerHouse",
DROP COLUMN "priorityScore",
ADD COLUMN     "houseId" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
