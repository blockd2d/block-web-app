-- Deterministic demo seed for Block V7
-- NOTE: profiles.id is expected to match auth.users.id in production.
-- For demo/dev, we seed profiles with fixed UUIDs.

begin;

-- Org
insert into organizations (id, name, created_at)
values ('4cc2b904-201e-4390-9288-a9c200d29a11', 'Demo Org (Block V7)', now())
on conflict (id) do nothing;

-- Profiles
insert into profiles (id, org_id, role, name, email)
values
  ('9715dba4-d2f2-4dfe-a39e-11b064182941','4cc2b904-201e-4390-9288-a9c200d29a11','admin','Demo Admin','admin@example.com'),
  ('f90e40f7-22fc-49eb-ab9a-3ac45670c6da','4cc2b904-201e-4390-9288-a9c200d29a11','manager','Demo Manager','manager@example.com'),
  ('4692677c-a9fc-4613-bbae-403e1a3d702a','4cc2b904-201e-4390-9288-a9c200d29a11','rep','Aaron Means','aaron@example.com'),
  ('0e4a3f10-16e3-411c-a98a-a506fc0aeb12','4cc2b904-201e-4390-9288-a9c200d29a11','rep','Stephen Onochie','stephen@example.com'),
  ('1a49467f-7eb8-4577-a297-0f051a803df4','4cc2b904-201e-4390-9288-a9c200d29a11','rep','Jamison Blair','jamison@example.com'),
  ('06a72393-04cb-4585-ab0f-9bced6a164ae','4cc2b904-201e-4390-9288-a9c200d29a11','labor','Demo Labor','labor@example.com')
on conflict (id) do nothing;

-- County
insert into counties (id, org_id, name, fips, bounds)
values ('2b8be88c-51a7-49da-a899-a978f3505fb6','4cc2b904-201e-4390-9288-a9c200d29a11','Marion (Sample)','18097',
  '{"type":"Polygon","coordinates":[[[-86.33,39.63],[-86.02,39.63],[-86.02,39.95],[-86.33,39.95],[-86.33,39.63]]]}'::jsonb
)
on conflict (id) do nothing;

-- Properties (4 sample homes)
insert into properties (id, org_id, county_id, lat, lng, address1, city, state, zip, value_estimate, tags)
values
  ('d5de2001-b1e4-4107-98d2-e0a8bb200af6','4cc2b904-201e-4390-9288-a9c200d29a11','2b8be88c-51a7-49da-a899-a978f3505fb6',39.7665,-86.1598,'100 N Meridian St','Indianapolis','IN','46204',320000,'{"tier":"A"}'::jsonb),
  ('f83ce60b-ef43-4787-8ec2-8a2526831ec3','4cc2b904-201e-4390-9288-a9c200d29a11','2b8be88c-51a7-49da-a899-a978f3505fb6',39.7692,-86.1568,'200 N Illinois St','Indianapolis','IN','46204',285000,'{"tier":"B"}'::jsonb),
  ('6fca994c-43ee-4804-8592-6006d2579d9e','4cc2b904-201e-4390-9288-a9c200d29a11','2b8be88c-51a7-49da-a899-a978f3505fb6',39.7785,-86.1424,'400 Massachusetts Ave','Indianapolis','IN','46204',410000,'{"tier":"A"}'::jsonb),
  ('4d5a9235-419c-4a59-aed8-eb610f0ae30e','4cc2b904-201e-4390-9288-a9c200d29a11','2b8be88c-51a7-49da-a899-a978f3505fb6',39.7802,-86.1402,'500 E Ohio St','Indianapolis','IN','46204',260000,'{"tier":"C"}'::jsonb)
on conflict (id) do nothing;

-- Reps
insert into reps (id, org_id, profile_id, name, home_lat, home_lng, active)
values
  ('b7a31340-ada8-4c5f-b4ae-b3b95319e625','4cc2b904-201e-4390-9288-a9c200d29a11','4692677c-a9fc-4613-bbae-403e1a3d702a','Aaron Means',39.773,-86.152,true),
  ('09592b58-6c3d-41a2-bad7-3ebbaa06046f','4cc2b904-201e-4390-9288-a9c200d29a11','0e4a3f10-16e3-411c-a98a-a506fc0aeb12','Stephen Onochie',39.764,-86.166,true),
  ('8dbfbb09-63c9-4b5d-bfff-8db296aec8b3','4cc2b904-201e-4390-9288-a9c200d29a11','1a49467f-7eb8-4577-a297-0f051a803df4','Jamison Blair',39.781,-86.140,true)
