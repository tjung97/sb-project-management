export default function IssueDetailLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="space-y-4 pb-0">
        <div className="h-4 w-28 rounded bg-secondary" />
        <div className="h-8 w-3/4 max-w-lg rounded bg-secondary" />
        <div className="flex flex-wrap gap-2">
          <div className="h-7 w-24 rounded-md bg-secondary" />
          <div className="h-6 w-16 rounded-md bg-secondary" />
          <div className="h-6 w-20 rounded-md bg-secondary" />
        </div>
      </div>

      <div className="border-t border-border pt-8">
        <div className="issue-page-layout grid gap-y-6 lg:grid-cols-[1fr_min(380px,32%)]">
        <div className="order-2 space-y-4 lg:order-1">
          <div className="h-32 rounded-lg border border-border bg-card shadow-card" />
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-28 rounded-lg border border-border bg-card shadow-card" />
            <div className="h-28 rounded-lg border border-border bg-card shadow-card" />
          </div>
          <div className="h-40 rounded-lg border border-border bg-card shadow-card" />
          <div className="h-24 rounded-lg border border-border bg-card shadow-card" />
        </div>
        <div className="order-1 h-10 rounded-lg bg-secondary lg:order-2 lg:h-80 lg:border lg:border-border lg:bg-card lg:shadow-card" />
        </div>
      </div>
    </div>
  );
}
