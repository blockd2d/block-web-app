'use client';

import * as React from 'react';
import { AppShell } from '@/ui/shell';
import { api } from '@/lib/api';
import { Button } from '@/ui/button';
import { StatCard } from '@/ui/stat-card';
import { AnimatePresence, motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

type Range = 'week' | 'month' | 'all';

type Summary = {
  doors: number;
  leads: number;
  quotes: number;
  sold: number;
  revenue: number;
  doors_per_hour: number;
  close_rate: number;
};

type LeaderRow = {
  rep_id: string;
  rep_name: string;
  doors: number;
  leads: number;
  quotes: number;
  sold: number;
  revenue: number;
  doors_per_hour: number;
  close_rate: number;
  delta_score?: number | null;
};

type TSPoint = {
  date: string;
  doors: number;
  leads: number;
  quotes: number;
  sold: number;
  revenue: number;
};

const RANGES: Array<{ id: Range; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All-time' }
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtPct(n: number) {
  return `${Math.round((n || 0) * 100)}%`;
}

function deltaBadge(delta: number | null | undefined) {
  if (delta == null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}`;
}

export default function RepsPage() {
  const [range, setRange] = React.useState<Range>('week');
  const [loading, setLoading] = React.useState(true);
  const [team, setTeam] = React.useState<Summary | null>(null);
  const [leaderboard, setLeaderboard] = React.useState<LeaderRow[]>([]);
  const [selected, setSelected] = React.useState<LeaderRow | null>(null);
  const [repSummary, setRepSummary] = React.useState<Summary | null>(null);
  const [repTs, setRepTs] = React.useState<TSPoint[]>([]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api(`/v1/analytics/summary?range=${range}`),
      api(`/v1/analytics/leaderboard?range=${range}`)
    ])
      .then(([s, lb]) => {
        if (!alive) return;
        setTeam(s.summary || s);
        setLeaderboard((lb.items || lb.leaderboard || []) as any);
      })
      .catch((e) => console.error(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range]);

  React.useEffect(() => {
    if (!selected) return;
    let alive = true;
    Promise.all([
      api(`/v1/analytics/summary?range=${range}&rep_id=${encodeURIComponent(selected.rep_id)}`),
      api(`/v1/analytics/timeseries?range=${range}&rep_id=${encodeURIComponent(selected.rep_id)}`)
    ])
      .then(([s, t]) => {
        if (!alive) return;
        setRepSummary(s.summary || s);
        setRepTs((t.items || t.points || []) as any);
      })
      .catch((e) => console.error(e));
    return () => {
      alive = false;
    };
  }, [selected, range]);

  const top = leaderboard.slice().sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 3);
  const bottom = leaderboard.slice().sort((a, b) => (a.sold || 0) - (b.sold || 0)).slice(0, 3);

  return (
    <AppShell title="Reps">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-mutedForeground">Rep performance and comparisons.</div>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {RANGES.map((r) => (
            <Button
              key={r.id}
              size="sm"
              variant={range === r.id ? 'primary' : 'ghost'}
              className="rounded-lg"
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <StatCard label="Team doors" value={loading ? '—' : (team?.doors ?? 0)} hint="Total" />
        <StatCard label="Team sold" value={loading ? '—' : (team?.sold ?? 0)} hint={`Close rate ${fmtPct(team?.close_rate ?? 0)}`} />
        <StatCard label="Team revenue" value={loading ? '—' : fmtMoney(team?.revenue ?? 0)} hint="Booked" />
        <StatCard label="Doors/hour" value={loading ? '—' : (team ? team.doors_per_hour.toFixed(1) : '0.0')} hint="Team average" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-sm font-semibold">Top reps</div>
          <div className="mt-3 grid gap-2">
            {top.length === 0 ? (
              <div className="text-sm text-mutedForeground">No data yet — run the seed script.</div>
            ) : (
              top.map((r) => (
                <button
                  key={r.rep_id}
                  onClick={() => setSelected(r)}
                  className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2 text-left hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.rep_name}</div>
                    <div className="text-xs text-mutedForeground">
                      Sold {r.sold} • Revenue {fmtMoney(r.revenue)}
                    </div>
                  </div>
                  <div className="text-xs text-mutedForeground">Δ {deltaBadge(r.delta_score ?? null)}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="text-sm font-semibold">Needs attention</div>
          <div className="mt-3 grid gap-2">
            {bottom.length === 0 ? (
              <div className="text-sm text-mutedForeground">No data yet — run the seed script.</div>
            ) : (
              bottom.map((r) => (
                <button
                  key={r.rep_id}
                  onClick={() => setSelected(r)}
                  className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2 text-left hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.rep_name}</div>
                    <div className="text-xs text-mutedForeground">
                      Sold {r.sold} • Doors {r.doors}
                    </div>
                  </div>
                  <div className="text-xs text-mutedForeground">Δ {deltaBadge(r.delta_score ?? null)}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">All reps</div>
          <div className="text-xs text-mutedForeground">Click a rep for details</div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {leaderboard.map((r) => {
            const teamDoorsHr = team?.doors_per_hour ?? 0;
            const teamClose = team?.close_rate ?? 0;
            const doorsHrDelta = (r.doors_per_hour || 0) - teamDoorsHr;
            const closeDelta = (r.close_rate || 0) - teamClose;
            return (
              <motion.button
                key={r.rep_id}
                whileHover={{ y: -2 }}
                onClick={() => setSelected(r)}
                className="rounded-2xl border border-border bg-card p-4 text-left shadow-soft hover:border-ring"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{r.rep_name}</div>
                    <div className="mt-1 text-xs text-mutedForeground">
                      Doors {r.doors} • Leads {r.leads} • Quotes {r.quotes} • Sold {r.sold}
                    </div>
                  </div>
                  <div className="text-xs text-mutedForeground">Δ {deltaBadge(r.delta_score ?? null)}</div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="text-[11px] text-mutedForeground">Revenue</div>
                    <div className="mt-1 text-base font-semibold">{fmtMoney(r.revenue)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-3">
                    <div className="text-[11px] text-mutedForeground">Close rate</div>
                    <div className="mt-1 text-base font-semibold">{fmtPct(r.close_rate)}</div>
                    <div className="mt-1 text-[11px] text-mutedForeground">
                      vs team {closeDelta >= 0 ? '+' : ''}{Math.round(closeDelta * 100)}%
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-mutedForeground">
                  Doors/hr {r.doors_per_hour.toFixed(1)} (vs team {doorsHrDelta >= 0 ? '+' : ''}{doorsHrDelta.toFixed(1)})
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selected ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold">{selected.rep_name}</div>
                  <div className="mt-1 text-sm text-mutedForeground">Rep vs team average ({range})</div>
                </div>
                <Button variant="ghost" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <StatCard label="Doors" value={repSummary ? repSummary.doors : '—'} />
                <StatCard label="Sold" value={repSummary ? repSummary.sold : '—'} hint={`Close ${fmtPct(repSummary?.close_rate ?? 0)}`} />
                <StatCard label="Revenue" value={repSummary ? fmtMoney(repSummary.revenue) : '—'} />
                <StatCard label="Doors/hr" value={repSummary ? repSummary.doors_per_hour.toFixed(1) : '—'} />
              </div>

              <div className="mt-6 rounded-2xl border border-border bg-background/40 p-4">
                <div className="text-sm font-semibold">Activity trend</div>
                <div className="mt-3 h-64">
                  {repTs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-mutedForeground">No data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={repTs} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="doors" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="leads" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="sold" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="mt-3 text-xs text-mutedForeground">
                Tip: Seed demo data from the API repo to populate this view.
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AppShell>
  );
}
