'use client';

import * as React from 'react';
import { AppShell } from '../../../ui/shell';
import { TimeRangeToggle } from '../../../ui/time-range-toggle';
import { StatCard } from '../../../ui/stat-card';
import { api } from '../../../lib/api';
import { fmtCurrency, fmtNumber, fmtPercent, TimeRange } from '../../../lib/format';
import { Button } from '../../../ui/button';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

type Summary = {
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
};

type TimeseriesRow = {
  date: string;
  doors: number;
  leads: number;
  quotes: number;
  sold: number;
  revenue: number;
};

type LeaderRow = {
  rep_id: string;
  rep_name: string;
  doors: number;
  leads: number;
  quotes: number;
  sold: number;
  revenue: number;
  score: number;
  delta_score: number;
};

export default function AnalyticsPage() {
  const [range, setRange] = React.useState<TimeRange>('week');
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [series, setSeries] = React.useState<TimeseriesRow[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<LeaderRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [rSummary, rSeries, rLeader] = await Promise.all([
          api(`/v1/analytics/summary?range=${range}`),
          api(`/v1/analytics/timeseries?range=${range}`),
          api(`/v1/analytics/leaderboard?range=${range}`)
        ]);
        setSummary(rSummary);
        setSeries(rSeries.items || []);
        setLeaderboard(rLeader.items || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    })();
  }, [range]);

  const funnel = summary
    ? [
        { stage: 'Doors', value: summary.totals.doors },
        { stage: 'Leads', value: summary.totals.leads },
        { stage: 'Quotes', value: summary.totals.quotes },
        { stage: 'Sold', value: summary.totals.sold }
      ]
    : [];

  return (
    <AppShell title="Analytics">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TimeRangeToggle value={range} onChange={setRange} />
          <Button variant="secondary" onClick={() => (window.location.href = '/app/dashboard')}>
            Back to dashboard
          </Button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm text-destructive shadow-soft">{error}</div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Doors / hr" value={loading ? '…' : fmtNumber(summary?.derived.doors_per_hour, 1)} hint="Doors ÷ hours" />
          <StatCard label="Close rate" value={loading ? '…' : fmtPercent(summary?.derived.close_rate, 1)} hint="Sold ÷ leads" />
          <StatCard label="Revenue" value={loading ? '…' : fmtCurrency(summary?.totals.revenue)} />
          <StatCard label="Payments" value={loading ? '…' : fmtCurrency(summary?.totals.payments_collected)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Activity over time</div>
                  <div className="text-xs text-mutedForeground">Doors, leads, quotes, sold, revenue</div>
                </div>
              </div>

              {series.length ? (
                <div className="mt-3 h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12
                        }}
                      />
                      <Line type="monotone" dataKey="doors" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="leads" stroke="hsl(var(--accent))" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="quotes" stroke="hsl(var(--ring))" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="sold" stroke="hsl(var(--foreground))" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-mutedForeground">
                  No chart data yet. Run the demo seed to populate daily stats.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="text-sm font-semibold">Conversion funnel</div>
              <div className="text-xs text-mutedForeground">Simple funnel from doors → sold</div>

              {funnel.length ? (
                <div className="mt-3 h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnel} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="stage" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 12
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[10, 10, 10, 10]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-mutedForeground">
                  No data yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Leaderboard</div>
              <div className="text-xs text-mutedForeground">Score trend vs prior period</div>
            </div>
          </div>

          {leaderboard.length ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2">Rep</th>
                    <th className="px-3 py-2">Doors</th>
                    <th className="px-3 py-2">Sold</th>
                    <th className="px-3 py-2">Revenue</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((r) => (
                    <tr key={r.rep_id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{r.rep_name}</td>
                      <td className="px-3 py-2">{r.doors}</td>
                      <td className="px-3 py-2">{r.sold}</td>
                      <td className="px-3 py-2">{fmtCurrency(r.revenue)}</td>
                      <td className="px-3 py-2">{fmtNumber(r.score)}</td>
                      <td className="px-3 py-2 text-mutedForeground">{r.delta_score >= 0 ? '+' : ''}{fmtNumber(r.delta_score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-mutedForeground">
              No reps yet. Invite reps or run the demo seed.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
