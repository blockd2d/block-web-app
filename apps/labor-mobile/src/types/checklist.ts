import { z } from "zod";

export const ChecklistItemSchema = z.object({
  id: z.string(),
  template_item_id: z.string(),
  label: z.string(),
  sort_order: z.number(),
  is_required: z.boolean().optional(),
  is_checked: z.boolean().optional(),
  checked_at: z.string().optional().nullable(),
  note: z.string().optional().nullable()
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistResponseSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  template_item_id: z.string(),
  is_checked: z.boolean(),
  checked_by_user_id: z.string().optional().nullable(),
  checked_at: z.string().optional().nullable(),
  note: z.string().optional().nullable()
});
export type ChecklistResponse = z.infer<typeof ChecklistResponseSchema>;
