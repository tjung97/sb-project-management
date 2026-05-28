export default function ProjectsLoading() {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="h-8 w-32 rounded bg-secondary" />
          <div className="mt-2 h-3 w-64 rounded bg-secondary" />
        </div>
        <div className="rounded-lg border border-border bg-card shadow-card">
          <div className="grid grid-cols-[1fr_7rem_6rem_8rem_8rem] gap-3 border-b border-border px-4 py-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-3 rounded bg-secondary" />
            ))}
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="grid grid-cols-[1fr_7rem_6rem_8rem_8rem] gap-3 border-b border-border px-4 py-4 last:border-b-0">
              <div className="space-y-2">
                <div className="h-4 w-56 rounded bg-secondary" />
                <div className="h-3 w-72 rounded bg-secondary" />
              </div>
              {Array.from({ length: 4 }).map((__, itemIndex) => (
                <div key={itemIndex} className="h-4 rounded bg-secondary" />
              ))}
            </div>
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        <div className="h-72 rounded-lg border border-border bg-card shadow-card" />
        <div className="h-56 rounded-lg border border-border bg-card shadow-card" />
      </aside>
    </div>
  );
}
