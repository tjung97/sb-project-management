export default function ProjectLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 rounded bg-secondary" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]">
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="h-8 w-72 rounded bg-secondary" />
            <div className="mt-3 h-3 w-full max-w-xl rounded bg-secondary" />
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-16 rounded-md bg-secondary" />
              ))}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-80 rounded-lg border border-border bg-card shadow-card" />
            ))}
          </div>
        </div>
        <aside className="h-96 rounded-lg border border-border bg-card shadow-card" />
      </div>
    </div>
  );
}
