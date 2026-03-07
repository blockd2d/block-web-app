'use client';

import * as React from 'react';
import Link from 'next/link';
import { X, Trash2, Pencil, Loader2 } from 'lucide-react';
import { Input } from '../../../ui/input';
import { Button } from '../../../ui/button';
import { api } from '../../../lib/api';

type ClusterSet = {
  id: string;
  name: string;
  created_at: string;
  status: string;
  radius_m: number;
  min_houses: number;
  filters_json: any;
};

type County = { id: string; name: string };

export default function TerritoriesPage() {
  const [clusterSets, setClusterSets] = React.useState<ClusterSet[]>([]);
  const [counties, setCounties] = React.useState<County[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('Hendricks - Door-to-door');
  const [countyId, setCountyId] = React.useState('');
  const [radiusM, setRadiusM] = React.useState(120);
  const [minHouses, setMinHouses] = React.useState(12);
  const [valueMin, setValueMin] = React.useState<number | ''>(180000);
  const [valueMax, setValueMax] = React.useState<number | ''>(650000);
  const [excludeDNK, setExcludeDNK] = React.useState(true);
  const [onlyUnworked, setOnlyUnworked] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ClusterSet | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [editClusterSetId, setEditClusterSetId] = React.useState<string | null>(null);
  const [editClusterSetName, setEditClusterSetName] = React.useState('');
  const [savingName, setSavingName] = React.useState(false);
  const [pollingActive, setPollingActive] = React.useState(false);
  const pollingStartedAtRef = React.useRef<number | null>(null);

  async function load() {
    const [cs, c] = await Promise.all([api('/v1/cluster-sets'), api('/v1/counties')]);
    setClusterSets(cs.items || []);
    setCounties(c.items || []);
    if (!countyId && (c.items?.length || 0) > 0) setCountyId(c.items[0].id);
  }

  React.useEffect(() => {
    load().catch(() => {
      /* ignore */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll cluster sets every 1s after create until none are queued/running or 5 min cap
  React.useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(() => {
      load().catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, [pollingActive]);

  React.useEffect(() => {
    if (!pollingActive || !clusterSets.length) return;
    const hasPending = clusterSets.some((cs) => cs.status === 'queued' || cs.status === 'running');
    if (!hasPending) {
      setPollingActive(false);
      pollingStartedAtRef.current = null;
      return;
    }
    const started = pollingStartedAtRef.current;
    if (started != null && Date.now() - started > 5 * 60 * 1000) {
      setPollingActive(false);
      pollingStartedAtRef.current = null;
    }
  }, [pollingActive, clusterSets]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/v1/cluster-sets/${deleteTarget.id}`, { method: 'DELETE' });
      setClusterSets((prev) => prev.filter((cs) => cs.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      const isNotFound = e?.status === 404 || e?.message === 'Not found';
      setDeleteError(isNotFound ? 'Cluster set not found or already deleted.' : (e?.message || 'Failed to delete cluster set'));
      if (isNotFound) {
        setClusterSets((prev) => prev.filter((cs) => cs.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } finally {
      setDeleting(false);
    }
  }

  function startRename(cs: ClusterSet) {
    setEditClusterSetId(cs.id);
    setEditClusterSetName(cs.name);
  }

  async function saveRename() {
    if (!editClusterSetId || !editClusterSetName.trim()) {
      setEditClusterSetId(null);
      return;
    }
    setSavingName(true);
    setError(null);
    try {
      await api(`/v1/cluster-sets/${editClusterSetId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editClusterSetName.trim() })
      });
      setClusterSets((prev) =>
        prev.map((c) => (c.id === editClusterSetId ? { ...c, name: editClusterSetName.trim() } : c))
      );
      setEditClusterSetId(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to rename');
    } finally {
      setSavingName(false);
    }
  }

  function cancelRename() {
    setEditClusterSetId(null);
  }

  async function createClusterSet() {
    setCreating(true);
    setError(null);
    try {
      const payload = {
        name,
        county_id: countyId,
        filters: {
          radius_m: Number(radiusM),
          min_houses: Number(minHouses),
          value_min: valueMin === '' ? null : Number(valueMin),
          value_max: valueMax === '' ? null : Number(valueMax),
          exclude_dnk: excludeDNK,
          only_unworked: onlyUnworked
        }
      };
      const r = await api('/v1/cluster-sets', { method: 'POST', body: JSON.stringify(payload) });
      setClusterSets((prev) => [r.cluster_set || r, ...prev]);
      pollingStartedAtRef.current = Date.now();
      setPollingActive(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to create cluster set');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="text-sm font-semibold">Create a cluster set</div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-mutedForeground">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">County</label>
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
                  value={countyId}
                  onChange={(e) => setCountyId(e.target.value)}
                >
                  {counties.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Radius (m)</label>
                <Input type="number" value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Min houses</label>
                <Input type="number" value={minHouses} onChange={(e) => setMinHouses(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Value min</label>
                <Input
                  type="number"
                  value={valueMin}
                  onChange={(e) => setValueMin(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs text-mutedForeground">Value max</label>
                <Input
                  type="number"
                  value={valueMax}
                  onChange={(e) => setValueMax(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={excludeDNK} onChange={(e) => setExcludeDNK(e.target.checked)} />
                    Exclude DNK
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={onlyUnworked}
                      onChange={(e) => setOnlyUnworked(e.target.checked)}
                    />
                    Only unworked
                  </label>
                </div>
              </div>
            </div>

            {error ? <div className="mt-3 text-sm text-destructive">{error}</div> : null}

            <div className="mt-4 flex items-center justify-end">
              <Button onClick={createClusterSet} disabled={creating || !countyId}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <div className="text-xs font-medium text-mutedForeground mb-2">Cluster generation</div>
              <details className="border-b border-border/60 pb-2">
                <summary className="cursor-pointer text-sm font-medium text-foreground py-1">
                  What each setting does
                </summary>
                <div className="mt-2 text-sm text-mutedForeground space-y-2 pl-2">
                  <p><strong>Name:</strong> Label for this cluster set (e.g. &quot;Hendricks - Door-to-door&quot;).</p>
                  <p><strong>County:</strong> Geographic area; only properties in this county are included.</p>
                  <p><strong>Radius (m):</strong> DBScan radius in meters; how close properties must be to be grouped into one cluster (larger = fewer, bigger clusters).</p>
                  <p><strong>Min houses:</strong> Minimum number of properties required to form a cluster (smaller clusters are discarded).</p>
                  <p><strong>Value min / Value max:</strong> Filter properties by estimated value; only properties in this range are clustered.</p>
                  <p><strong>Exclude DNK:</strong> Exclude properties marked &quot;Do Not Knock&quot; (from prior knock outcomes).</p>
                  <p><strong>Only unworked:</strong> Include only properties that have not been worked yet (no prior knock).</p>
                </div>
              </details>
              <details className="border-b border-border/60 pb-2 mt-2">
                <summary className="cursor-pointer text-sm font-medium text-foreground py-1">
                  Strategies for better clusters
                </summary>
                <div className="mt-2 text-sm text-mutedForeground space-y-2 pl-2">
                  <p>Use radius and min houses together: larger radius + higher min houses for fewer, denser territories; smaller radius for more, tighter clusters.</p>
                  <p>Narrow value range to focus on a specific segment (e.g. mid-tier homes).</p>
                  <p>Use &quot;Only unworked&quot; when building fresh routes; use &quot;Exclude DNK&quot; to respect resident preferences.</p>
                </div>
              </details>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4">
              <div className="text-sm font-semibold">Cluster sets</div>
              <div className="flex items-center gap-2">
                <Link href="/app/territories/zones">
                  <Button variant="ghost" type="button">
                    Draw zone
                  </Button>
                </Link>
                <Button variant="ghost" onClick={() => load()}>
                  Refresh
                </Button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {clusterSets.length ? (
                clusterSets.map((cs) => (
                  <div key={cs.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {editClusterSetId === cs.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <Input
                              value={editClusterSetName}
                              onChange={(e) => setEditClusterSetName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename();
                                if (e.key === 'Escape') cancelRename();
                              }}
                              onBlur={() => saveRename()}
                              className="h-8 flex-1 text-sm"
                              autoFocus
                              disabled={savingName}
                            />
                            <Button variant="ghost" size="sm" onClick={cancelRename} disabled={savingName}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="truncate text-sm font-medium">{cs.name}</span>
                            <button
                              type="button"
                              onClick={() => startRename(cs)}
                              className="rounded p-0.5 text-mutedForeground hover:bg-muted hover:text-foreground"
                              aria-label="Rename"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <span
                          className={
                            cs.status === 'complete'
                              ? 'rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-700 dark:text-green-400'
                              : cs.status === 'running' || cs.status === 'queued'
                                ? 'inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400'
                                : 'rounded-full bg-muted px-2 py-0.5 text-xs text-mutedForeground'
                          }
                        >
                          {(cs.status === 'running' || cs.status === 'queued') && (
                            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          )}
                          {cs.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-mutedForeground">
                        radius {cs.radius_m}m • min {cs.min_houses} houses
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-mutedForeground hover:text-destructive"
                        onClick={() => setDeleteTarget(cs)}
                        aria-label="Delete cluster set"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Link href={`/app/territories/${cs.id}`} className="text-sm text-primary hover:underline">
                        Open & assign
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-sm text-mutedForeground">No cluster sets yet. Create your first one.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <h2 id="delete-dialog-title" className="text-sm font-semibold">Delete cluster set</h2>
              <button
                type="button"
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="rounded-lg p-1 text-mutedForeground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-mutedForeground">
              This action cannot be undone if proceeded. The cluster set &quot;{deleteTarget.name}&quot; and all its clusters will be permanently removed.
            </p>
            {deleteError ? <div className="mt-3 text-sm text-destructive">{deleteError}</div> : null}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="primary" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="ghost" onClick={confirmDelete} disabled={deleting} className="border-destructive/50 text-destructive hover:bg-destructive/10">
                {deleting ? 'Deleting…' : 'Proceed'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
