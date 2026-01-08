export function fmtNumber(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n);
}

export function fmtCurrency(n: number | null | undefined, currency = 'USD') {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export function fmtPercent(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export type TimeRange = 'week' | 'month' | 'all';

export function rangeLabel(r: TimeRange) {
  if (r === 'week') return 'This week';
  if (r === 'month') return 'This month';
  return 'All time';
}
