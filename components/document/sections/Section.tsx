export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted)]">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}
