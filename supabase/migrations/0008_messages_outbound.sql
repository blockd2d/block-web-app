-- Block V7: messaging fields for real thread UX + outbound attribution

alter table if exists public.messages
  add column if not exists from_phone text,
  add column if not exists to_phone text,
  add column if not exists sent_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists sent_by_rep_id uuid references public.reps(id) on delete set null;

create index if not exists messages_thread_sent_at_idx
  on public.messages (thread_id, sent_at desc, created_at desc);

create index if not exists messages_org_thread_idx
  on public.messages (org_id, thread_id);

-- Best-effort backfill from thread customer_phone
-- Inbound: from_phone = customer_phone
update public.messages m
set from_phone = t.customer_phone
from public.message_threads t
where m.thread_id = t.id
  and m.direction = 'inbound'
  and m.from_phone is null
  and t.customer_phone is not null;

-- Outbound: to_phone = customer_phone
update public.messages m
set to_phone = t.customer_phone
from public.message_threads t
where m.thread_id = t.id
  and m.direction = 'outbound'
  and m.to_phone is null
  and t.customer_phone is not null;
