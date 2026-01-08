'use client';

import * as React from 'react';
import { AppShell } from '../../../ui/shell';
import { StatCard } from '../../../ui/stat-card';
import { TimeRangeToggle } from '../../../ui/time-range-toggle';
import { api } from '../../../lib/api';
import { fmtCurrency, fmtNumber, fmtPercent, TimeRange } from '../../../lib/format';
import { OpsMap } from '../../../ui/map/ops-map';
import { Button } from '../../../ui/button';
import Link from 'next/link';

type ClusterSet = { id: string; name: string; status: string; created_at: string };

type DashboardOverview = {
  range: TimeRange;
  totals: {
    doors: number;
    leads: number;
    quotes: number;
    sold: number;
    revenue: number;
    hours: number;
    followups_due: number;
    jobs_completed: number;
    payments_collected: number;
  };
  derived: {
    doors_per_hour: number;
    close_rate: number;
  };
  repLeaderboard: Array<{
    rep_id: string;
    rep_name: string;
    doors: number;
    sold: number;
    revenue: number;
    score: number;
    delta_score?: number;
  }>;
};

type RepMini = { id: string; name: string };

type ClusterInspector = {
  cluster: {
    id: string;
    cluster_set_id: string;
    assigned_rep_id: string | null;
  };
  summary: {
    house_count: number;
    total_potential: number;
    assigned_rep_id: string | null;
    followups_due: number;
    status_rollups: Record<string, number>;
    nearest_rep: null | { rep_id: string; rep_name: string; distance_miles: number };
  };
};

