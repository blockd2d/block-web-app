-- AlterTable: allow zone-derived cluster sets to have no county
ALTER TABLE "cluster_sets" ALTER COLUMN "county_id" DROP NOT NULL;
