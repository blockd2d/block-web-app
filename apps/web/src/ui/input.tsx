import clsx from 'clsx';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={clsx(
        'mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground',
        'placeholder:text-mutedForeground focus:outline-none focus:ring-2 focus:ring-ring/40',
        className
      )}
      {...rest}
    />
  );
}
