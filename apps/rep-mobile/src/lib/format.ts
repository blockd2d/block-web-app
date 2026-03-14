import type { KnockOutcome, QuoteStatus, SyncState } from "../types";

export function formatKnockOutcome(outcome: KnockOutcome | null | undefined) {
  switch (outcome) {
    case "no_answer":
      return "No answer";
    case "not_interested":
      return "Not interested";
    case "interested":
      return "Interested";
    case "estimated":
      return "Estimated";
    case "booked":
      return "Booked";
    default:
      return "—";
  }
}

export function formatQuoteStatus(status: QuoteStatus | null | undefined) {
  switch (status) {
    case "draft":
      return "Draft";
    case "estimated":
      return "Estimated";
    case "booked":
      return "Booked";
    default:
      return "—";
  }
}

export function formatSyncState(state: SyncState | null | undefined) {
  switch (state) {
    case "pending":
      return "Pending sync";
    case "syncing":
      return "Syncing";
    case "failed":
      return "Sync failed";
    case "synced":
      return "Synced";
    default:
      return "";
  }
}

export function parseIsoDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function formatTimeShort(value: string | Date | null | undefined) {
  const d = parseIsoDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatClusterSchedule(
  scheduledStart: string | null | undefined,
  scheduledEnd?: string | null | undefined,
  options?: { includeDate?: boolean; fallback?: string }
) {
  const start = parseIsoDate(scheduledStart);
  if (!start) return options?.fallback ?? "Unscheduled";

  const end = parseIsoDate(scheduledEnd);
  const includeDate = options?.includeDate ?? true;
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  const startTime = formatTimeShort(start);

  if (!end) {
    return includeDate ? `${dateLabel} · ${startTime}` : startTime;
  }

  if (sameLocalDay(start, end)) {
    const range = `${startTime}–${formatTimeShort(end)}`;
    return includeDate ? `${dateLabel} · ${range}` : range;
  }

  const endLabel = `${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${formatTimeShort(end)}`;
  return includeDate ? `${dateLabel} · ${startTime} → ${endLabel}` : `${startTime} → ${endLabel}`;
}

export function normalizePhoneForStorage(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasLeadingPlus && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }

  return null;
}

export function formatPhoneInputDisplay(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");

  if (value.startsWith("+") && digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6, 10)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }

  return value;
}