on conflict (id) do nothing;

-- Laborer
insert into laborers (id, org_id, profile_id, name, active)
values ('d62efecb-47ab-4ae5-9f25-18843861d509','4cc2b904-201e-4390-9288-a9c200d29a11','06a72393-04cb-4585-ab0f-9bced6a164ae','Demo Labor',true)
on conflict (id) do nothing;

-- Cluster set
insert into cluster_sets (id, org_id, county_id, filters_json, status, progress, created_by)
values (
  'b916d712-9d82-498b-9de1-9eddddcc9646',
  '4cc2b904-201e-4390-9288-a9c200d29a11',
  '2b8be88c-51a7-49da-a899-a978f3505fb6',
  '{"radius_m":450,"min_houses":2,"value_min":250000,"value_max":500000}'::jsonb,
  'complete',
  100,
  'f90e40f7-22fc-49eb-ab9a-3ac45670c6da'
)
on conflict (id) do nothing;

-- Clusters
insert into clusters (id, org_id, cluster_set_id, center_lat, center_lng, hull_geojson, stats_json, assigned_rep_id, color)
values
  (
    '3a399e1a-e5e6-4d2b-bc99-cfab07ca92e1','4cc2b904-201e-4390-9288-a9c200d29a11','b916d712-9d82-498b-9de1-9eddddcc9646',
    39.768,-86.158,
    '{"type":"Polygon","coordinates":[[[-86.161,39.765],[-86.155,39.765],[-86.155,39.771],[-86.161,39.771],[-86.161,39.765]]]}'::jsonb,
    '{"house_count":2,"avg_value":302500,"total_value":605000}'::jsonb,
    'b7a31340-ada8-4c5f-b4ae-b3b95319e625',
    '#4f46e5'
  ),
  (
    '71e93b57-b559-49ea-a583-32cd1e6fabdc','4cc2b904-201e-4390-9288-a9c200d29a11','b916d712-9d82-498b-9de1-9eddddcc9646',
    39.779,-86.142,
    '{"type":"Polygon","coordinates":[[[-86.145,39.776],[-86.139,39.776],[-86.139,39.782],[-86.145,39.782],[-86.145,39.776]]]}'::jsonb,
    '{"house_count":2,"avg_value":335000,"total_value":670000}'::jsonb,
    '09592b58-6c3d-41a2-bad7-3ebbaa06046f',
    '#16a34a'
  )
on conflict (id) do nothing;

-- Cluster membership
insert into cluster_properties (org_id, cluster_id, property_id)
values
  ('4cc2b904-201e-4390-9288-a9c200d29a11','3a399e1a-e5e6-4d2b-bc99-cfab07ca92e1','d5de2001-b1e4-4107-98d2-e0a8bb200af6'),
  ('4cc2b904-201e-4390-9288-a9c200d29a11','3a399e1a-e5e6-4d2b-bc99-cfab07ca92e1','f83ce60b-ef43-4787-8ec2-8a2526831ec3'),
  ('4cc2b904-201e-4390-9288-a9c200d29a11','71e93b57-b559-49ea-a583-32cd1e6fabdc','6fca994c-43ee-4804-8592-6006d2579d9e'),
  ('4cc2b904-201e-4390-9288-a9c200d29a11','71e93b57-b559-49ea-a583-32cd1e6fabdc','4d5a9235-419c-4a59-aed8-eb610f0ae30e')
on conflict do nothing;

-- Interactions (latest per property drives inspector counts)
insert into interactions (id, org_id, rep_id, property_id, outcome, notes, followup_at, created_at)
values
  ('2e87bbde-e009-48c7-9955-d3fbe25c8aeb','4cc2b904-201e-4390-9288-a9c200d29a11','b7a31340-ada8-4c5f-b4ae-b3b95319e625','d5de2001-b1e4-4107-98d2-e0a8bb200af6','interested','Asked for quote', now() + interval '1 day', now() - interval '2 days'),
  ('eadc27bd-7fc0-4b8b-b88c-7b0d979e918c','4cc2b904-201e-4390-9288-a9c200d29a11','b7a31340-ada8-4c5f-b4ae-b3b95319e625','f83ce60b-ef43-4787-8ec2-8a2526831ec3','do_not_knock','No soliciting sign', null, now() - interval '1 day'),
  ('a003e87a-90d5-4cc3-a3b5-80495793e95e','4cc2b904-201e-4390-9288-a9c200d29a11','09592b58-6c3d-41a2-bad7-3ebbaa06046f','6fca994c-43ee-4804-8592-6006d2579d9e','not_home','Left hanger', null, now() - interval '3 days'),
  ('e32d2e2b-5f4a-4419-9a74-b9e99ec77c8a','4cc2b904-201e-4390-9288-a9c200d29a11','09592b58-6c3d-41a2-bad7-3ebbaa06046f','4d5a9235-419c-4a59-aed8-eb610f0ae30e','lead','Requested text estimate', now() + interval '2 days', now() - interval '1 day')
