'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from './button';

/**
 * Theme toggle with explicit labels:
 * - Light Professional
 * - Dark Neon
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === 'dark';
  const currentLabel = isDark ? 'Dark Neon' : 'Light Professional';
  const nextLabel = isDark ? 'Light Professional' : 'Dark Neon';

  // Avoid hydration mismatch with next-themes.
  if (!mounted) {
    return (
      <Button variant="ghost" size="sm" aria-label="Theme" disabled className="justify-start">
        <Sun className="h-4 w-4" />
        <span className="text-xs">Theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Theme: ${currentLabel}`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={`Switch to ${nextLabel}`}
      className="justify-start"
    >
      {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      <span className="text-xs">{currentLabel}</span>
    </Button>
  );
}
