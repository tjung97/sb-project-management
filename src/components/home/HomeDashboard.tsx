import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  DollarSign,
  FolderKanban,
  MessagesSquare,
  Store,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export interface HomeDashboardData {
  greeting: string;
  userName: string;
  dateLabel: string;
  issues: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
    total: number;
    completedThisWeek: number;
    overdue: number;
    unassigned: number;
    newThisWeek: number;
  };
  statusSegments: Array<{ label: string; value: number; color: string }>;
  projects: Array<{ id: string; title: string; status: string; open: number; done: number; total: number; pct: number }>;
  activeProjectCount: number;
  toast: {
    configured: boolean;
    netSales: number;
    orderCount: number;
    laborHours: number;
    laborCost: number;
    topItems: Array<{ name: string; quantity: number }>;
    error: string | null;
  };
  sling: {
    configured: boolean;
    ok: number;
    attention: number;
    alert: number;
    total: number;
    missedTasks: number;
    coverageGaps: number;
    stores: Array<{ name: string; overall: "ok" | "attention" | "alert" }>;
    error: string | null;
  };
  schedule: { posted: number; total: number; nextRangeLabel: string | null };
  calendar: Array<{ id: string; title: string; dateLabel: string; color: string | null }>;
}

export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  return (
    <div className="space-y-6">
      <HeroBand data={data} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Open issues" value={data.issues.open} icon={<ClipboardList className="h-4 w-4" />} href="/issues" />
        <KpiTile label="Done this week" value={data.issues.completedThisWeek} tone="success" icon={<ClipboardList className="h-4 w-4" />} href="/reports" />
        <KpiTile
          label="Net sales today"
          value={data.toast.configured ? money.format(data.toast.netSales) : "—"}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <KpiTile
          label="Labor today"
          value={data.toast.configured ? `${data.toast.laborHours.toFixed(0)}h` : "—"}
          icon={<Timer className="h-4 w-4" />}
        />
        <KpiTile
          label="Store alerts"
          value={data.sling.configured ? data.sling.alert : "—"}
          tone={data.sling.alert > 0 ? "destructive" : undefined}
          icon={<TriangleAlert className="h-4 w-4" />}
          href="/operations"
        />
        <KpiTile
          label="Schedules posted"
          value={data.sling.configured ? `${data.schedule.posted}/${data.schedule.total}` : "—"}
          icon={<CalendarDays className="h-4 w-4" />}
          href="/operations/schedule"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <WorkHealthCard data={data} />
          <ProjectsCard data={data} />
        </div>
        <div className="space-y-4">
          <SalesCard data={data} />
          <StoreOpsCard data={data} />
          <UpcomingCard data={data} />
        </div>
      </div>
    </div>
  );
}

function HeroBand({ data }: { data: HomeDashboardData }) {
  return (
    <section className="dash-hero dash-rise rounded-2xl border border-border/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="live-dot text-success">
              <span className="block h-2 w-2 rounded-full bg-success" />
            </span>
            Live overview · {data.dateLabel}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {data.greeting}
            {data.userName ? `, ${data.userName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.issues.open} open · {data.issues.blocked} blocked · {data.issues.overdue} overdue
            {data.sling.configured ? <> · {data.sling.alert} store alert{data.sling.alert === 1 ? "" : "s"}</> : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/issues"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm font-medium transition hover:border-foreground/20 hover:bg-accent/40"
          >
            <ClipboardList className="h-4 w-4" /> Issues
          </Link>
          <Link
            href="/operations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-3 py-2 text-sm font-medium transition hover:border-foreground/20 hover:bg-accent/40"
          >
            <MessagesSquare className="h-4 w-4" /> Store monitor
          </Link>
        </div>
      </div>
    </section>
  );
}

function KpiTile({
  label,
  value,
  tone,
  icon,
  href,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "destructive";
  icon?: React.ReactNode;
  href?: string;
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  const body = (
    <div className="dash-card h-full rounded-xl border border-border/80 bg-card p-3">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[11px] font-medium">{label}</span>
        {icon ? <span className={toneClass}>{icon}</span> : null}
      </div>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function WorkHealthCard({ data }: { data: HomeDashboardData }) {
  const segments = data.statusSegments.filter((s) => s.value > 0);
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let acc = 0;
  const stops = segments
    .map((s) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(", ");
  const completion = data.issues.total > 0 ? Math.round((data.issues.done / data.issues.total) * 100) : 0;

  return (
    <Card title="Work health" icon={<ClipboardList className="h-4 w-4" />} href="/reports" hrefLabel="Reports">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div className="relative h-32 w-32 shrink-0">
          <div
            className="h-32 w-32 rounded-full"
            style={{ background: segments.length ? `conic-gradient(${stops})` : "hsl(var(--muted))" }}
          />
          <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-card">
            <span className="text-2xl font-semibold tabular-nums">{completion}%</span>
            <span className="text-[10px] text-muted-foreground">complete</span>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2">
          {data.statusSegments.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="ml-auto font-medium tabular-nums">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <HealthChip label="Blocked" value={data.issues.blocked} tone={data.issues.blocked ? "warning" : undefined} />
        <HealthChip label="Overdue" value={data.issues.overdue} tone={data.issues.overdue ? "destructive" : undefined} />
        <HealthChip label="Unassigned" value={data.issues.unassigned} tone={data.issues.unassigned ? "warning" : undefined} />
      </div>
    </Card>
  );
}

function ProjectsCard({ data }: { data: HomeDashboardData }) {
  return (
    <Card
      title="Project progress"
      icon={<FolderKanban className="h-4 w-4" />}
      href="/projects"
      hrefLabel={`${data.activeProjectCount} active`}
    >
      {data.projects.length ? (
        <ul className="space-y-3">
          {data.projects.map((p) => (
            <li key={p.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <Link href={`/projects/${p.id}`} className="min-w-0 truncate font-medium hover:underline">
                  {p.title}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {p.done}/{p.total} · {p.pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="progress-fill h-full rounded-full" style={{ width: `${p.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No active projects.</p>
      )}
    </Card>
  );
}

