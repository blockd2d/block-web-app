-- DEV seed (safe template)
-- NOTE: Auth users cannot be inserted from SQL in hosted Supabase; create users via Dashboard or Admin API.
-- After creating users, set org memberships + sample rows here.

-- Example org:
insert into public.organizations (id, name)
values ('11111111-1111-1111-1111-111111111111', 'Demo Org')
on conflict do nothing;

-- Example membership rows (replace user_id values with real auth.users ids):
-- insert into public.org_memberships (org_id, user_id, role) values
-- ('11111111-1111-1111-1111-111111111111', '<USER_UUID>', 'admin');

-- Sample reps (names stored in profiles):
-- Aaron Means, Stephen Onochie, Jamison Blair

