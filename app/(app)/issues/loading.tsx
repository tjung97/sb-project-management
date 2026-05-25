export default function IssuesLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-28 rounded bg-secondary" />
          <div className="mt-1 h-3 w-40 rounded bg-secondary" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-md bg-secondary" />
          <div className="h-8 w-24 rounded-md bg-secondary" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card shadow-card">
        <div className="border-b border-border px-4 py-2.5">
          <div className="h-3 w-36 rounded bg-secondary" />
        </div>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="h-3 w-48 rounded bg-secondary" />
          <div className="h-7 w-16 rounded-md bg-secondary" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card shadow-card">
        <div className="h-10 border-b border-border bg-secondary/40" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border-b border-border px-5 py-4 last:border-b-0">
            <div className="h-4 w-48 rounded bg-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
