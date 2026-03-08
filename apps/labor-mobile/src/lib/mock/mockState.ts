import type { JobStatus } from "../../types/job";

/** Mutable checklist responses: jobId -> templateItemId -> isChecked. */
let checklistResponses: Record<string, Record<string, boolean>> = {};

/** Mock clock state (session-only). */
let clockState: { clockedIn: boolean; lastEventAt: string | null } = {
  clockedIn: false,
  lastEventAt: null
};

/** Optional: override job status per job for mock list/detail. */
let jobStatusOverrides: Record<string, JobStatus> = {};

/** Optional: in-memory notes per job (id -> array of body strings). */
let jobNotes: Record<string, string[]> = {};

/** Optional: in-memory issues per job (id -> count or simple list). */
let jobIssues: Record<string, unknown[]> = {};

export function getMockChecklistResponses(jobId: string): Record<string, boolean> {
  return checklistResponses[jobId] ?? {};
}

export function setMockChecklistResponse(
  jobId: string,
  templateItemId: string,
  isChecked: boolean
): void {
  if (!checklistResponses[jobId]) checklistResponses[jobId] = {};
  checklistResponses[jobId][templateItemId] = isChecked;
}

export function getMockClockState(): { clockedIn: boolean; lastEventAt: string | null } {
  return { ...clockState };
}

export function setMockClockIn(): void {
  clockState = { clockedIn: true, lastEventAt: new Date().toISOString() };
}

export function setMockClockOut(): void {
  clockState = { clockedIn: false, lastEventAt: new Date().toISOString() };
}

export function getMockJobStatusOverride(jobId: string): JobStatus | undefined {
  return jobStatusOverrides[jobId];
}

export function setMockJobStatusOverride(jobId: string, status: JobStatus): void {
  jobStatusOverrides[jobId] = status;
}

export function getMockJobNotes(jobId: string): string[] {
  return jobNotes[jobId] ?? [];
}

export function addMockJobNote(jobId: string, body: string): void {
  if (!jobNotes[jobId]) jobNotes[jobId] = [];
  jobNotes[jobId].push(body);
}

export function addMockJobIssue(jobId: string, payload: unknown): void {
  if (!jobIssues[jobId]) jobIssues[jobId] = [];
  jobIssues[jobId].push(payload);
}

/** Reset all mutable mock state to initial (for "Reset Mock Data"). */
export function resetMockState(): void {
  checklistResponses = {};
  clockState = { clockedIn: false, lastEventAt: null };
  jobStatusOverrides = {};
  jobNotes = {};
  jobIssues = {};
}
