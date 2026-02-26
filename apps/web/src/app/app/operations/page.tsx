'use client';

import * as React from 'react';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { StatCard } from '../../../ui/stat-card';
import { fmtCurrency, fmtNumber, fmtPercent } from '../../../lib/format';
import { Button } from '../../../ui/button';

type Overview = {
  range: string;
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
  derived: { doors_per_hour: number; close_rate: number };
};

export default function OperationsPage() {
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get('/v1/dashboard/overview?range=week')
      .then((r: any) => setOverview(r as Overview))
      .catch((e: any) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Operations</h1>
      <p className="mt-1 text-sm text-mutedForeground">Week-at-a-glance: doors, follow-ups, jobs, payments.</p>

      {err ? (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructiveForeground">
          {err}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Doors" value={loading ? '…' : fmtNumber(overview?.totals.doors)} hint="This week" />
        <StatCard label="Follow-ups due" value={loading ? '…' : fmtNumber(overview?.totals.followups_due)} />
        <StatCard label="Jobs completed" value={loading ? '…' : fmtNumber(overview?.totals.jobs_completed)} />
        <StatCard label="Payments" value={loading ? '…' : fmtCurrency(overview?.totals.payments_collected)} />
        <StatCard label="Doors/hr" value={loading ? '…' : fmtNumber(overview?.derived.doors_per_hour, 1)} />
        <StatCard label="Close rate" value={loading ? '…' : fmtPercent(overview?.derived.close_rate, 1)} />
        <StatCard label="Revenue" value={loading ? '…' : fmtCurrency(overview?.totals.revenue)} />
        <StatCard label="Sold" value={loading ? '…' : fmtNumber(overview?.totals.sold)} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/app/knocks">
          <Button variant="secondary">Log knocks</Button>
        </Link>
        <Link href="/app/schedule">
          <Button variant="secondary">Schedule</Button>
        </Link>
        <Link href="/app/dashboard">
          <Button variant="secondary">Full dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
