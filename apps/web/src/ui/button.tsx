import * as React from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
  }
) {
  const { className, variant = 'primary', size = 'md', ...rest } = props;

  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-60 disabled:cursor-not-allowed';

  const variants: Record<Variant, string> = {
    primary: 'bg-primary text-primaryForeground shadow-soft hover:opacity-90',
    secondary: 'bg-secondary text-secondaryForeground hover:opacity-90',
    ghost: 'bg-transparent text-foreground hover:bg-muted',
    destructive: 'bg-destructive text-destructiveForeground hover:opacity-90'
  };

  const sizes: Record<Size, string> = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-base',
    icon: 'h-10 w-10 p-0'
  };

  return <button className={clsx(base, variants[variant], sizes[size], className)} {...rest} />;
}