on conflict (id) do nothing;

-- Sale
insert into sales (id, org_id, rep_id, property_id, price, service_type, notes, customer_phone, customer_email, status, created_at)
values (
  'b67357b0-d3bc-4c3d-a037-e771f89d7c28','4cc2b904-201e-4390-9288-a9c200d29a11','b7a31340-ada8-4c5f-b4ae-b3b95319e625','d5de2001-b1e4-4107-98d2-e0a8bb200af6',
  280,'Pressure Washing','Front walk + siding','+13175551234','customer@example.com','sold', now() - interval '1 day'
)
on conflict (id) do nothing;

-- Followup
insert into followups (id, org_id, rep_id, property_id, due_at, status, notes)
values ('c7363be9-72d0-4c03-ba01-1056821f2361','4cc2b904-201e-4390-9288-a9c200d29a11','b7a31340-ada8-4c5f-b4ae-b3b95319e625','d5de2001-b1e4-4107-98d2-e0a8bb200af6', now() + interval '1 day', 'open','Send scheduling options')
on conflict (id) do nothing;

-- Messaging
insert into message_threads (id, org_id, rep_id, customer_phone, property_id, last_message_at)
values ('0a7fc70d-da9d-4282-8bab-370482dfdb56','4cc2b904-201e-4390-9288-a9c200d29a11','b7a31340-ada8-4c5f-b4ae-b3b95319e625','+13175551234','d5de2001-b1e4-4107-98d2-e0a8bb200af6', now() - interval '1 hour')
on conflict (org_id, customer_phone) do nothing;

insert into messages (id, org_id, thread_id, direction, body, twilio_sid, sent_at, status)
values
  ('7cf33fcb-9b7a-4028-a9e3-f201a676ec86','4cc2b904-201e-4390-9288-a9c200d29a11','0a7fc70d-da9d-4282-8bab-370482dfdb56','outbound','Hey! We can get you on the schedule this week. What day works?','SMXXXX', now() - interval '1 hour','sent'),
  ('336819c3-222a-4f73-8075-7457fa6754ed','4cc2b904-201e-4390-9288-a9c200d29a11','0a7fc70d-da9d-4282-8bab-370482dfdb56','inbound','Friday afternoon would be great.','SMYYYY', now() - interval '55 minutes','received')
on conflict (id) do nothing;

-- Job + payment
insert into jobs (id, org_id, sale_id, laborer_id, scheduled_start, scheduled_end, status)
values (
  '822bbfa2-f2cf-438d-8f79-8d7db60e12d4','4cc2b904-201e-4390-9288-a9c200d29a11','b67357b0-d3bc-4c3d-a037-e771f89d7c28','d62efecb-47ab-4ae5-9f25-18843861d509',
  now() + interval '2 days', now() + interval '2 days' + interval '2 hours','scheduled'
)
on conflict (id) do nothing;

insert into payments (id, org_id, job_id, provider, amount, currency, status, stripe_payment_intent_id)
values ('181a208d-7f31-4762-aa27-13549cac3061','4cc2b904-201e-4390-9288-a9c200d29a11','822bbfa2-f2cf-438d-8f79-8d7db60e12d4','stripe',28000,'usd','pending','pi_demo')
on conflict (id) do nothing;

-- Job photos (metadata only; storage objects not included)
insert into job_photos (org_id, job_id, kind, storage_path)
values
  ('4cc2b904-201e-4390-9288-a9c200d29a11','822bbfa2-f2cf-438d-8f79-8d7db60e12d4','before','job/822bbfa2-f2cf-438d-8f79-8d7db60e12d4/before-demo.jpg'),
  ('4cc2b904-201e-4390-9288-a9c200d29a11','822bbfa2-f2cf-438d-8f79-8d7db60e12d4','after','job/822bbfa2-f2cf-438d-8f79-8d7db60e12d4/after-demo.jpg')
on conflict do nothing;

commit;
