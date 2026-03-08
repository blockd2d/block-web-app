import { api, isApiError } from "./apiClient";
import type { JobListItem, JobDetail } from "../types/job";
import type { ChecklistItem } from "../types/checklist";

const LABOR_JOBS_PATH = "/v1/labor/jobs";

/** API job row (snake_case from backend). */
type ApiJob = Record<string, unknown> & {
  id?: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status?: string | null;
  completed_at?: string | null;
  sale_id?: string | null;
  laborer_id?: string | null;
};

/** API job detail response. */
type ApiJobDetailResponse = {
  job?: ApiJob;
  sale?: { customer_phone?: string | null; notes?: string | null } | null;
  property?: {
    address1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    lat?: number | null;
    lng?: number | null;
  } | null;
  job_photos?: Array<{ kind?: string; signed_url?: string | null }>;
};

function normalizeJobListItem(row: ApiJob): JobListItem {
  const parts: string[] = [];
  if (row.address_short != null) parts.push(String(row.address_short));
  else if ((row as Record<string, unknown>).address_full != null)
    parts.push(String((row as Record<string, unknown>).address_full));
  const address_short =
    parts.length > 0 ? parts[0] : null;
  return {
    id: String(row.id ?? ""),
    address_short,
    address_full: (row as Record<string, unknown>).address_full != null
      ? String((row as Record<string, unknown>).address_full)
      : null,
    service_name: (row as Record<string, unknown>).service_name != null
      ? String((row as Record<string, unknown>).service_name)
      : null,
    status: (row.status as JobListItem["status"]) ?? "scheduled",
    customer_name: (row as Record<string, unknown>).customer_name != null
      ? String((row as Record<string, unknown>).customer_name)
      : null,
    scheduled_start: row.scheduled_start != null ? String(row.scheduled_start) : null,
    scheduled_end: row.scheduled_end != null ? String(row.scheduled_end) : null,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    crew_label: (row as Record<string, unknown>).crew_label != null
      ? String((row as Record<string, unknown>).crew_label)
      : null,
    has_unsynced: false,
    has_issue: false
  };
}

