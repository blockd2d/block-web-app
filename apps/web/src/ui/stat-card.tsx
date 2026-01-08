export function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="text-sm text-mutedForeground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-mutedForeground">{hint}</div> : null}
    </div>
  );
}
