/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Use same Supabase as API (apps/api/.env) so seeded users work for web login
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://jzzgtemqjibvyjdjjxdb.supabase.co';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6emd0ZW1xamlidnlqZGpqeGRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDA4NjU5MiwiZXhwIjoyMDc5NjYyNTkyfQ.2WPenLihuvICucw3VUqBAQNLU5HjRTthnAyaB1XsXNU';

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set in apps/api/.env)');
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const DAY_MS = 1000 * 60 * 60 * 24;

function rand(n: number) {
  return Math.random() * n;
}

function jitter(base: number, scale: number) {
  return base + (Math.random() - 0.5) * scale;
}

function dayISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function squareHull(centerLng: number, centerLat: number, sizeDeg: number) {
  const s = sizeDeg / 2;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [centerLng - s, centerLat - s],
        [centerLng + s, centerLat - s],
        [centerLng + s, centerLat + s],
        [centerLng - s, centerLat + s],
        [centerLng - s, centerLat - s]
      ]
    ]
  };
}

async function createUser(email: string, password: string) {
  const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user!;
}

async function main() {
  const suffix = String(Date.now()).slice(-6);
  const orgName = `Block Dev Org ${suffix}`;

  // Org
  const { data: org, error: orgErr } = await sb.from('organizations').insert({ name: orgName }).select('*').single();
  if (orgErr) throw orgErr;

  // Settings (safe defaults)
  await sb.from('org_settings').insert({
    org_id: org.id,
    twilio_number: '+15550001111',
    outbound_sms_enabled: false
  });

  // Users
  const password = 'Password123!';

  const adminEmail = `admin+${suffix}@block.local`;
  const managerEmail = `manager+${suffix}@block.local`;
  const aaronEmail = `aaron+${suffix}@block.local`;
  const stephenEmail = `stephen+${suffix}@block.local`;
  const jamisonEmail = `jamison+${suffix}@block.local`;
  const laborEmail = `labor+${suffix}@block.local`;

  const [adminUser, managerUser, aaronUser, stephenUser, jamisonUser, laborUser] = await Promise.all([
    createUser(adminEmail, password),
    createUser(managerEmail, password),
    createUser(aaronEmail, password),
    createUser(stephenEmail, password),
    createUser(jamisonEmail, password),
    createUser(laborEmail, password)
  ]);

  // Profiles (Auth -> org role mapping)
  const profiles = [
    { id: adminUser.id, org_id: org.id, role: 'admin', name: 'Dev Admin', email: adminEmail },
    { id: managerUser.id, org_id: org.id, role: 'manager', name: 'Dev Manager', email: managerEmail },
    { id: aaronUser.id, org_id: org.id, role: 'rep', name: 'Aaron Means', email: aaronEmail },
    { id: stephenUser.id, org_id: org.id, role: 'rep', name: 'Stephen Onochie', email: stephenEmail },
    { id: jamisonUser.id, org_id: org.id, role: 'rep', name: 'Jamison Blair', email: jamisonEmail },
    { id: laborUser.id, org_id: org.id, role: 'labor', name: 'Dev Labor', email: laborEmail }
  ];
  const { error: profErr } = await sb.from('profiles').insert(profiles);
  if (profErr) throw profErr;

  // Reps (named, business-context)
  const { data: reps, error: repErr } = await sb
    .from('reps')
    .insert([
      { org_id: org.id, profile_id: aaronUser.id, name: 'Aaron Means', home_lat: 39.762, home_lng: -86.403 },
      { org_id: org.id, profile_id: stephenUser.id, name: 'Stephen Onochie', home_lat: 39.7684, home_lng: -86.1581 },
      { org_id: org.id, profile_id: jamisonUser.id, name: 'Jamison Blair', home_lat: 39.843, home_lng: -86.398 }
    ])
    .select('*');
  if (repErr) throw repErr;

  const repAaron = reps![0];
  const repStephen = reps![1];
  const repJamison = reps![2];
  const repList = [repAaron, repStephen, repJamison];

  // Laborer
  const { data: laborer, error: laborErr } = await sb
    .from('laborers')
    .insert({ org_id: org.id, profile_id: laborUser.id, name: 'Alex Rivera' })
    .select('*')
    .single();
  if (laborErr) throw laborErr;

  // Counties
  const { data: countyH, error: cErrH } = await sb
    .from('counties')
    .insert({ org_id: org.id, name: 'Hendricks', state: 'IN' })
    .select('*')
    .single();
  if (cErrH) throw cErrH;

  const { data: countyM, error: cErrM } = await sb
    .from('counties')
    .insert({ org_id: org.id, name: 'Marion', state: 'IN' })
    .select('*')
    .single();
  if (cErrM) throw cErrM;

  // Properties (dev subset, enough for map + inspector)
  const properties: any[] = [];

  // Hendricks county (around Avon / Brownsburg)
  for (let i = 0; i < 360; i++) {
    const isDnk = Math.random() < 0.05;
    properties.push({
      org_id: org.id,
      county_id: countyH.id,
      address1: `${100 + i} E Main St`,
      city: i % 2 === 0 ? 'Avon' : 'Brownsburg',
      state: 'IN',
      zip: '46123',
      lat: jitter(39.762, 0.16),
      lng: jitter(-86.403, 0.22),
      value_estimate: Math.round(180_000 + rand(520_000)),
      tags: isDnk ? { dnk: true } : null
    });
  }

  // Marion county (around Indy)
  for (let i = 0; i < 340; i++) {
    const isDnk = Math.random() < 0.04;
    properties.push({
      org_id: org.id,
      county_id: countyM.id,
      address1: `${200 + i} N Meridian St`,
      city: 'Indianapolis',
      state: 'IN',
      zip: '46204',
      lat: jitter(39.772, 0.14),
      lng: jitter(-86.158, 0.18),
      value_estimate: Math.round(160_000 + rand(750_000)),
      tags: isDnk ? { dnk: true } : null
    });
  }

  const { data: insertedProps, error: propErr } = await sb
    .from('properties')
    .insert(properties)
    .select('id, lat, lng, value_estimate, county_id, tags');
  if (propErr) throw propErr;

  const hendricksProps = (insertedProps || []).filter((p: any) => p.county_id === countyH.id);

  // Cluster set (Hendricks)
  const { data: cs, error: csErr } = await sb
    .from('cluster_sets')
    .insert({
      org_id: org.id,
      county_id: countyH.id,
      name: 'Hendricks — Territories (Seed)',
      status: 'complete',
      progress: 100,
      filters_json: {
        radius_m: 250,
        min_houses: 12,
        value_min: 200000,
        value_max: 800000,
        exclude_dnk: true,
        include_unworked_only: false
      },
      created_by: managerUser.id
    })
    .select('*')
    .single();
  if (csErr) throw csErr;

  // Build clusters by slicing properties
  const clusters: any[] = [];
  const clusterProps: any[] = [];

  // Filter out DNK for clustering, to make the inspector / filters feel real
  const clusterable = hendricksProps.filter((p: any) => !p.tags?.dnk);
  const CLUSTER_SIZE = 22;
  const CLUSTERS = 12;

  for (let c = 0; c < CLUSTERS; c++) {
    const slice = clusterable.slice(c * CLUSTER_SIZE, c * CLUSTER_SIZE + CLUSTER_SIZE);
    if (!slice.length) break;

    const centerLat = slice.reduce((a: number, p: any) => a + Number(p.lat), 0) / slice.length;
    const centerLng = slice.reduce((a: number, p: any) => a + Number(p.lng), 0) / slice.length;
    const totalPotential = slice.reduce((a: number, p: any) => a + Number(p.value_estimate || 0), 0);
    const avgValue = slice.length ? totalPotential / slice.length : 0;

    const rep = repList[c % repList.length];
    const id = randomUUID();

    clusters.push({
      id,
      org_id: org.id,
      cluster_set_id: cs.id,
      center_lat: centerLat,
      center_lng: centerLng,
      hull_geojson: squareHull(centerLng, centerLat, 0.035),
      stats_json: {
        size: slice.length,
        total_potential: totalPotential,
        avg_value: avgValue
      },
      assigned_rep_id: rep.id
    });

    for (const p of slice) {
      clusterProps.push({ org_id: org.id, cluster_id: id, property_id: p.id });
    }
  }

  const { error: clErr } = await sb.from('clusters').insert(clusters);
  if (clErr) throw clErr;
  const { error: cpErr } = await sb.from('cluster_properties').insert(clusterProps);
  if (cpErr) throw cpErr;

  // Interactions + followups (seeded history)
  const now = Date.now();
  const interactions: any[] = [];
  const followups: any[] = [];

  const outcomes = ['no_answer', 'lead', 'quote', 'sold', 'do_not_knock'];

  for (let i = 0; i < 160; i++) {
    const p = clusterable[i];
    const rep = repList[i % repList.length];
    const outcome = outcomes[i % outcomes.length];
    const created_at = new Date(now - i * 1000 * 60 * 60 * 6).toISOString();
    const followup_at = outcome === 'lead' || outcome === 'quote' ? new Date(now + (i % 7) * DAY_MS).toISOString() : null;

    interactions.push({
      org_id: org.id,
      rep_id: rep.id,
      property_id: p.id,
      outcome,
      notes: outcome === 'no_answer' ? 'Left a flyer' : outcome === 'lead' ? 'Interested — follow up after work' : null,
      followup_at,
      created_at
    });

    if (followup_at && i % 3 === 0) {
      followups.push({
        org_id: org.id,
        rep_id: rep.id,
        property_id: p.id,
        due_at: followup_at,
        status: i % 2 === 0 ? 'open' : 'done',
        notes: 'Text customer around 5pm'
      });
    }
  }

  const { error: iErr } = await sb.from('interactions').insert(interactions);
  if (iErr) throw iErr;

  if (followups.length) {
    const { error: fErr } = await sb.from('followups').insert(followups);
    if (fErr) throw fErr;
  }

  // Sales (enough for analytics + jobs)
  const salesRows: any[] = [];
  const soldSaleIds: string[] = [];

  for (let i = 0; i < 28; i++) {
    const rep = repList[i % repList.length];
    const p = clusterable[80 + i];
    const status = i % 5 === 0 ? 'sold' : i % 2 === 0 ? 'quote' : 'lead';
    const price = Math.round(249 + rand(290));
    const created_at = new Date(now - (i + 1) * DAY_MS).toISOString();

    const id = randomUUID();
    salesRows.push({
      id,
      org_id: org.id,
      rep_id: rep.id,
      property_id: p.id,
      price,
      service_type: i % 2 === 0 ? 'pressure_wash' : 'soft_wash',
      notes: 'Seeded sale record',
      customer_phone: `+1555123${String(1000 + i)}`,
      status,
      created_at
    });
    if (status === 'sold') soldSaleIds.push(id);
  }

  const { error: sErr } = await sb.from('sales').insert(salesRows);
  if (sErr) throw sErr;

  // Jobs + attachments + payments
  const soldTwo = soldSaleIds.slice(0, 2);
  const jobIds: string[] = [];

  const jobs: any[] = soldTwo.map((saleId, idx) => {
    const start = new Date(now + (idx + 1) * DAY_MS);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const complete = idx === 0;
    const id = randomUUID();
    jobIds.push(id);
    return {
      id,
      org_id: org.id,
      sale_id: saleId,
      laborer_id: laborer.id,
      status: complete ? 'complete' : 'scheduled',
      scheduled_start: start.toISOString(),
      scheduled_end: end.toISOString(),
      started_at: complete ? new Date(now - 6 * 60 * 60 * 1000).toISOString() : null,
      completed_at: complete ? new Date(now - 2 * 60 * 60 * 1000).toISOString() : null,
      completion_notes: complete ? 'Completed — great access, no issues.' : null
    };
  });

  const { error: jErr } = await sb.from('jobs').insert(jobs);
  if (jErr) throw jErr;

  // Seed attachments (placeholders; UI should show placeholders / handle missing files gracefully)
  const attachments: any[] = [];
  for (const saleId of soldTwo) {
    attachments.push(
      { org_id: org.id, sale_id: saleId, type: 'photo_before', storage_path: `seed/${saleId}/before-1.jpg` },
      { org_id: org.id, sale_id: saleId, type: 'photo_before', storage_path: `seed/${saleId}/before-2.jpg` },
      { org_id: org.id, sale_id: saleId, type: 'photo_after', storage_path: `seed/${saleId}/after-1.jpg` }
    );
  }
  const { error: aErr } = await sb.from('sale_attachments').insert(attachments);
  if (aErr) throw aErr;

  // One paid, one pending
  const payments = [
    {
      org_id: org.id,
      job_id: jobIds[0],
      amount: 34900,
      status: 'paid',
      stripe_checkout_session_id: `cs_test_seed_${suffix}_paid`,
      checkout_url: 'https://checkout.stripe.com/pay/cs_test_seed_paid'
    },
    {
      org_id: org.id,
      job_id: jobIds[1],
      amount: 29900,
      status: 'pending',
      stripe_checkout_session_id: `cs_test_seed_${suffix}_pending`,
      checkout_url: 'https://checkout.stripe.com/pay/cs_test_seed_pending'
    }
  ];
  const { error: payErr } = await sb.from('payments').insert(payments);
  if (payErr) throw payErr;

  // Messaging threads (3 threads, with activity)
  const threads: any[] = [];
  for (let i = 0; i < 3; i++) {
    const rep = repList[i % repList.length];
    const p = clusterable[20 + i];
    threads.push({
      org_id: org.id,
      rep_id: rep.id,
      customer_phone: `+15550001${i}11`,
      property_id: p.id,
      last_message_at: new Date(now - i * 60 * 60 * 1000).toISOString()
    });
  }
  const { data: insertedThreads, error: thErr } = await sb.from('message_threads').insert(threads).select('*');
  if (thErr) throw thErr;

  const msgs: any[] = [];
  for (const [idx, t] of (insertedThreads || []).entries()) {
    msgs.push(
      {
        org_id: org.id,
        thread_id: t.id,
        direction: 'outbound',
        body: idx === 0 ? 'Hey — we’re nearby today. Want a quick wash quote?' : 'Hi! We can quote in 5 minutes. Interested?',
        status: 'sent',
        sent_at: new Date(now - idx * 60 * 1000).toISOString()
      },
      {
        org_id: org.id,
        thread_id: t.id,
        direction: 'inbound',
        body: idx === 2 ? 'Can you come this weekend?' : 'What’s the typical price?',
        status: 'received',
        sent_at: new Date(now - idx * 60 * 1000 + 30 * 1000).toISOString()
      }
    );
  }
  const { error: mErr } = await sb.from('messages').insert(msgs);
  if (mErr) throw mErr;

  // Daily stats (last 21 days) so charts / leaderboards populate
  const days = 21;
  const daily: any[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.now() - d * DAY_MS);
    const dayStr = dayISO(day);

    for (const rep of repList) {
      const baseDoors = 55 + Math.round(rand(40));
      const leads = Math.max(0, Math.round(baseDoors * (0.10 + rand(0.10))));
      const quotes = Math.max(0, Math.round(leads * (0.35 + rand(0.25))));
      const sold = Math.max(0, Math.round(quotes * (0.35 + rand(0.25))));
      const revenue = sold * (260 + Math.round(rand(220)));
      const hours = 2.2 + rand(2.6);

      daily.push({
        org_id: org.id,
        rep_id: rep.id,
        day: dayStr,
        doors_knocked: baseDoors,
        leads,
        quotes,
        sold,
        revenue,
        hours_worked: Number(hours.toFixed(2))
      });
    }
  }
  const { error: dErr } = await sb.from('daily_stats').insert(daily);
  if (dErr) throw dErr;

  // Rep locations (so map has dots)
  const locs = repList.map((rep, idx) => ({
    org_id: org.id,
    rep_id: rep.id,
    lat: rep.home_lat + (idx === 0 ? 0.01 : -0.01),
    lng: rep.home_lng + (idx === 1 ? 0.01 : -0.008),
    speed: 0,
    heading: null,
    clocked_in: idx !== 2,
    recorded_at: new Date().toISOString()
  }));
  await sb.from('rep_locations').insert(locs);

  // Labor availability
  await sb.from('labor_availability').insert([
    { org_id: org.id, laborer_id: laborer.id, day_of_week: 1, start_time: '08:00', end_time: '17:00' },
    { org_id: org.id, laborer_id: laborer.id, day_of_week: 2, start_time: '08:00', end_time: '17:00' },
    { org_id: org.id, laborer_id: laborer.id, day_of_week: 3, start_time: '08:00', end_time: '17:00' },
    { org_id: org.id, laborer_id: laborer.id, day_of_week: 4, start_time: '08:00', end_time: '17:00' },
    { org_id: org.id, laborer_id: laborer.id, day_of_week: 5, start_time: '08:00', end_time: '15:00' }
  ]);

  console.log('\n✅ Seed complete (dev)');
  console.log('Org:', orgName, org.id);
  console.log('Cluster Set:', cs.name, cs.id);
  console.log('--- Credentials (dev only) ---');
  console.log('Admin:', adminEmail, password);
  console.log('Manager:', managerEmail, password);
  console.log('Rep Aaron:', aaronEmail, password);
  console.log('Rep Stephen:', stephenEmail, password);
  console.log('Rep Jamison:', jamisonEmail, password);
  console.log('Labor:', laborEmail, password);
  console.log('---');
  console.log('Web login: use Admin or Manager email + password above. Ensure API .env SUPABASE_URL matches:', SUPABASE_URL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
