-- Org settings (Twilio number per org, etc.)

create table if not exists org_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  twilio_number text,
  created_at timestamptz not null default now()
);

alter table org_settings enable row level security;

drop policy if exists org_settings_select on org_settings;
create policy org_settings_select on org_settings for select
using (org_id = current_org() and is_manager());

drop policy if exists org_settings_no_write on org_settings;
create policy org_settings_no_write on org_settings for all
using (false) with check (false);
