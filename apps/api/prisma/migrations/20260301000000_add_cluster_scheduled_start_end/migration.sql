-- AlterTable: add optional schedule window for rep clusters
ALTER TABLE "clusters" ADD COLUMN IF NOT EXISTS "scheduled_start" TIMESTAMPTZ(6);
ALTER TABLE "clusters" ADD COLUMN IF NOT EXISTS "scheduled_end" TIMESTAMPTZ(6);
