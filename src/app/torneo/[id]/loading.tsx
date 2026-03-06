export default function TorneoLoading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="h-5 w-24 rounded bg-[var(--surface-2)]" />
        <div className="mt-3 h-8 w-64 rounded bg-[var(--surface-2)]" />
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <div className="h-4 rounded bg-[var(--surface-2)]" />
          <div className="h-4 rounded bg-[var(--surface-2)]" />
          <div className="h-4 rounded bg-[var(--surface-2)]" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="h-44 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="h-5 w-28 rounded bg-[var(--surface-2)]" />
            <div className="mt-4 space-y-2">
              <div className="h-9 rounded bg-[var(--surface-2)]" />
              <div className="h-9 rounded bg-[var(--surface-2)]" />
              <div className="h-9 rounded bg-[var(--surface-2)]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
