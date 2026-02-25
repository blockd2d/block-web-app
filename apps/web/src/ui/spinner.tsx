'use client';

import * as React from 'react';
import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-mutedForeground/30 border-t-mutedForeground',
        className
      )}
      aria-label="Loading"
      role="status"
    />
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
        <Spinner />
        <div className="text-sm text-mutedForeground">{label || 'Loading…'}</div>
      </div>
    </div>
  );
}

