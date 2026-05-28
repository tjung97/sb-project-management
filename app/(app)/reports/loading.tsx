export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="h-8 w-28 rounded bg-secondary" />
          <div className="mt-2 h-3 w-80 rounded bg-secondary" />
        </div>
        <div className="h-8 w-28 rounded-md bg-secondary" />
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 rounded-lg border border-border bg-card shadow-card" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-56 rounded-lg border border-border bg-card shadow-card" />
        ))}
      </div>
    </div>
  );
}
