/* eslint-disable no-console */
/**
 * Import Hendricks County Regrid-format CSV into properties for Nova Services.
 *
 * Usage:
 *   Set HENDRICKS_CSV_PATH to the local CSV path (or pass as first arg).
 *   Optionally: HENDRICKS_VALUE_COLUMN=parval (default), ORG_ID=<uuid> to override org lookup.
 *   Optionally: --replace to delete existing properties for that org+county before import.
 *
 *   From apps/api: pnpm run import:hendricks
 *   Or: HENDRICKS_CSV_PATH=./hendricks.csv tsx src/scripts/import-hendricks-properties.ts [--replace]
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BATCH_SIZE = 800;
const LOG_EVERY = 5000;
const RETRIES = 3;

// --- Env and Supabase ---
const rawUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!rawUrl || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in apps/api/.env)');
  process.exit(1);
}

function supabaseApiUrl(from: string): string {
  if (from.startsWith('https://')) return from;
  const m = from.match(/@db\.([^.]+)\.supabase\.co/);
  if (m) return `https://${m[1]}.supabase.co`;
  return from;
}

const supabaseUrl = supabaseApiUrl(rawUrl);
const sb: SupabaseClient = createClient(supabaseUrl, serviceKey);

// --- Helpers ---
function get(row: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

function getNum(row: Record<string, string>, ...keys: string[]): number | null {
  const v = get(row, ...keys);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildAddress(row: Record<string, string>): string {
  const parts: string[] = [];
  const dir = get(row, 'direction', 'mail_street_dir');
  const num = get(row, 'mail_house_number');
  const street = get(row, 'street', 'mail_street');
  const suffix = get(row, 'suffix', 'mail_street_suffix');
  if (num) parts.push(num);
  if (dir) parts.push(dir);
  if (street) parts.push(street);
  if (suffix) parts.push(suffix);
  if (parts.length) return parts.join(' ').trim();
  const parcel = get(row, 'parcelnumb');
  if (parcel) return `Parcel ${parcel}`;
  return 'Unknown';
}

async function withRetries<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) {
        const ms = 500 * Math.pow(2, attempt);
        console.warn(`[retry] ${label} failed, retry in ${ms}ms...`);
        await new Promise((r) => setTimeout(r, ms));
      }
    }
  }
  throw lastErr;
}

async function main() {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const csvPathArg = args.find((a) => a !== '--replace');
  const csvPath = process.env.HENDRICKS_CSV_PATH || csvPathArg;
  if (!csvPath) {
    console.error('Provide HENDRICKS_CSV_PATH or pass CSV path as first argument.');
    process.exit(1);
  }
  const absPath = path.resolve(csvPath);
  if (!fs.existsSync(absPath)) {
    console.error('CSV file not found:', absPath);
    process.exit(1);
  }

  const valueColumn = (process.env.HENDRICKS_VALUE_COLUMN || 'parval').trim();
  const orgIdOverride = process.env.ORG_ID?.trim();

  console.log('CSV path:', absPath);
  console.log('Value column for value_estimate:', valueColumn);
  console.log('Replace existing (org+county):', replace);

  // 1) Resolve org
  let orgId: string;
  if (orgIdOverride) {
    const { data: org, error: e } = await sb.from('organizations').select('id').eq('id', orgIdOverride).single();
    if (e || !org) {
      console.error('ORG_ID not found:', orgIdOverride);
      process.exit(1);
    }
    orgId = org.id;
    console.log('Using org_id from ORG_ID:', orgId);
  } else {
    const { data: orgs, error: e } = await sb
      .from('organizations')
      .select('id')
      .ilike('name', 'Nova Services')
      .limit(1);
    if (e || !orgs?.length) {
      console.error('Organization "Nova Services" not found. Set ORG_ID or create the org first.');
      process.exit(1);
    }
    orgId = orgs[0].id;
    console.log('Resolved Nova Services org_id:', orgId);
  }

  // 2) Ensure Hendricks county
  const { data: existingCounties } = await sb
    .from('counties')
    .select('id')
    .eq('org_id', orgId)
    .ilike('name', 'Hendricks%')
    .limit(1);
  let countyId: string;
  if (existingCounties?.length) {
    countyId = existingCounties[0].id;
    console.log('Using existing Hendricks county_id:', countyId);
  } else {
    const { data: inserted, error: insErr } = await sb
      .from('counties')
      .insert({ org_id: orgId, name: 'Hendricks', state: 'IN' })
      .select('id')
      .single();
    if (insErr || !inserted) {
      console.error('Failed to create Hendricks county:', insErr);
      process.exit(1);
    }
    countyId = inserted.id;
    console.log('Created Hendricks county_id:', countyId);
  }

  if (replace) {
    const { error: delErr } = await sb.from('properties').delete().eq('org_id', orgId).eq('county_id', countyId);
    if (delErr) {
      console.error('Failed to delete existing properties:', delErr);
      process.exit(1);
    }
    console.log('Deleted existing properties for this org+county.');
  }

  // 3) Stream CSV and batch insert
  const parser = fs.createReadStream(absPath).pipe(
    parse({
      columns: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    })
  );

  let processed = 0;
  let insertedTotal = 0;
  let skipped = 0;
  const batch: Array<{
    org_id: string;
    county_id: string;
    lat: number;
    lng: number;
    address1: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    value_estimate: number | null;
    tags: null;
  }> = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    const current = [...batch];
    batch.length = 0;
    await withRetries(
      async () => {
        const { error } = await sb.from('properties').insert(current);
        if (error) throw error;
      },
      `insert batch of ${current.length}`
    );
    insertedTotal += current.length;
  };

  // CSV may have varying header casing; normalize to lowercase keys for lookups
  const normalizeRow = (record: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(record)) {
      if (v != null) out[k.trim().toLowerCase().replace(/\s+/g, '_')] = String(v);
    }
    return out;
  };

  try {
    for await (const record of parser) {
      const row = normalizeRow(record as Record<string, string>);
      const lat = getNum(row, 'lat');
      const lon = getNum(row, 'lon', 'lng');
      if (lat == null || lon == null) {
        skipped += 1;
        continue;
      }
      const address1 = buildAddress(row);
      const city = get(row, 'city', 'mail_city');
      const state = get(row, 'mail_state2', 'state') || 'IN';
      const zip = get(row, 'szip', 'szip5', 'mail_zip');
      const valueRaw = getNum(row, valueColumn, valueColumn.toLowerCase());
      const value_estimate = valueRaw != null ? valueRaw : null;

      batch.push({
        org_id: orgId,
        county_id: countyId,
        lat,
        lng: lon,
        address1: address1 || null,
        city,
        state,
        zip,
        value_estimate,
        tags: null,
      });
      processed += 1;

      if (processed % LOG_EVERY === 0) {
        console.log(`[progress] processed=${processed.toLocaleString()} inserted=${insertedTotal.toLocaleString()} skipped=${skipped}`);
      }

      if (batch.length >= BATCH_SIZE) await flushBatch();
    }
    await flushBatch();
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }

  console.log(`[done] processed=${processed.toLocaleString()} inserted=${insertedTotal.toLocaleString()} skipped=${skipped}`);
}

main();
