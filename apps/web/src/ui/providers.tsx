"use client";

import * as React from "react";
import dynamic from "next/dynamic";

function NoopTheme({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Load theme and posthog in separate chunks so next-themes/posthog-js are never
// in the layout bundle (avoids webpack "reading 'call' of undefined" when a dep resolves wrong).
const ThemeProvider = React.lazy(() =>
  import("./theme-provider")
    .then((m) => ({ default: m.ThemeProvider }))
    .catch(() => ({ default: NoopTheme }))
);

const PosthogInit = dynamic(
  () => import("./posthog-provider").then((m) => m.PosthogInit),
  { ssr: false }
);

class ProviderErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[Providers] Theme/posthog failed to load:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ProviderErrorBoundary fallback={<>{children}</>}>
      <React.Suspense fallback={<>{children}</>}>
        <ThemeProvider>
          <PosthogInit />
          {children}
        </ThemeProvider>
      </React.Suspense>
    </ProviderErrorBoundary>
  );
}
