import { z } from 'zod';

export const RoleSchema = z.enum(['admin','manager','rep','labor']);

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  turnstileToken: z.string().optional().nullable()
});

export const InviteCreateSchema = z.object({
  email: z.string().email(),
  role: RoleSchema
});

export const InviteAcceptSchema = z.object({
  token: z.string().min(10),
  name: z.string().min(1),
  password: z.string().min(8)
});

export const RepUpsertSchema = z.object({
  name: z.string().min(1),
  home_lat: z.number(),
  home_lng: z.number(),
  active: z.boolean().default(true)
});

export const ClusterSetCreateSchema = z.object({
  // Optional friendly name shown in the web UI
  name: z.string().min(1).optional(),
  county_id: z.string().uuid(),
  filters: z.object({
    radius_m: z.number().min(10).max(5000).default(500),
    min_houses: z.number().min(3).max(500).default(12),
    value_min: z.number().optional(),
    value_max: z.number().optional(),
    exclude_dnk: z.boolean().optional(),
    only_unworked: z.boolean().optional()
  })
});

export const InteractionCreateSchema = z.object({
  property_id: z.string().uuid(),
  outcome: z.enum(['not_home','talked_not_interested','lead','quote','sold','followup','do_not_knock']),
  notes: z.string().optional(),
  followup_at: z.string().datetime().optional()
});

export const SaleCreateSchema = z.object({
  property_id: z.string().uuid(),
  status: z.enum(['lead','quote','sold','cancelled']).default('lead'),
  price: z.number().optional(),
  service_type: z.string().optional(),
  notes: z.string().optional(),
  customer_name: z.string().optional(),
  customer_phone: z.string().optional(),
  customer_email: z.string().optional()
});

export const FollowupCreateSchema = z.object({
  property_id: z.string().uuid(),
  due_at: z.string().datetime(),
  notes: z.string().optional()
});

export const MessageSendSchema = z.object({
  to: z.string().min(7),
  body: z.string().min(1),
  property_id: z.string().uuid().optional()
});

export const PaymentCreateIntentSchema = z.object({
  job_id: z.string().uuid(),
  amount: z.number().int().min(1),
  currency: z.string().default('usd'),
  customer_phone: z.string().optional()
});
