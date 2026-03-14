'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You&apos;re offline. Some features may be unavailable until connection is restored.</span>
    </div>
  );
}
