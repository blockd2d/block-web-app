'use client';

import clsx from 'clsx';
import { TimeRange } from '../lib/format';

export function TimeRangeToggle({
  value,
  onChange
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  const items: { label: string; value: TimeRange }[] = [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'All', value: 'all' }
  ];

  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-soft">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className={clsx(
              'h-9 rounded-lg px-3 text-sm font-medium transition-colors',
              active ? 'bg-muted text-foreground' : 'text-mutedForeground hover:bg-muted hover:text-foreground'
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
