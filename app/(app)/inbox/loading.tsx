export default function InboxLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-24 rounded bg-secondary" />
        <div className="mt-2 h-3 w-72 rounded bg-secondary" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-border bg-card shadow-card">
            <div className="border-b border-border px-5 py-4">
              <div className="h-4 w-40 rounded bg-secondary" />
              <div className="mt-2 h-3 w-64 rounded bg-secondary" />
            </div>
            {Array.from({ length: 4 }).map((__, rowIndex) => (
              <div key={rowIndex} className="border-b border-border px-5 py-4 last:border-b-0">
                <div className="h-4 w-3/4 rounded bg-secondary" />
                <div className="mt-2 h-3 w-1/2 rounded bg-secondary" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
