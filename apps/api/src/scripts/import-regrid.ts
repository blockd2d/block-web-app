// scripts/import-regrid.ts
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse";

process.env.DATABASE_URL =
  "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Config
 */
const CSV_PATH = "/hendricks-regid.csv";
if (!CSV_PATH) throw new Error("Missing CSV_PATH env var");

const BATCH_SIZE = 500; // requested default
const MAX_PAYLOAD_MB = 5; // 4–6 MB guard
const MAX_PAYLOAD_BYTES = Math.floor(MAX_PAYLOAD_MB * 1024 * 1024);
const LOG_EVERY = 5000;
const MAX_PARAMS = 50000; // protect Postgres bind-param limit
const RETRIES = 3;

const INT_HEADERS = new Set<string>([
  "usecode",
  "zoning_id",
  "struct",
  "yearbuilt",
  "year_built_effective_date",
  "numstories",
  "numunits",
  "numrooms",
  "num_bath",
  "num_bath_partial",
  "num_bedrooms",
  "improvval",
  "landval",
  "parval",
  "agval",
  "saleprice",
  "taxyear",
  "taxamt",
  "cdl_date",
  "ll_address_count",
  "area_building",
  "ll_gissqft",
  "ll_bldg_footprint_sqft",
  "ll_bldg_count",
  "lbcs_activity",
  "prior_av_total_land",
  "prior_av_total_improvements",
  "av_land_elig_1pct_cb_cap",
  "av_impr_elig_1pct_cb_cap",
  "av_n_home_res_land_2pct_cb_cap",
  "av_n_home_res_impr_2pct_cb_cap",
  "av_comm_apt_land_2pct_cb_cap",
  "av_comm_apt_impr_2pct_cb_cap",
  "av_ltc_fac_land_2pct_cb_cap",
  "av_ltc_fac_impr_2pct_cb_cap",
  "av_farmland_2pct_cb_cap",
  "av_mob_home_land_2pct_cb_cap",
  "av_land_3pct_cb_cap",
  "av_impr_3pct_cb_cap",
  "av_classified_land",
]);

const FLOAT_HEADERS = new Set<string>([
  "lat",
  "lon",
  "deeded_acres",
  "gisacre",
  "ll_gisacre",
  "cdl_majority_percent",
  "population_density",
  "population_growth_past_5_years",
  "population_growth_next_5_years",
  "housing_growth_past_5_years",
  "housing_growth_next_5_years",
  "household_income_growth_next_5_years",
  "highest_parcel_elevation",
  "lowest_parcel_elevation",
  "neighborhood_factor",
  "annual_adjustment_factor_land",
  "annual_adjustment_factor_impr",
  "adjustment_factor_applied",
]);

const DATE_HEADERS = new Set<string>([
  "saledate",
  "last_ownership_transfer_date",
  "fema_flood_zone_data_date",
  "ll_last_refresh",
  "ll_updated_at",
  "usps_vacancy_date",
  "loaddate",
  "appraisal_date",
]);

/**
 * Convert CSV header -> Prisma field name (camelCase, safe identifier).
 * Must match schema generation behavior.
 */
function headerToField(header: string): string {
  const cleaned = header.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!cleaned) return "col";
  const parts = cleaned.split("_");
  const first = parts[0].toLowerCase();
  const rest = parts.slice(1).map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ""));
  let name = first + rest.join("");
  if (/^\d/.test(name)) name = "c" + name;
  // Avoid obvious Prisma schema keywords (rare for CSV headers)
  if (["model", "enum", "datasource", "generator", "type"].includes(name)) name = name + "Field";
  return name;
}

function normalize(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s.length === 0 ? null : s;
}

function parseIntOrNull(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  // Prisma Int is 32-bit signed. Keep within safe bounds.
  if (i > 2147483647 || i < -2147483648) return null;
  return i;
}