function buildAddressShort(property: ApiJobDetailResponse["property"]): string | null {
  if (!property) return null;
  const a1 = property.address1 ?? "";
  const city = property.city ?? "";
  const state = property.state ?? "";
  const zip = property.zip ?? "";
  const parts = [a1, city, state, zip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeJobDetail(res: ApiJobDetailResponse): JobDetail {
  const job = res.job ?? {};
  const prop = res.property;
  const sale = res.sale;
  const address_short = buildAddressShort(prop);
  const address_full = address_short;
  return {
    id: String(job.id ?? ""),
    address_short,
    address_full,
    service_name: (job as Record<string, unknown>).service_name != null
      ? String((job as Record<string, unknown>).service_name)
      : null,
    service_type: (job as Record<string, unknown>).service_type != null
      ? String((job as Record<string, unknown>).service_type)
      : null,
    status: (job.status as JobDetail["status"]) ?? "scheduled",
    customer_name: (job as Record<string, unknown>).customer_name != null
      ? String((job as Record<string, unknown>).customer_name)
      : null,
    customer_phone: sale?.customer_phone != null ? String(sale.customer_phone) : null,
    scheduled_start: job.scheduled_start != null ? String(job.scheduled_start) : null,
    scheduled_end: job.scheduled_end != null ? String(job.scheduled_end) : null,
    completed_at: job.completed_at != null ? String(job.completed_at) : null,
    notes: sale?.notes != null ? String(sale.notes) : (job as Record<string, unknown>).notes != null ? String((job as Record<string, unknown>).notes) : null,
    quote_summary: (job as Record<string, unknown>).quote_summary != null
      ? String((job as Record<string, unknown>).quote_summary)
      : null,
    crew_label: (job as Record<string, unknown>).crew_label != null
      ? String((job as Record<string, unknown>).crew_label)
      : null,
    latitude: prop?.lat != null ? Number(prop.lat) : null,
    longitude: prop?.lng != null ? Number(prop.lng) : null
  };
}

/**
 * Fetch jobs for the current labor user (GET /v1/labor/jobs). Filter client-side by date.
 */
export async function fetchTodayJobs(): Promise<JobListItem[]> {
  const data = (await api.get(LABOR_JOBS_PATH)) as { jobs?: ApiJob[] };
  const jobs = data?.jobs ?? [];
  const today = new Date().toISOString().slice(0, 10);
  return jobs
    .filter((j) => {
      const start = j.scheduled_start ?? "";
      return start >= `${today}T00:00:00` && start < `${today}T23:59:59.999`;
    })
    .sort(
      (a, b) =>
        new Date((a.scheduled_start ?? "") as string).getTime() -
        new Date((b.scheduled_start ?? "") as string).getTime()
    )
    .map(normalizeJobListItem);
}

/**
 * Fetch upcoming jobs (future dates). Same list, filter client-side.
 */
export async function fetchUpcomingJobs(): Promise<JobListItem[]> {
  const data = (await api.get(LABOR_JOBS_PATH)) as { jobs?: ApiJob[] };
  const jobs = data?.jobs ?? [];
  const now = new Date().toISOString();
  return jobs
    .filter((j) => (j.scheduled_start as string) > now)
    .sort(
      (a, b) =>
        new Date((a.scheduled_start ?? "") as string).getTime() -
        new Date((b.scheduled_start ?? "") as string).getTime()
    )
    .slice(0, 50)
    .map(normalizeJobListItem);
}

/**
 * Fetch completed jobs (recent). Same list, filter by completed_at.
 */
export async function fetchCompletedJobs(): Promise<JobListItem[]> {
  const data = (await api.get(LABOR_JOBS_PATH)) as { jobs?: ApiJob[] };
  const jobs = data?.jobs ?? [];
  return jobs
    .filter((j) => j.completed_at != null)
    .sort(
      (a, b) =>
        new Date((b.completed_at ?? "") as string).getTime() -
        new Date((a.completed_at ?? "") as string).getTime()
    )
    .slice(0, 30)
    .map(normalizeJobListItem);
}

/**
 * Fetch single job detail by id (GET /v1/jobs/:id). Returns job + sale + property + job_photos.
 */
export async function fetchJobDetail(jobId: string): Promise<JobDetail | null> {
  try {
    const res = (await api.get(`/v1/jobs/${jobId}`)) as ApiJobDetailResponse;
    if (!res?.job) return null;
    return normalizeJobDetail(res);
  } catch (e: unknown) {
    if (isApiError(e) && e.status === 404) return null;
    throw e;
  }
}

/** Labor can set status up to complete. Manager-only states are read-only. */
export const LABOR_STATUSES = [
  "new",
  "scheduled",
  "en_route",
  "arrived",
  "in_progress",
  "paused",
  "complete"
] as const;

/**
 * Update job status via API. Uses POST /v1/jobs/:id/start and POST /v1/jobs/:id/complete.
 * Other statuses (en_route, arrived, paused, approved, etc.) have no API yet; no-op so UI does not break.
 */
export async function updateJobStatus(
  jobId: string,
  status: (typeof LABOR_STATUSES)[number] | string
): Promise<void> {
  if (status === "in_progress") {
    await api.post(`/v1/jobs/${jobId}/start`);
    return;
  }
  if (status === "complete") {
    await api.post(`/v1/jobs/${jobId}/complete`);
    return;
  }
  // en_route, arrived, paused, approved, etc.: no API yet; no-op (client-only / optimistic UI).
}

// --- Checklist (placeholder: API may not exist yet) ---
export async function fetchChecklistItems(): Promise<ChecklistItem[]> {
  try {
    const data = (await api.get("/v1/labor/checklist/items")) as { items?: ChecklistItem[] };
    return (data?.items ?? []).map((row) => ({
      id: row.id,
      template_item_id: row.template_item_id ?? row.id,
      label: row.label ?? "",
      sort_order: row.sort_order ?? 0,
      is_required: row.is_required ?? false,
      is_checked: false,
      checked_at: null,
      note: null
    }));
  } catch {
    return [];
  }
}

export async function fetchChecklistResponses(jobId: string): Promise<Record<string, boolean>> {
  try {
    const data = (await api.get(`/v1/jobs/${jobId}/checklist`)) as {
      responses?: Array<{ template_item_id: string; is_checked?: boolean }>;
    };
    const out: Record<string, boolean> = {};
    (data?.responses ?? []).forEach((r) => {
      out[r.template_item_id] = r.is_checked ?? false;
    });
    return out;
  } catch {
    return {};
  }
}

export async function setChecklistResponse(
  jobId: string,
  templateItemId: string,
  isChecked: boolean,
  _userId: string
): Promise<void> {
  await api.put(`/v1/jobs/${jobId}/checklist`, {
    template_item_id: templateItemId,
    is_checked: isChecked
  });
}

// --- Notes (placeholder) ---
export async function createJobNote(
  jobId: string,
  body: string,
  _authorUserId: string,
  noteType?: string
): Promise<void> {
  await api.post(`/v1/jobs/${jobId}/notes`, { body, note_type: noteType ?? "general" });
}

// --- Issue reports (placeholder) ---
export async function createIssueReport(
  jobId: string,
  _reportedByUserId: string,
  payload: {
    issue_type: string;
    severity?: string;
    title: string;
    description?: string;
  }
): Promise<void> {
  await api.post(`/v1/jobs/${jobId}/issues`, {
    issue_type: payload.issue_type,
    severity: payload.severity ?? "medium",
    title: payload.title,
    description: payload.description ?? null
  });
}

// --- Clock (placeholder) ---
export async function clockIn(_userId: string, _crewId?: string): Promise<void> {
  await api.post("/v1/labor/clock-in");
}

export async function clockOut(_userId: string, _crewId?: string): Promise<void> {
  await api.post("/v1/labor/clock-out");
}

export async function getTodayShiftState(
  _userId: string
): Promise<{ clockedIn: boolean; lastEventAt: string | null }> {
  try {
    const data = (await api.get("/v1/labor/clock/today")) as {
      clocked_in?: boolean;
      last_event_at?: string | null;
    };
    return {
      clockedIn: data?.clocked_in ?? false,
      lastEventAt: data?.last_event_at ?? null
    };
  } catch {
    return { clockedIn: false, lastEventAt: null };
  }
}
