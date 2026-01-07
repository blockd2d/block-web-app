import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { propertySearch, getPropertyData } from '../modules/attom/attom.controller.ts';

const prisma = new PrismaClient();

// ATTOM rate guidance ~200 calls/min. Keep detail calls throttled.
const DETAIL_CALL_DELAY_MS = 350;

// Hendricks County geoIdV4
const GEO_ID_V4 = 'f54b1b07afd4de52f27b5edf15ae972f';
const PAGE_SIZE = 50;

// Hard safety in case totals are missing / odd
const MAX_PAGES_FALLBACK = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toStreetName(line1?: string): string {
  return (line1 ?? 'Unknown Street').replace(/\d+/g, '').trim() || 'Unknown Street';
}

function toMainAddress(line1?: string, line2?: string): string {
  const a = (line1 ?? '').trim();
  const b = (line2 ?? '').trim();
  return [a, b].filter(Boolean).join(', ') || 'Unknown Address';
}

// Snapshot sometimes uses summary.proptype; basic profile uses summary.propType.
// We’ll accept either for safety.
function isSfr(prop: any): boolean {
  const t1 = prop?.summary?.proptype;
  const t2 = prop?.summary?.propType;
  const val = (t1 ?? t2 ?? '').toString().toUpperCase();
  return val === 'SFR';
}

function pickNeighborhood(basic: any): string {
  return basic?.property?.[0]?.area?.subdName || 'Unknown Neighborhood';
}

/**
 * Property value priority:
 * 1) last sale amount (sale.saleAmountData.saleAmt)
 * 2) market total value (assessment.market.mktTtlValue)
 * 3) assessed total value (assessment.assessed.assdTtlValue)
 * 4) 0
 */
function pickPropertyValue(basic: any): number {
  const p = basic?.property?.[0];
  const saleAmt = p?.sale?.saleAmountData?.saleAmt;
  if (typeof saleAmt === 'number' && Number.isFinite(saleAmt)) return saleAmt;

  const mkt = p?.assessment?.market?.mktTtlValue;
  if (typeof mkt === 'number' && Number.isFinite(mkt)) return mkt;

  const assd = p?.assessment?.assessed?.assdTtlValue;
  if (typeof assd === 'number' && Number.isFinite(assd)) return assd;

  return 0;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  let lastErr: unknown;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const backoff = 400 * i * i; // 400ms, 1600ms, 3600ms
      console.warn(`[${label}] attempt ${i}/${attempts} failed. Backing off ${backoff}ms.`);
      await sleep(backoff);
    }
  }

  throw lastErr;
}

async function clearGlobalHouses() {
  await prisma.globalHouses.deleteMany({});
  console.log('Cleared GlobalHouses table.');
}

async function processSnapshotPage(attomData: any, pageNum: number) {
  const list: any[] = attomData?.property ?? [];
  if (list.length === 0) {
    console.log(`Page ${pageNum}: 0 properties returned.`);
    return 0;
  }

  let savedOnPage = 0;

  for (const prop of list) {
    if (!isSfr(prop)) continue;

    const attomId = prop?.identifier?.attomId; // number
    const line1 = prop?.address?.line1;        // "10634 CYRUS DR"
    const line2 = prop?.address?.line2;        // "INDIANAPOLIS, IN 46231"

    if (!attomId || !line1 || !line2) continue;

    const latitude = Number.parseFloat(prop?.location?.latitude ?? '0') || 0;
    const longitude = Number.parseFloat(prop?.location?.longitude ?? '0') || 0;

    // Enrich via /property/basicprofile through your controller wrapper
    const basic = await withRetry(
      () => getPropertyData(line1, line2),
      `basicprofile-${attomId}`
    );

    const neighborhood = pickNeighborhood(basic);
    const propertyValue = pickPropertyValue(basic);

    const address = toMainAddress(line1, line2);
    const streetName = toStreetName(line1);

    // IMPORTANT: Do NOT set `id`. Supabase/Prisma will generate UUID.
    // Also, schema defines `houseId` as Float, so store the ATTOM id as a number.
    await prisma.globalHouses.create({
      data: {
        houseId: Number(attomId),
        address,
        latitude,
        longitude,
        neighborhood,
        visitDurationMinutes: 0,
        status: 'ACTIVE',
        streetName,
        propertyValue,
      },
    });

    savedOnPage++;

    // Throttle detail calls
    await sleep(DETAIL_CALL_DELAY_MS);
  }

  return savedOnPage;
}

async function pullCounty() {
  let totalSaved = 0;

  // Page 1 first to compute total pages if status.total exists
  const first = await withRetry(
    () =>
      propertySearch({
        geoIdV4: GEO_ID_V4,
        pagesize: PAGE_SIZE,
        page: 1,
      }),
    'snapshot-page-1'
  );

  const total = first?.status?.total;
  const pagesize = first?.status?.pagesize ?? PAGE_SIZE;
  const computedPages =
    typeof total === 'number' && total > 0 ? Math.ceil(total / pagesize) : null;

  const lastPage = computedPages ?? MAX_PAGES_FALLBACK;

  console.log(
    `Snapshot paging: total=${typeof total === 'number' ? total : 'unknown'} pagesize=${pagesize} pages=${lastPage}`
  );

  // Process page 1
  const saved1 = await processSnapshotPage(first, 1);
  totalSaved += saved1;
  console.log(`Finished page 1/${lastPage} | page saved: ${saved1} | total saved: ${totalSaved}`);

  // Remaining pages
  for (let page = 2; page <= lastPage; page++) {
    const attomData = await withRetry(
      () =>
        propertySearch({
          geoIdV4: GEO_ID_V4,
          pagesize: PAGE_SIZE,
          page,
        }),
      `snapshot-page-${page}`
    );

    const savedOnPage = await processSnapshotPage(attomData, page);
    totalSaved += savedOnPage;

    console.log(
      `Finished page ${page}/${lastPage} | page saved: ${savedOnPage} | total saved: ${totalSaved}`
    );

    // If ATTOM stops returning results and we didn't have a reliable total, stop early
    if (!computedPages && (!attomData?.property || attomData.property.length === 0)) {
      console.log(`No results on page ${page}; stopping early (no total provided).`);
      break;
    }
  }

  console.log(`Done. Total houses saved: ${totalSaved}`);
}

async function main() {
  await prisma.$connect();
  try {
    // You said you'll clear Supabase first; this does it automatically:
    await clearGlobalHouses();
    await pullCounty();
  } catch (err) {
    console.error('County pull failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
