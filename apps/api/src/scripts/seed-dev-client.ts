/* eslint-disable no-console */
import 'dotenv/config';
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in apps/api/.env)');
  process.exit(1);
}

// .env may have Postgres URL; Supabase JS needs the HTTPS project URL
function supabaseApiUrl(from: string): string {
  if (from.startsWith('https://')) return from;
  const m = from.match(/@db\.([^.]+)\.supabase\.co/);
  if (m) return `https://${m[1]}.supabase.co`;
  return from;
}
const SUPABASE_URL = supabaseApiUrl(rawUrl);

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const DEFAULT_PASSWORD = 'Password123!';

function question(prefix: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prefix, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getOrCreateUser(email: string, password: string): Promise<{ id: string; email: string }> {
  const key = email.toLowerCase();
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === key);
  if (existing) return { id: existing.id, email: existing.email ?? email };

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error) throw error;
  const user = data.user!;
  return { id: user.id, email: user.email ?? email };
}

async function main() {
  console.log('Add a new client (org + admin + manager + rep + labor)\n');

  const orgName = await question('Organization name: ');
  if (!orgName) {
    console.error('Organization name is required.');
    process.exit(1);
  }

  const adminEmail = await question('Admin email: ');
  const managerEmail = await question('Manager email: ');
  const repEmail = await question('Rep email: ');
  const laborEmail = await question('Labor email: ');
  const passwordInput = await question('Password (leave empty for ' + DEFAULT_PASSWORD + '): ');
  const password = passwordInput || DEFAULT_PASSWORD;

  const required = [
    { label: 'Admin email', value: adminEmail },
    { label: 'Manager email', value: managerEmail },
    { label: 'Rep email', value: repEmail },
    { label: 'Labor email', value: laborEmail }
  ];
  for (const { label, value } of required) {
    if (!value) {
      console.error(label + ' is required.');
      process.exit(1);
    }
  }

  console.log('\nCreating organization and accounts...');

  const { data: org, error: orgErr } = await sb
    .from('organizations')
    .insert({ name: orgName })
    .select('*')
    .single();
  if (orgErr) throw orgErr;

  const { error: settingsErr } = await sb.from('org_settings').insert({
    org_id: org.id,
    twilio_number: null
  });
  if (settingsErr) throw settingsErr;

  // Default county: Hendricks (so org can create cluster sets and import properties for this county).
  // To get properties in cluster generation or draw zones, run: ORG_ID=<org.id> pnpm run import:hendricks
  const { data: county, error: countyErr } = await sb
    .from('counties')
    .insert({ org_id: org.id, name: 'Hendricks', state: 'IN' })
    .select('id')
    .single();
  if (countyErr) throw countyErr;
  console.log('County: Hendricks (IN) created for org');

  // One Auth user per unique email (reuse if email already exists)
  const emails = [adminEmail, managerEmail, repEmail, laborEmail];
  const roles = ['admin', 'manager', 'rep', 'labor'] as const;
  const names = ['Admin', 'Manager', 'Rep', 'Labor'];
  const uniqueEmails = [...new Set(emails)];
  const userByEmail = new Map<string, { id: string; email: string }>();
  for (const email of uniqueEmails) {
    const user = await getOrCreateUser(email, password);
    userByEmail.set(email.toLowerCase(), user);
  }

  const adminUser = userByEmail.get(adminEmail.toLowerCase())!;
  const managerUser = userByEmail.get(managerEmail.toLowerCase())!;
  const repUser = userByEmail.get(repEmail.toLowerCase())!;
  const laborUser = userByEmail.get(laborEmail.toLowerCase())!;

  // One profile per unique user; role = first role that user is assigned
  const seenIds = new Set<string>();
  const profiles: { id: string; org_id: string; role: string; name: string; email: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const user = userByEmail.get(emails[i].toLowerCase())!;
    if (seenIds.has(user.id)) continue;
    seenIds.add(user.id);
    profiles.push({
      id: user.id,
      org_id: org.id,
      role: roles[i],
      name: names[i],
      email: user.email
    });
  }
  const { error: profErr } = await sb.from('profiles').insert(profiles);
  if (profErr) throw profErr;

  const { error: repErr } = await sb.from('reps').insert({
    org_id: org.id,
    profile_id: repUser.id,
    name: 'Rep',
    home_lat: 0,
    home_lng: 0
  });
  if (repErr) throw repErr;

  const { error: laborErr } = await sb.from('laborers').insert({
    org_id: org.id,
    profile_id: laborUser.id,
    name: 'Labor'
  });
  if (laborErr) throw laborErr;

  console.log('\n--- Client created ---');
  console.log('Org:', orgName, '(' + org.id + ')');
  console.log('County: Hendricks (IN) – id', county.id);
  console.log('Password (all accounts):', passwordInput ? '(as entered)' : DEFAULT_PASSWORD + ' (default)');
  console.log('Admin:', adminEmail);
  console.log('Manager:', managerEmail);
  console.log('Rep:', repEmail);
  console.log('Labor:', laborEmail);
  console.log('---');
  console.log('Web login: use any of the emails above with the password. Ensure API .env SUPABASE_URL matches:', SUPABASE_URL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