function SalesCard({ data }: { data: HomeDashboardData }) {
  if (!data.toast.configured) {
    return (
      <Card title="Today at the counter" icon={<DollarSign className="h-4 w-4" />}>
        <p className="text-sm text-muted-foreground">{data.toast.error ?? "Toast not configured."}</p>
      </Card>
    );
  }
  return (
    <Card title="Today at the counter" icon={<DollarSign className="h-4 w-4" />}>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Net sales" value={money.format(data.toast.netSales)} />
        <Metric label="Orders" value={String(data.toast.orderCount)} />
        <Metric label="Labor hrs" value={`${data.toast.laborHours.toFixed(1)}h`} />
        <Metric label="Labor cost" value={money.format(data.toast.laborCost)} />
      </div>
      {data.toast.topItems.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Top items</p>
          <ul className="space-y-1.5">
            {data.toast.topItems.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate">{item.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{item.quantity.toFixed(0)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function StoreOpsCard({ data }: { data: HomeDashboardData }) {
  if (!data.sling.configured) {
    return (
      <Card title="Store operations" icon={<Store className="h-4 w-4" />} href="/operations" hrefLabel="Monitor">
        <p className="text-sm text-muted-foreground">{data.sling.error ?? "Sling not configured."}</p>
      </Card>
    );
  }
  return (
    <Card title="Store operations" icon={<Store className="h-4 w-4" />} href="/operations" hrefLabel="Monitor">
      <div className="mb-3 flex gap-2 text-xs">
        <StatusPill count={data.sling.ok} label="OK" tone="ok" />
        <StatusPill count={data.sling.attention} label="Attention" tone="attention" />
        <StatusPill count={data.sling.alert} label="Alert" tone="alert" />
      </div>
      <ul className="space-y-1.5">
        {data.sling.stores.map((store) => (
          <li key={store.name} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                store.overall === "ok" && "bg-success",
                store.overall === "attention" && "bg-warning",
                store.overall === "alert" && "bg-destructive"
              )}
            />
            <span className="min-w-0 truncate">{store.name}</span>
          </li>
        ))}
      </ul>
      {data.sling.coverageGaps > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlert className="h-3.5 w-3.5" />
          {data.sling.coverageGaps} day(s) with uncovered shift windows
        </p>
      ) : null}
      {data.sling.missedTasks > 0 ? (
        <p className="mt-1 text-xs text-destructive">{data.sling.missedTasks} missed checklist task(s) today</p>
      ) : null}
    </Card>
  );
}

function UpcomingCard({ data }: { data: HomeDashboardData }) {
  return (
    <Card title="Upcoming" icon={<CalendarDays className="h-4 w-4" />}>
      {data.calendar.length ? (
        <ul className="space-y-2">
          {data.calendar.map((event) => (
            <li key={event.id} className="flex items-center gap-2 text-xs">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", colorDot(event.color))} />
              <span className="min-w-0 truncate">{event.title}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">{event.dateLabel}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
      )}
    </Card>
  );
}

// ---- shared bits ----

function Card({
  title,
  icon,
  href,
  hrefLabel,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="dash-card dash-rise rounded-xl border border-border/80 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          {title}
        </h2>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground">
            {hrefLabel ?? "View"} <ArrowRight className="h-3 w-3" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-semibold leading-none">{value}</p>
    </div>
  );
}

function HealthChip({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" }) {
  const toneClass =
    tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "text-foreground";
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2 text-center">
      <p className={cn("text-lg font-semibold leading-none tabular-nums", toneClass)}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusPill({ count, label, tone }: { count: number; label: string; tone: "ok" | "attention" | "alert" }) {
  const map = {
    ok: "success" as const,
    attention: "warning" as const,
    alert: "destructive" as const,
  };
  return (
    <Badge variant={count > 0 ? map[tone] : "muted"} className="flex-1 justify-center">
      {count} {label}
    </Badge>
  );
}

function colorDot(color: string | null) {
  switch (color) {
    case "green":
      return "bg-success";
    case "red":
      return "bg-destructive";
    case "yellow":
      return "bg-warning";
    case "purple":
      return "bg-role-admin";
    case "blue":
    default:
      return "bg-info";
  }
}
