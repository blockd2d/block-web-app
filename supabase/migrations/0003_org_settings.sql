-- Org settings (Twilio number per org, etc.)

create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  twilio_number text,
  created_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;

-- Managers can read org settings
drop policy if exists org_settings_select on public.org_settings;
create policy org_settings_select
on public.org_settings
for select
using (org_id = public.current_org() and public.is_manager());

-- No client writes (backend/service role only)
drop policy if exists org_settings_no_write on public.org_settings;
create policy org_settings_no_write
on public.org_settings
for all
using (false)
with check (false);
