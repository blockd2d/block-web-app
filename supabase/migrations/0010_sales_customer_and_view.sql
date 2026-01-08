-- 0010_sales_customer_and_view.sql
-- Adds customer_name (and missing updated_at) to sales and creates a denormalized sales_view
-- for fast, paginated filtering. Consumed by API using the Supabase service role.

-- 1) Sales: customer_name + updated_at (view depends on updated_at)
alter table if exists public.sales
  add column if not exists customer_name text,
  add column if not exists updated_at timestamptz;

-- Backfill existing rows if any
update public.sales
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

-- Keep future writes sane (backend should update this explicitly if desired)
alter table public.sales
  alter column updated_at set default now();

alter table public.sales
  alter column updated_at set not null;

-- 2) Indexes for common filtering/sorting
create index if not exists idx_sales_org_created_at
  on public.sales (org_id, created_at desc);

create index if not exists idx_sales_org_rep_created_at
  on public.sales (org_id, rep_id, created_at desc);

create index if not exists idx_sales_org_status_created_at
  on public.sales (org_id, status, created_at desc);

create index if not exists idx_sales_org_customer_phone
  on public.sales (org_id, customer_phone);

create index if not exists idx_sales_org_customer_email
  on public.sales (org_id, customer_email);

create index if not exists idx_sales_org_customer_name
  on public.sales (org_id, customer_name);

-- 3) Denormalized view for fast Sales UI list/detail queries
create or replace view public.sales_view as
select
  s.id,
  s.org_id,
  s.rep_id,
  r.name as rep_name,
  s.property_id,
  p.address1,
  p.city,
  p.state,
  p.zip,
  p.value_estimate,
  s.status as sale_status,
  s.price,
  s.service_type,
  s.notes,
  s.customer_name,
  s.customer_phone,
  s.customer_email,
  s.created_at,
  s.updated_at,
  lj.id as latest_job_id,
  lj.status as job_status,
  lj.completed_at as job_completed_at,
  lp.id as latest_payment_id,
  lp.status as payment_status,
  lp.amount as payment_amount_cents,
  case
    when s.status = 'cancelled' then 'cancelled'
    when lp.status = 'paid' then 'payment_paid'
    when lj.status = 'complete' then 'job_complete'
    else s.status
  end as pipeline_status
from public.sales s
left join public.properties p
  on p.id = s.property_id and p.org_id = s.org_id
left join public.reps r
  on r.id = s.rep_id and r.org_id = s.org_id
left join lateral (
  select j.*
  from public.jobs j
  where j.org_id = s.org_id and j.sale_id = s.id
  order by j.created_at desc nulls last
  limit 1
) lj on true
left join lateral (
  select pm.*
  from public.payments pm
  where pm.org_id = s.org_id
    and lj.id is not null
    and pm.job_id = lj.id
  order by pm.created_at desc nulls last
  limit 1
) lp on true;

-- Optional: if you want to prevent client roles from reading the view directly,
-- you can revoke grants. Service role bypasses RLS anyway.
-- revoke all on public.sales_view from public;
-- grant select on public.sales_view to service_role;
