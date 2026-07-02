// Komponentë të vegjël të ripërdorshëm të ndërfaqes
export function StatCard({ icon: Icon, label, value, tone = "pine", hint }) {
  const tones = {
    pine: "bg-pine-50 text-pine-600",
    amber: "bg-amber-100 text-amber-700",
    brick: "bg-brick-100 text-brick-700",
    ink: "bg-ink/5 text-ink"
  };
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon size={22} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</p>
        <p className="truncate font-display text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-ink/50">{hint}</p>}
      </div>
    </div>
  );
}

export function Badge({ children, tone = "pine" }) {
  const tones = {
    pine: "bg-pine-50 text-pine-700",
    amber: "bg-amber-100 text-amber-700",
    brick: "bg-brick-100 text-brick-700",
    ink: "bg-ink/5 text-ink/70"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Etiketë vendndodhjeje në stil korsie magazine (elementi identifikues i ndërfaqes)
export function LocationTag({ value }) {
  if (!value) return <span className="text-ink/35">—</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-ink/20 bg-paper px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-ink/80">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {value}
    </span>
  );
}

export function Field({ label, children, required }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-brick-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function EmptyState({ message = "Nuk ka të dhëna për të shfaqur." }) {
  return <p className="py-10 text-center text-sm text-ink/50">{message}</p>;
}
