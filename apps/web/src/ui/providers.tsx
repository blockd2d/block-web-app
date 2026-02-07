"use client";

import * as React from "react";
import { ThemeProvider } from "./theme-provider";
import { PosthogInit } from "./posthog-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <PosthogInit />
      {children}
    </ThemeProvider>
  );
}
