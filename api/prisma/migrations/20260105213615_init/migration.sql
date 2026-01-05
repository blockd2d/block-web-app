/*
  Warnings:

  - You are about to drop the `MockHouse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "MockHouse";

-- CreateTable
CREATE TABLE "GlobalHouses" (
    "id" UUID NOT NULL,
    "houseId" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "address" TEXT NOT NULL DEFAULT 'Unknown Address',
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "neighborhood" TEXT NOT NULL DEFAULT 'Unknown Neighborhood',
    "visitDurationMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "streetName" TEXT NOT NULL DEFAULT 'Unknown Street',
    "propertyValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalHouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Unnamed Organization',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profiles" (
    "user_id" UUID NOT NULL,
    "org_id" TEXT NOT NULL DEFAULT 'unknown',
    "role" TEXT NOT NULL DEFAULT 'rep',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profiles_pkey" PRIMARY KEY ("user_id")
);
