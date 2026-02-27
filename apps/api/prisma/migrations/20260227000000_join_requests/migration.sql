-- join_requests table + status->jobs_queue trigger for provisioning

-- CreateTable
CREATE TABLE IF NOT EXISTS "join_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "company_name" TEXT NOT NULL,
  "owner_full_name" TEXT NOT NULL,
  "owner_email" TEXT NOT NULL,
  "owner_phone" TEXT NOT NULL,
  "team_size" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "website" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "referral_source" TEXT NOT NULL,

  "logo_object_path" TEXT,
  "public_token" TEXT NOT NULL,
  "decision_reason" TEXT,
  "approved_company_id" UUID,
  "approved_admin_user_id" UUID,

  CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);

-- Ensure token is unique
CREATE UNIQUE INDEX IF NOT EXISTS "join_requests_public_token_key" ON "join_requests"("public_token");

-- Prevent duplicate active requests by owner email (case-insensitive) unless cancelled
CREATE UNIQUE INDEX IF NOT EXISTS "join_requests_owner_email_active_key"
ON "join_requests"(lower("owner_email"))
WHERE ("status" <> 'cancelled');

-- Helpful lookup for status portal
CREATE INDEX IF NOT EXISTS "join_requests_status_token_idx" ON "join_requests"("public_token");

-- updated_at maintenance
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_join_requests_updated_at ON "join_requests";
CREATE TRIGGER trg_join_requests_updated_at
BEFORE UPDATE ON "join_requests"
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Enqueue provisioning job when staff changes status to approved/rejected
CREATE OR REPLACE FUNCTION enqueue_join_provision_job() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status IN ('approved','rejected')) AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO "jobs_queue" ("org_id","type","payload","status","progress")
    VALUES (NULL, 'join_provision', jsonb_build_object('join_request_id', NEW.id), 'queued', 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_join_requests_enqueue_provision ON "join_requests";
CREATE TRIGGER trg_join_requests_enqueue_provision
AFTER UPDATE OF status ON "join_requests"
FOR EACH ROW
EXECUTE FUNCTION enqueue_join_provision_job();

