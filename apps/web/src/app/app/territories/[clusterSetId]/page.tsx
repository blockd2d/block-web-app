'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { api } from '../../../../lib/api';
import { OpsMap } from '../../../../ui/map/ops-map';
import { haversineKm } from '../../../../lib/geo';
import { fmtNumber, fmtCurrency } from '../../../../lib/format';

type Rep = {
  id: string;
  name: string;
  home_base_lat: number;
  home_base_lng: number;
};

type Cluster = {
  id: string;
  cluster_set_id: string;
  name?: string | null;
  assigned_rep_id: string | null;
  center_lat: number;
  center_lng: number;
  stats_json: { size?: number; total_potential?: number; avg_value?: number } | null;
};

type Inspector = {
  cluster: Cluster & { hull_geojson: any };
  summary: {
    house_count: number;
    avg_value_estimate: number;
    total_potential: number;
    status_rollups: Record<string, number>;
  };
  zip_codes?: string[];
  drive_to_destination?: { address1?: string; city?: string; state?: string; zip?: string } | null;
};

type Suggestion = {
  cluster_id: string;
  rep_id: string;
  distance_miles?: number;
  distance_km?: number;
  score?: number;
};

function repName(reps: Rep[], id: string | null) {
  return reps.find((r) => r.id === id)?.name ?? 'Unassigned';
}

