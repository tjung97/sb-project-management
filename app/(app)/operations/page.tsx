import { CheckCircle2, AlertTriangle, TriangleAlert, CalendarCheck } from "lucide-react";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { Card, CardContent } from "@/src/components/ui/card";
import { SlingRefreshButton } from "@/src/components/sling/SlingRefreshButton";
import { SlingMonitorBoard } from "@/src/components/sling/SlingMonitorBoard";
import { ToastOutOfStockPanel } from "@/src/components/toast/ToastOutOfStockPanel";
import { getSlingMonitor } from "@/src/lib/sling/api";
import { getAllToastOutOfStock } from "@/src/lib/toast/api";

export const dynamic = "force-dynamic";

export default async function OperationsPage() {
  const [monitor, stock] = await Promise.all([getSlingMonitor(), getAllToastOutOfStock().catch(() => [])]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store monitor"
        description="Live Sling chat activity and daily checklist compliance across stores."
      >
        <SlingRefreshButton computedAt={monitor.computedAt} />
      </PageHeader>

      {!monitor.configured ? (
        <SetupCard message={monitor.error} />
      ) : (
        <>
          {monitor.error ? (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="py-3 text-sm text-warning-foreground">{monitor.error}</CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Stores" value={monitor.summary.total} icon={<CalendarCheck className="h-4 w-4" />} />
            <Kpi label="On track" value={monitor.summary.ok} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
            <Kpi label="Attention" value={monitor.summary.attention} tone="warning" icon={<AlertTriangle className="h-4 w-4" />} />
            <Kpi label="Alerts" value={monitor.summary.alert} tone="destructive" icon={<TriangleAlert className="h-4 w-4" />} />
            <Kpi
              label="Coverage gaps"
              value={monitor.summary.coverageGaps}
              tone={monitor.summary.coverageGaps ? "destructive" : undefined}
              icon={<TriangleAlert className="h-4 w-4" />}
            />
            <Kpi label="Schedules posted" value={`${monitor.summary.schedulesPosted}/${monitor.summary.total}`} />
          </div>

          {stock.length ? <ToastOutOfStockPanel stores={stock} /> : null}

          {monitor.stores.length ? (
            <SlingMonitorBoard stores={monitor.stores} />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No stores returned yet. Try Refresh, or confirm SLING_SOURCES.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warning" | "destructive";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="dash-card rounded-xl border border-border/80 bg-card p-3">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-medium">{label}</span>
        {icon ? <span className={toneClass}>{icon}</span> : null}
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function SetupCard({ message }: { message: string | null }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-8">
        <h2 className="text-base font-semibold">Connect Sling</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {message ?? "Add Sling credentials to enable store monitoring."}
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Grab the <code className="rounded bg-muted px-1">Authorization</code> token from app.getsling.com (DevTools → Network).</li>
          <li>
            Add to <code className="rounded bg-muted px-1">.env.local</code>: <code className="rounded bg-muted px-1">SLING_TOKEN</code>,{" "}
            <code className="rounded bg-muted px-1">SLING_SOURCES</code> (e.g. <code className="rounded bg-muted px-1">conversation:123,…</code>), and optionally{" "}
            <code className="rounded bg-muted px-1">STORE_TIMEZONE</code>.
          </li>
          <li>Restart the dev server and Refresh.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
