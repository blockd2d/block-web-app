// In-memory store for prototyping.
export const runs = new Map();

export function saveRun(runId, run) {
  runs.set(runId, { ...run, createdAt: new Date().toISOString() });
}

export function getRun(runId) {
  return runs.get(runId);
}

export function listRuns() {
  return Array.from(runs.entries()).map(([runId, r]) => ({ runId, k: r.k, createdAt: r.createdAt }));
}
