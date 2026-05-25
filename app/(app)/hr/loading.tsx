export default function HrLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 rounded bg-secondary" />
      <div className="h-3 w-64 rounded bg-secondary" />
      <div className="rounded-lg border border-border bg-card">
        <div className="h-10 border-b border-border bg-secondary/40" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-14 border-b border-border last:border-b-0" />
        ))}
      </div>
    </div>
  );
}
