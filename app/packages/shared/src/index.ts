import { z } from "zod";

export const RoleEnum = z.enum(["admin", "manager", "rep", "labor"]);
export type Role = z.infer<typeof RoleEnum>;

export const RuntimeConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  RAILWAY_API_BASE_URL: z.string().url(),
  MAPBOX_TOKEN: z.string().min(10),
  POSTHOG_KEY: z.string().min(3),
  POSTHOG_HOST: z.string().url().optional(),
});

export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;

export const PosthogEvents = {
  // web
  org_login_success: "org_login_success",
  territory_generate_clicked: "territory_generate_clicked",
  territory_generate_job_started: "territory_generate_job_started",
  territory_generate_job_completed: "territory_generate_job_completed",
  cluster_assigned: "cluster_assigned",
  sale_created: "sale_created",
  export_requested: "export_requested",
  export_downloaded: "export_downloaded",
  message_thread_viewed: "message_thread_viewed",
  message_sent_manager: "message_sent_manager",
  audit_log_viewed: "audit_log_viewed",
  // rep
  rep_clock_in: "rep_clock_in",
  rep_clock_out: "rep_clock_out",
  cluster_started: "cluster_started",
  door_outcome_logged: "door_outcome_logged",
  followup_created: "followup_created",
  followup_completed: "followup_completed",
  sms_sent_rep: "sms_sent_rep",
  contract_signed: "contract_signed",
  route_reordered: "route_reordered",
  // labor
  labor_clock_in: "labor_clock_in",
  labor_clock_out: "labor_clock_out",
  job_status_changed: "job_status_changed",
  before_photo_added: "before_photo_added",
  after_photo_added: "after_photo_added",
  payment_intent_created: "payment_intent_created",
  payment_completed: "payment_completed",
  receipt_sent: "receipt_sent",
  availability_updated: "availability_updated",
} as const;