export default function TerritoryDetailPage() {
  const params = useParams();
  const clusterSetId = String((params as any).clusterSetId);
  const searchParams = useSearchParams();
  const clusterFromQuery = searchParams.get('cluster');

  const [loading, setLoading] = React.useState(true);
  const [clusters, setClusters] = React.useState<Cluster[]>([]);
  const [reps, setReps] = React.useState<Rep[]>([]);
  const [selectedClusterId, setSelectedClusterId] = React.useState<string | null>(null);
  const [seededFromQuery, setSeededFromQuery] = React.useState(false);
  const [inspector, setInspector] = React.useState<Inspector | null>(null);

  const [bulkIds, setBulkIds] = React.useState<Record<string, boolean>>({});
  const [assignRepId, setAssignRepId] = React.useState<string>('');

  const [suggestions, setSuggestions] = React.useState<Suggestion[] | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [centerOnClusterId, setCenterOnClusterId] = React.useState<string | null>(null);
  const [clusterSetName, setClusterSetName] = React.useState<string | null>(null);
  const [editingClusterSetName, setEditingClusterSetName] = React.useState(false);
  const [clusterSetNameDraft, setClusterSetNameDraft] = React.useState('');
  const [savingClusterSetName, setSavingClusterSetName] = React.useState(false);
  const [editingClusterName, setEditingClusterName] = React.useState(false);
  const [clusterNameDraft, setClusterNameDraft] = React.useState('');
  const [savingClusterName, setSavingClusterName] = React.useState(false);

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) ?? null;

  React.useEffect(() => {
    api.get(`/v1/cluster-sets/${clusterSetId}`)
      .then((r: any) => setClusterSetName(r.cluster_set?.name ?? null))
      .catch(() => setClusterSetName(null));
  }, [clusterSetId]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [r1, r2] = await Promise.all([api.get('/v1/reps'), api.get(`/v1/clusters?cluster_set_id=${clusterSetId}`)]);
      setReps(r1.items ?? []);
      setClusters(r2.items ?? []);
    } catch (e: any) {
      setNotice(e?.message ?? 'Failed to load territory data');
    } finally {
      setLoading(false);
    }
  }, [clusterSetId]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Deep-link support (Dashboard cluster card → Territory inspector)
  React.useEffect(() => {
    if (seededFromQuery) return;
    if (!clusterFromQuery) return;
    setSelectedClusterId(clusterFromQuery);
    setSeededFromQuery(true);
  }, [clusterFromQuery, seededFromQuery]);

  React.useEffect(() => {
    if (!selectedClusterId) {
      setInspector(null);
      return;
    }
    setNotice(null);
    (async () => {
      try {
        const res = await api.get(`/v1/clusters/${selectedClusterId}/inspector`);
        setInspector(res);
      } catch (e: any) {
        setInspector(null);
        setNotice(e?.message ?? 'Failed to load cluster details');
      }
    })();
  }, [selectedClusterId]);

  const selectedIds = React.useMemo(() => Object.keys(bulkIds).filter((id) => bulkIds[id]), [bulkIds]);

  async function bulkAssign() {
    if (!assignRepId || selectedIds.length === 0) return;
    setNotice(null);
    try {
      await api.post('/v1/clusters/assign-bulk', { cluster_ids: selectedIds, rep_id: assignRepId });
      setClusters((prev) => prev.map((c) => (bulkIds[c.id] ? { ...c, assigned_rep_id: assignRepId } : c)));
      setBulkIds({});
      setAssignRepId('');
      setSuggestions(null);
    } catch (e: any) {
      setNotice(e?.message ?? 'Bulk assignment failed');
    }
  }

  async function fetchSuggestions() {
    setNotice(null);
    try {
      const res = await api.get(`/v1/cluster-sets/${clusterSetId}/suggest-assignments`);
      setSuggestions(res.suggestions ?? []);
    } catch (e: any) {
      setNotice(e?.message ?? 'Failed to generate suggestions');
    }
  }

  async function applySuggestions() {
    if (!suggestions || suggestions.length === 0) return;
    setNotice(null);
    try {
      await api.post('/v1/clusters/assign-bulk', {
        cluster_ids: suggestions.map((s) => s.cluster_id),
        rep_id_by_cluster: Object.fromEntries(suggestions.map((s) => [s.cluster_id, s.rep_id]))
      });
      const map = new Map(suggestions.map((s) => [s.cluster_id, s.rep_id]));
      setClusters((prev) => prev.map((c) => ({ ...c, assigned_rep_id: map.get(c.id) ?? c.assigned_rep_id })));
      setNotice('Applied suggestions');
    } catch (e: any) {
      setNotice(e?.message ?? 'Failed to apply suggestions');
    }
  }

  async function exportAssignments(format: 'csv' | 'json') {
    setNotice(null);
    try {
      const res = await api.post('/v1/exports', {
        type: 'assignments',
        format,
        payload: { cluster_set_id: clusterSetId }
      });
      setNotice(`Export queued (${format}). Check Exports for download.`);
    } catch (e: any) {
      setNotice(e?.message ?? 'Export failed');
    }
  }

  async function saveClusterSetName() {
    const name = clusterSetNameDraft.trim();
    if (!name) {
      setEditingClusterSetName(false);
      return;
    }
    setSavingClusterSetName(true);
    setNotice(null);
    try {
      await api(`/v1/cluster-sets/${clusterSetId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
      setClusterSetName(name);
      setEditingClusterSetName(false);
    } catch (e: any) {
      setNotice(e?.message ?? 'Failed to rename cluster set');
    } finally {
      setSavingClusterSetName(false);
    }
  }

  function startEditClusterSetName() {
    setClusterSetNameDraft(clusterSetName ?? '');
    setEditingClusterSetName(true);
  }

  async function saveClusterName() {
    if (!selectedClusterId) return;
    setSavingClusterName(true);
    setNotice(null);
    try {
      await api(`/v1/clusters/${selectedClusterId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: clusterNameDraft.trim() || null })
      });
      setClusters((prev) =>
        prev.map((c) =>
          c.id === selectedClusterId ? { ...c, name: clusterNameDraft.trim() || null } : c
        )
      );
      if (inspector?.cluster) {
        setInspector({
          ...inspector,
          cluster: { ...inspector.cluster, name: clusterNameDraft.trim() || null }
        });
      }
      setEditingClusterName(false);
    } catch (e: any) {
      const msg = e?.message ?? '';
      setNotice(msg === 'Not found' ? 'Cluster not found or already deleted.' : (msg || 'Failed to rename cluster'));
      if (msg === 'Not found') {
        setInspector(null);
        setSelectedClusterId(null);
      }
    } finally {
      setSavingClusterName(false);
    }
  }

  function clusterDisplayName(c: Cluster) {
    return c.name?.trim() || `Cluster ${c.id.slice(0, 8)}`;
  }

  function nearestRep(c: Cluster) {
    if (!reps.length) return null;
    let best: { rep: Rep; d: number } | null = null;
    for (const r of reps) {
      const d = haversineKm({ lat: c.center_lat, lng: c.center_lng }, { lat: r.home_base_lat, lng: r.home_base_lng });
      if (!best || d < best.d) best = { rep: r, d };
    }
    return best;
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/app/territories"
            className="mb-1 inline-flex items-center gap-1 text-sm text-mutedForeground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to cluster sets
          </Link>
          <div className="text-xl font-semibold">Territories</div>
          <div className="mt-1 flex items-center gap-2 text-sm text-mutedForeground">
            {editingClusterSetName ? (
              <>
                <Input
                  value={clusterSetNameDraft}
                  onChange={(e) => setClusterSetNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveClusterSetName();
                    if (e.key === 'Escape') setEditingClusterSetName(false);
                  }}
                  className="h-8 w-48 text-sm"
                  autoFocus
                  disabled={savingClusterSetName}
                />
                <Button variant="ghost" size="sm" onClick={() => setEditingClusterSetName(false)} disabled={savingClusterSetName}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveClusterSetName} disabled={savingClusterSetName || !clusterSetNameDraft.trim()}>
                  {savingClusterSetName ? 'Saving…' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <span>{clusterSetName ?? `Cluster set: ${clusterSetId}`}</span>
                <button
                  type="button"
                  onClick={startEditClusterSetName}
                  className="rounded p-0.5 text-mutedForeground hover:bg-muted hover:text-foreground"
                  aria-label="Rename cluster set"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => exportAssignments('csv')}>Export CSV</Button>
          <Button variant="secondary" onClick={() => exportAssignments('json')}>Export JSON</Button>
          <Button onClick={loadAll}>Refresh</Button>
        </div>
      </div>

      {notice ? (
        <div className="mt-4 rounded-xl border border-border bg-card p-3 text-sm text-foreground">{notice}</div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-h-0 flex-col rounded-2xl border border-border bg-card p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <div className="text-sm font-medium">Territory Map</div>
            <div className="text-xs text-mutedForeground">Click a cluster to inspect</div>
          </div>
          <div className="relative min-h-[280px] flex-1 w-full overflow-hidden rounded-xl">
            <div className="absolute inset-0">
              <OpsMap
                clusterSetId={clusterSetId}
                selectedClusterId={selectedClusterId}
                onSelectCluster={setSelectedClusterId}
                enablePropertyPoints={false}
                className="h-full w-full"
                centerOnClusterId={centerOnClusterId}
                onCenterRequestedFulfilled={() => setCenterOnClusterId(null)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Cluster Inspector</div>
            {selectedCluster ? (
              <div className="text-xs text-mutedForeground">{clusterDisplayName(selectedCluster)}</div>
            ) : null}
          </div>

          {!selectedCluster ? (
            <div className="mt-4 text-sm text-mutedForeground">Select a cluster on the map to inspect details.</div>
          ) : inspector ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="text-xs text-mutedForeground">Cluster name</div>
                {editingClusterName ? (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={clusterNameDraft}
                      onChange={(e) => setClusterNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveClusterName();
                        if (e.key === 'Escape') setEditingClusterName(false);
                      }}
                      className="h-9 flex-1 text-sm"
                      placeholder={clusterDisplayName(selectedCluster)}
                      autoFocus
                      disabled={savingClusterName}
                    />
                    <Button variant="ghost" size="sm" onClick={() => setEditingClusterName(false)} disabled={savingClusterName}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveClusterName} disabled={savingClusterName}>
                      {savingClusterName ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-medium">{clusterDisplayName(selectedCluster)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setClusterNameDraft(selectedCluster.name ?? '');
                        setEditingClusterName(true);
                      }}
                      className="rounded p-0.5 text-mutedForeground hover:bg-muted hover:text-foreground"
                      aria-label="Rename cluster"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-mutedForeground">Houses</div>
                  <div className="text-base font-semibold">{fmtNumber(inspector.summary.house_count)}</div>
                </div>
                <div>
                  <div className="text-xs text-mutedForeground">Avg value</div>
                  <div className="text-base font-semibold">{fmtCurrency(inspector.summary.avg_value_estimate)}</div>
                </div>
                <div>
                  <div className="text-xs text-mutedForeground">Total potential</div>
                  <div className="text-base font-semibold">{fmtCurrency(inspector.summary.total_potential)}</div>
                </div>
                <div>
                  <div className="text-xs text-mutedForeground">Assigned rep</div>
                  <div className="text-base font-semibold">{repName(reps, inspector.cluster.assigned_rep_id)}</div>
                </div>
              </div>

              {(() => {
                const n = nearestRep(selectedCluster);
                if (!n) return null;
                return (
                  <div className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="text-xs text-mutedForeground">Nearest rep</div>
                    <div className="mt-1 font-medium">{n.rep.name}</div>
                    <div className="text-xs text-mutedForeground">{n.d.toFixed(2)} km from home base</div>
                  </div>
                );
              })()}

              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="text-xs text-mutedForeground">Houses available</div>
                <div className="mt-1 text-sm font-medium">{fmtNumber(inspector.summary.house_count)}</div>
              </div>

              {(() => {
                const d = inspector.drive_to_destination;
                const parts = d
                  ? [
                      d.address1,
                      [d.city, d.state].filter(Boolean).join(', '),
                      d.zip
                    ].filter(Boolean)
                  : [];
                if (parts.length === 0) return null;
                return (
                  <div className="rounded-xl border border-border bg-background/50 p-3">
                    <div className="text-xs text-mutedForeground">Drive to destination</div>
                    <div className="mt-1 text-sm">{parts.join(' — ')}</div>
                  </div>
                );
              })()}

              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="text-xs text-mutedForeground">Status rollups</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {Object.entries(inspector.summary.status_rollups ?? {}).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <span className="text-mutedForeground">{k}</span>
                      <span className="font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="text-xs text-mutedForeground">Assign this cluster</div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    value={selectedCluster.assigned_rep_id ?? ''}
                    onChange={async (e) => {
                      const repId = e.target.value || null;
                      await api.post('/v1/clusters/assign', { cluster_id: selectedCluster.id, rep_id: repId });
                      setClusters((prev) => prev.map((c) => (c.id === selectedCluster.id ? { ...c, assigned_rep_id: repId } : c)));
                      await loadAll();
                    }}
                  >
                    <option value="">Unassigned</option>
                    {reps.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-mutedForeground">Loading…</div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">Assignment Table</div>
            <div className="mt-1 text-xs text-mutedForeground">
              Select clusters, bulk assign, or auto-suggest to balance workload.
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              value={assignRepId}
              onChange={(e) => setAssignRepId(e.target.value)}
            >
              <option value="">Assign selected…</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={bulkAssign} disabled={!assignRepId || selectedIds.length === 0}>
              Bulk assign ({selectedIds.length})
            </Button>
            <Button variant="secondary" onClick={fetchSuggestions}>
              Auto-suggest
            </Button>
            <Button onClick={applySuggestions} disabled={!suggestions || suggestions.length === 0}>
              Apply suggestions
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-mutedForeground">
              <tr>
                <th className="p-2 text-left">Sel</th>
                <th className="p-2 text-left">Cluster</th>
                <th className="p-2 text-left">Houses</th>
                <th className="p-2 text-left">Potential</th>
                <th className="p-2 text-left">Assigned</th>
                <th className="p-2 text-left">Nearest rep</th>
                <th className="p-2 text-left">Distance</th>
                <th className="p-2 text-left">Suggested</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => {
                const n = nearestRep(c);
                const s = suggestions?.find((x) => x.cluster_id === c.id) ?? null;
                const isSelected = c.id === selectedClusterId;
                return (
                  <tr
                    key={c.id}
                    className={`border-t border-border cursor-pointer ${isSelected ? 'bg-muted/60' : ''} hover:bg-muted/40`}
                    onClick={() => {
                      setSelectedClusterId(c.id);
                      setCenterOnClusterId(c.id);
                    }}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!bulkIds[c.id]}
                        onChange={(e) => setBulkIds((prev) => ({ ...prev, [c.id]: e.target.checked }))}
                      />
                    </td>
                    <td className="p-2 font-medium">{clusterDisplayName(c)}</td>
                    <td className="p-2">{fmtNumber(c.stats_json?.size ?? 0)}</td>
                    <td className="p-2">{fmtCurrency(c.stats_json?.total_potential ?? 0)}</td>
                    <td className="p-2">{repName(reps, c.assigned_rep_id)}</td>
                    <td className="p-2">{n ? n.rep.name : '—'}</td>
                    <td className="p-2">{n ? `${n.d.toFixed(2)} km` : '—'}</td>
                    <td className="p-2">{s ? `${repName(reps, s.rep_id)} (${(s.distance_miles ?? s.distance_km ?? 0).toFixed(1)} mi)` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {clusters.length === 0 && !loading ? (
          <div className="mt-4 text-sm text-mutedForeground">No clusters in this set yet.</div>
        ) : null}
      </div>
    </div>
  );
}
