import { z } from "zod";

export const JobStatusSchema = z.enum([
  "new",
  "scheduled",
  "en_route",
  "arrived",
  "in_progress",
  "paused",
  "complete",
  "approved",
  "archived",
  "invoiced",
  "paid"
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobListItemSchema = z.object({
  id: z.string(),
  address_short: z.string().optional().nullable(),
  address_full: z.string().optional().nullable(),
  service_name: z.string().optional().nullable(),
  status: JobStatusSchema,
  customer_name: z.string().optional().nullable(),
  scheduled_start: z.string().optional().nullable(),
  scheduled_end: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  crew_label: z.string().optional().nullable(),
  has_unsynced: z.boolean().optional().default(false),
  has_issue: z.boolean().optional().default(false)
});
export type JobListItem = z.infer<typeof JobListItemSchema>;

export const JobDetailSchema = z.object({
  id: z.string(),
  address_short: z.string().optional().nullable(),
  address_full: z.string().optional().nullable(),
  service_name: z.string().optional().nullable(),
  service_type: z.string().optional().nullable(),
  status: JobStatusSchema,
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  scheduled_start: z.string().optional().nullable(),
  scheduled_end: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  quote_summary: z.string().optional().nullable(),
  crew_label: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable()
});
export type JobDetail = z.infer<typeof JobDetailSchema>;