export default function DashboardPage() {
  const [range, setRange] = React.useState<TimeRange>('week');
  const [clusterSets, setClusterSets] = React.useState<ClusterSet[]>([]);
  const [activeClusterSetId, setActiveClusterSetId] = React.useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<DashboardOverview | null>(null);
  const [reps, setReps] = React.useState<RepMini[]>([]);
  const [clusterInspector, setClusterInspector] = React.useState<ClusterInspector | null>(null);
  const [clusterInspectorLoading, setClusterInspectorLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const rReps = await api('/v1/reps');
        setReps(rReps.items || rReps.reps || []);
        const r = await api('/v1/cluster-sets');
        const items: ClusterSet[] = (r.items || []).filter((x: any) => x.status === 'complete');
        setClusterSets(items);
        setActiveClusterSetId(items[0]?.id ?? null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load cluster sets');
      }
    })();
  }, []);

  // Load selected cluster inspector (compact card)
  React.useEffect(() => {
    if (!selectedClusterId) {
      setClusterInspector(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setClusterInspectorLoading(true);
      try {
        const r = await api(`/v1/clusters/${selectedClusterId}/inspector`);
        if (!cancelled) setClusterInspector(r as any);
      } catch {
        if (!cancelled) setClusterInspector(null);
      } finally {
        if (!cancelled) setClusterInspectorLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClusterId]);

  const repNameById = React.useMemo(() => new Map(reps.map((r) => [r.id, r.name])), [reps]);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api(`/v1/dashboard/overview?range=${range}${activeClusterSetId ? `&cluster_set_id=${encodeURIComponent(activeClusterSetId)}` : ''}`);
        setOverview(r);
      } catch (e: any) {
        setError(e?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [range, activeClusterSetId]);

  return (
    <AppShell title="Dashboard">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TimeRangeToggle value={range} onChange={setRange} />
            <div className="hidden text-sm text-mutedForeground md:block">
              Ops map + KPIs for {range === 'week' ? 'this week' : range === 'month' ? 'this month' : 'all time'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="h-10 rounded-xl border border-input bg-card px-3 text-sm text-foreground shadow-soft"
              value={activeClusterSetId ?? ''}
              onChange={(e) => setActiveClusterSetId(e.target.value || null)}
            >
              {clusterSets.length === 0 ? <option value="">No cluster sets</option> : null}
              {clusterSets.map((cs) => (
                <option key={cs.id} value={cs.id}>
                  {cs.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedClusterId(null);
              }}
            >
              Clear selection
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-destructive shadow-soft">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <div className="rounded-2xl border border-border bg-card p-3 shadow-soft">
              <div className="mb-2 flex items-center justify-between px-2">
                <div>
                  <div className="text-sm font-medium">Ops Map</div>
                  <div className="text-xs text-mutedForeground">
                    Clusters by rep • live locations • property points load only when zoomed in
                  </div>
                </div>
                {selectedClusterId ? (
                  <div className="text-xs text-mutedForeground">
                    Selected cluster: <span className="font-medium text-foreground">{selectedClusterId.slice(0, 6)}…</span>
                  </div>
                ) : null}
              </div>
              <OpsMap
                clusterSetId={activeClusterSetId}
                selectedClusterId={selectedClusterId}
                onSelectCluster={(id) => setSelectedClusterId(id)}
              />
            </div>
          </div>

          <div className="xl:col-span-4">
            {selectedClusterId ? (
              <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Selected cluster</div>
                    <div className="mt-1 truncate text-xs text-mutedForeground">{selectedClusterId}</div>
                  </div>
                  {activeClusterSetId ? (
                    <Link
                      href={`/app/territories/${activeClusterSetId}?cluster=${encodeURIComponent(selectedClusterId)}`}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium shadow-soft hover:bg-card"
                    >
                      Open inspector
                    </Link>
                  ) : null}
                </div>

                {clusterInspectorLoading ? (
                  <div className="mt-3 text-sm text-mutedForeground">Loading cluster summary…</div>
                ) : clusterInspector ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-mutedForeground">Houses</div>
                      <div className="text-base font-semibold">{fmtNumber(clusterInspector.summary.house_count)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-mutedForeground">Potential</div>
                      <div className="text-base font-semibold">{fmtCurrency(clusterInspector.summary.total_potential)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-mutedForeground">Assigned rep</div>
                      <div className="truncate text-base font-semibold">
                        {clusterInspector.summary.assigned_rep_id
                          ? repNameById.get(clusterInspector.summary.assigned_rep_id) ?? 'Assigned'
                          : 'Unassigned'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-mutedForeground">Follow-ups due</div>
                      <div className="text-base font-semibold">{fmtNumber(clusterInspector.summary.followups_due)}</div>
                    </div>

                    <div className="col-span-2 rounded-xl border border-border bg-background/50 p-3">
                      <div className="text-xs text-mutedForeground">Status rollups</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {Object.entries(clusterInspector.summary.status_rollups || {}).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between text-xs">
                            <span className="text-mutedForeground">{k}</span>
                            <span className="font-semibold text-foreground">{fmtNumber(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-mutedForeground">No summary available.</div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
              <StatCard label="Doors / hr" value={loading ? '…' : fmtNumber(overview?.derived.doors_per_hour, 1)} hint="Doors ÷ hours" />
              <StatCard label="Close rate" value={loading ? '…' : fmtPercent(overview?.derived.close_rate, 1)} hint="Sold ÷ leads" />
              <StatCard label="Leads" value={loading ? '…' : fmtNumber(overview?.totals.leads)} />
              <StatCard label="Quotes" value={loading ? '…' : fmtNumber(overview?.totals.quotes)} />
              <StatCard label="Sold" value={loading ? '…' : fmtNumber(overview?.totals.sold)} />
              <StatCard label="Revenue" value={loading ? '…' : fmtCurrency(overview?.totals.revenue)} />
              <StatCard label="Follow-ups due" value={loading ? '…' : fmtNumber(overview?.totals.followups_due)} />
              <StatCard label="Jobs completed" value={loading ? '…' : fmtNumber(overview?.totals.jobs_completed)} />
              <StatCard label="Payments collected" value={loading ? '…' : fmtCurrency(overview?.totals.payments_collected)} />
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Rep vs Team Average</div>
                  <div className="text-xs text-mutedForeground">Top + bottom performers for the selected range</div>
                </div>
                <Button variant="ghost" onClick={() => (window.location.href = '/app/analytics')}>
                  View analytics
                </Button>
              </div>

              {overview?.repLeaderboard?.length ? (
                <div className="mt-3 space-y-2">
                  {overview.repLeaderboard.slice(0, 6).map((r, idx) => (
                    <div
                      key={r.rep_id}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {idx + 1}. {r.rep_name}
                        </div>
                        <div className="text-xs text-mutedForeground">
                          Doors {r.doors} • Sold {r.sold}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{fmtCurrency(r.revenue)}</div>
                        <div className="text-xs text-mutedForeground">Score {fmtNumber(r.score)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-mutedForeground">
                  No stats yet. Run the demo seed (see README) to populate charts, leaderboards and map overlays.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
