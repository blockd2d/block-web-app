'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0a] text-[#fafafa] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-[#27272a] bg-[#18181b] p-6">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">
            The app hit a critical error. Try refreshing or go to the homepage.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-xl bg-[#3b82f6] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-[#27272a] bg-[#27272a] px-4 py-2 text-sm font-medium hover:bg-[#3f3f46]"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
