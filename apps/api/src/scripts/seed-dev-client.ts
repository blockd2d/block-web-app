/* eslint-disable no-console */
import { createInterface } from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in apps/api/.env)');
  process.exit(1);
}

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

async function createUser(email: string, password: string) {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error) throw error;
  return data.user!;
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
    twilio_number: null,
    outbound_sms_enabled: false
  });
  if (settingsErr) throw settingsErr;

  const [adminUser, managerUser, repUser, laborUser] = await Promise.all([
    createUser(adminEmail, password),
    createUser(managerEmail, password),
    createUser(repEmail, password),
    createUser(laborEmail, password)
  ]);

  const profiles = [
    { id: adminUser.id, org_id: org.id, role: 'admin', name: 'Admin', email: adminEmail },
    { id: managerUser.id, org_id: org.id, role: 'manager', name: 'Manager', email: managerEmail },
    { id: repUser.id, org_id: org.id, role: 'rep', name: 'Rep', email: repEmail },
    { id: laborUser.id, org_id: org.id, role: 'labor', name: 'Labor', email: laborEmail }
  ];
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