function parseFloatOrNull(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Parses:
 * - YYYY/MM/DD
 * - M/D/YYYY
 * - YYYY/MM/DD HH:mm:ss(.SSS)?(+|-)HH
 */
function parseDateOrNull(raw: string | null): Date | null {
  if (raw === null) return null;
  const t = raw.trim();

  // YYYY/MM/DD
  let m = t.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));

  // M/D/YYYY
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));

  // YYYY/MM/DD HH:mm:ss(.sss)?(+|-)HH
  m = t.match(
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})(\.\d+)?([+-]\d{2})$/
  );
  if (m) {
    const Y = m[1];
    const Mo = m[2].padStart(2, "0");
    const D = m[3].padStart(2, "0");
    const H = m[4].padStart(2, "0");
    const Mi = m[5];
    const S = m[6];
    const ms = m[7] ?? "";
    const off = m[8]; // e.g. +00
    const iso = `${Y}-${Mo}-${D}T${H}:${Mi}:${S}${ms}${off}:00`;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // last-ditch fallback
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function estimateRowBytes(row: Record<string, unknown>): number {
  // lightweight estimate to avoid JSON.stringify in hot path
  let bytes = 2;
  for (const [k, v] of Object.entries(row)) {
    bytes += k.length + 4;
    if (v === null || v === undefined) bytes += 4;
    else if (typeof v === "string") bytes += v.length + 2;
    else bytes += 16;
  }
  return bytes;
}

async function withRetries<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt <= RETRIES) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt += 1;
      if (attempt > RETRIES) break;

      const backoffMs = 250 * Math.pow(2, attempt - 1);
      console.warn(`[retry] ${label} failed (attempt ${attempt}/${RETRIES}). Backing off ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  throw lastErr;
}

async function main() {
  const abs = path.resolve(CSV_PATH);
  console.log(`CSV_PATH: ${abs}`);
  console.log(`BATCH_SIZE requested: ${BATCH_SIZE}`);
  console.log(`MAX_PAYLOAD_MB: ${MAX_PAYLOAD_MB} (~${MAX_PAYLOAD_BYTES} bytes)`);
  console.log(`MAX_PARAMS: ${MAX_PARAMS}`);
  console.log(`Model: RegridParcelsHendricksIn (unique: ll_uuid)`);

  const parser = fs.createReadStream(abs).pipe(
    parse({
      columns: true,
      bom: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: false,
    })
  );

  let processed = 0;
  let insertedTotal = 0;

  let batch: Record<string, unknown>[] = [];
  let batchBytes = 0;
  let batchParams = 0;

  let colInfo: { header: string; field: string; kind: "int" | "float" | "date" | "string" }[] | null =
    null;

  async function flushBatch() {
    if (batch.length === 0) return;

    const current = batch;
    batch = [];
    batchBytes = 0;
    batchParams = 0;

    const res = await withRetries(
      () =>
        prisma.regridParcelsHendricksIn.createMany({
          data: current as any,
          skipDuplicates: true,
        }),
      `createMany(batchSize=${current.length})`
    );

    insertedTotal += (res as any).count ?? 0;
  }

  const failuresPath = path.resolve(process.cwd(), "regrid_import_failures.jsonl");
  const failures = fs.createWriteStream(failuresPath, { flags: "a" });

  try {
    for await (const record of parser) {
      if (!colInfo) {
        const headers = Object.keys(record);
        colInfo = headers.map((h) => {
          const kind: "int" | "float" | "date" | "string" =
            INT_HEADERS.has(h) ? "int" : FLOAT_HEADERS.has(h) ? "float" : DATE_HEADERS.has(h) ? "date" : "string";
          return { header: h, field: headerToField(h), kind };
        });

        if (!headers.includes("ll_uuid")) {
          throw new Error(`CSV is missing required unique column "ll_uuid"`);
        }

        console.log(`Detected ${headers.length} CSV columns.`);
      }

      const ll = normalize(record["ll_uuid"]);
      if (!ll) {
        // skip row if somehow missing unique key
        failures.write(JSON.stringify({ reason: "missing_ll_uuid", record }) + "\n");
        continue;
      }

      const row: Record<string, unknown> = {
        llUuid: ll,
      };

      // Populate only non-null fields to reduce bind params and payload
      for (const c of colInfo) {
        if (c.header === "ll_uuid") continue;
        const raw = normalize(record[c.header]);
        if (raw === null) continue;

        if (c.kind === "int") {
          const v = parseIntOrNull(raw);
          if (v !== null) row[c.field] = v;
        } else if (c.kind === "float") {
          const v = parseFloatOrNull(raw);
          if (v !== null) row[c.field] = v;
        } else if (c.kind === "date") {
          const v = parseDateOrNull(raw);
          if (v !== null) row[c.field] = v;
        } else {
          // string: preserve exactly (trimmed); do NOT coerce scientific notation
          row[c.field] = raw;
        }
      }

      batch.push(row);
      batchBytes += estimateRowBytes(row);
      batchParams += Object.keys(row).length;
      processed += 1;

      if (processed % LOG_EVERY === 0) {
        console.log(`[progress] processed=${processed.toLocaleString()} inserted≈${insertedTotal.toLocaleString()}`);
      }

      // Flush guards:
      // 1) row count
      // 2) payload size
      // 3) bind parameter count (very important with 235 columns)
      if (batch.length >= BATCH_SIZE || batchBytes >= MAX_PAYLOAD_BYTES || batchParams >= MAX_PARAMS) {
        await flushBatch();
      }
    }

    await flushBatch();
    console.log(`[done] processed=${processed.toLocaleString()} inserted=${insertedTotal.toLocaleString()}`);
    console.log(`[failures] (if any) appended to ${failuresPath}`);
  } finally {
    failures.end();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
