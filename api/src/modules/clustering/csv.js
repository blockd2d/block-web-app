import { parse } from 'csv-parse';

export async function parseCsvBuffer(buf) {
  return new Promise((resolve, reject) => {
    const records = [];
    parse(buf, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true },
      (err, output) => {
        if (err) return reject(err);
        resolve(output);
      }
    );
  });
}

export function coerceNumber(v) {
  if (v === null || v === undefined) return NaN;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : NaN;
}
