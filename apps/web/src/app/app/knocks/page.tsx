'use client';

import * as React from 'react';
import { api } from '../../../lib/api';
import { useMe } from '../../../lib/use-me';
import { Button } from '../../../ui/button';
import { fmtScheduleRange } from '../../../lib/format';

const OUTCOMES = [
  { value: 'not_home', label: 'Not home' },
  { value: 'talked_not_interested', label: 'Not interested' },
  { value: 'lead', label: 'Lead' },
  { value: 'quote', label: 'Quote' },
  { value: 'sold', label: 'Sold' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'do_not_knock', label: 'DNK' }
] as const;

type Cluster = { id: string; cluster_set_id: string; name?: string | null; scheduled_start?: string | null; scheduled_end?: string | null };
type Property = { id: string; address1?: string | null; city?: string | null; state?: string | null; zip?: string | null };

export default function KnocksPage() {
  const { me } = useMe();
  const [clusters, setClusters] = React.useState<Cluster[]>([]);
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [selectedClusterId, setSelectedClusterId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [logging, setLogging] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const isRep = me?.role === 'rep';
  const [repFilter, setRepFilter] = React.useState('');
  const [reps, setReps] = React.useState<{ id: string; name: string }[]>([]);

  const [clusterSetId, setClusterSetId] = React.useState<string | null>(null);
  const [clusterSets, setClusterSets] = React.useState<{ id: string; name: string }[]>([]);

  type PageSize = 5 | 10 | 20;
  const [pageSize, setPageSize] = React.useState<PageSize>(20);
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    (async () => {
      setErr(null);
      try {
        if (isRep) {
          const r = await api.get('/v1/reps/me/clusters');
          const list = (r.clusters || []) as Cluster[];
          setClusters(list);
          if (list.length && !selectedClusterId) setSelectedClusterId(list[0].id);
        } else {
          const [cs, r] = await Promise.all([
            api.get('/v1/cluster-sets').then((x: any) => (x.items || []).filter((i: any) => i.status === 'complete')),
            api.get('/v1/reps?limit=200').then((x: any) => (x.items || x.reps || []) as { id: string; name: string }[])
          ]);
          setReps(r);
          setClusterSets(cs);
        }
      } catch (e: any) {
        setErr(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [isRep]);

  React.useEffect(() => {
    if (isRep || !clusterSetId) return;
    (async () => {
      try {
        const r = await api.get(`/v1/clusters?cluster_set_id=${encodeURIComponent(clusterSetId)}`);
        setClusters((r.items || r.clusters || []) as Cluster[]);
        setSelectedClusterId(null);
      } catch {
        setClusters([]);
        setSelectedClusterId(null);
      }
    })();
  }, [isRep, clusterSetId]);

  React.useEffect(() => {
    if (!selectedClusterId) {
      setProperties([]);
      setPage(1);
      return;
    }
    (async () => {
      try {
        const r = await api.get(`/v1/properties/by-cluster/${selectedClusterId}`);
        setProperties((r.properties || []) as Property[]);
        setPage(1);
      } catch {
        setProperties([]);
        setPage(1);
      }
    })();
  }, [selectedClusterId]);

  const totalPages = Math.max(1, Math.ceil(properties.length / pageSize));
  const start = (page - 1) * pageSize;
  const paginatedProperties = properties.slice(start, start + pageSize);

  function clusterOptionLabel(c: Cluster): string {
    const name = (c.name && c.name.trim()) ? c.name.trim() : `Cluster ${c.id.slice(0, 8)}`;
    const range = fmtScheduleRange(c.scheduled_start, c.scheduled_end);
    if (range === 'Unscheduled') return name;
    return `${name} — ${range}`;
  }

  async function logOutcome(propertyId: string, outcome: string) {
    setLogging(propertyId);
    setErr(null);
    try {
      await api.post('/v1/interactions', {
        property_id: propertyId,
        outcome,
        ...(isRep ? {} : { rep_id: repFilter || undefined })
      });
      setLogging(null);
    } catch (e: any) {
      setErr(e?.message || 'Failed to log');
      setLogging(null);
    }
  }

  function fmtAddr(p: Property) {
    return [p.address1, p.city, p.state, p.zip].filter(Boolean).join(', ') || p.id.slice(0, 8) + '…';
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-mutedForeground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Knocks</h1>
      <p className="mt-1 text-sm text-mutedForeground">Log door outcomes for your assigned properties.</p>

      {!isRep && (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="text-xs text-mutedForeground">Rep (for logging as)</label>
            <select
              className="ml-2 mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={repFilter}
              onChange={(e) => setRepFilter(e.target.value)}
            >
              <option value="">Select rep</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-mutedForeground">Cluster set</label>
            <select
              className="ml-2 mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={clusterSetId ?? ''}
              onChange={(e) => setClusterSetId(e.target.value || null)}
            >
              <option value="">Select set</option>
              {clusterSets.map((cs) => (
                <option key={cs.id} value={cs.id}>{cs.name}</option>
              ))}
            </select>
          </div>
          {clusters.length > 0 && (
            <div>
              <label className="text-xs text-mutedForeground">Cluster</label>
              <select
                className="ml-2 mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={selectedClusterId ?? ''}
                onChange={(e) => setSelectedClusterId(e.target.value || null)}
              >
                <option value="">Select cluster</option>
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clusterOptionLabel(c)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {isRep && clusters.length > 0 && (
        <div className="mt-4">
          <label className="text-xs text-mutedForeground">Cluster</label>
          <select
            className="ml-2 mt-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
            value={selectedClusterId ?? ''}
            onChange={(e) => setSelectedClusterId(e.target.value || null)}
          >
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {clusterOptionLabel(c)}
              </option>
            ))}
          </select>
        </div>
      )}

      {err ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <div className="mt-6">
        {isRep && !selectedClusterId && clusters.length === 0 ? (
          <p className="text-sm text-mutedForeground">No clusters assigned to you. Ask a manager to assign territories.</p>
        ) : !isRep && !selectedClusterId ? (
          <p className="text-sm text-mutedForeground">Select a cluster set and cluster above to load properties, and a rep to attribute logs to.</p>
        ) : properties.length === 0 && selectedClusterId ? (
          <p className="text-sm text-mutedForeground">No properties in this cluster.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="text-xs text-mutedForeground">Properties per page</span>
              <select
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as PageSize);
                  setPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
              {properties.length > 0 && (
                <span className="text-xs text-mutedForeground">
                  Showing {start + 1}–{Math.min(start + pageSize, properties.length)} of {properties.length} properties
                </span>
              )}
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center px-2 text-sm text-mutedForeground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedProperties.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                  <div className="truncate text-sm font-medium">{fmtAddr(p)}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {OUTCOMES.map((o) => (
                      <Button
                        key={o.value}
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        disabled={logging === p.id}
                        onClick={() => logOutcome(p.id, o.value)}
                      >
                        {logging === p.id ? '…' : o.label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
