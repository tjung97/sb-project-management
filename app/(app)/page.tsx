import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { listCalendarEvents, listIssues, listProjects } from "@/src/lib/ops/data";
import { getToastOpsSummary } from "@/src/lib/toast/api";
import { getSlingMonitor } from "@/src/lib/sling/api";
import { getRecentStockOutages } from "@/src/lib/ops/stock-events";
import { HomeDashboard, type HomeDashboardData } from "@/src/components/home/HomeDashboard";
import { StockAlertBanner } from "@/src/components/home/StockAlertBanner";

export const dynamic = "force-dynamic";

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const uid = user?.uid ?? "";

  const [issues, projects, calendar, toast, sling, stockOutages] = await Promise.all([
    listIssues({ status: "all" }).catch(() => []),
    listProjects().catch(() => []),
    uid ? listCalendarEvents(uid).catch(() => []) : Promise.resolve([]),
    getToastOpsSummary().catch(() => null),
    getSlingMonitor().catch(() => null),
    getRecentStockOutages().catch(() => []),
  ]);

  const now = new Date();
  const weekStart = startOfWeek(now);

  const byStatus = (status: string) => issues.filter((i) => i.status === status).length;
  const open = issues.filter((i) => !["done", "closed"].includes(i.status));
  const completedThisWeek = issues.filter(
    (i) => ["done", "closed"].includes(i.status) && (i.closed_at?.toMillis() ?? 0) >= weekStart
  ).length;
  const overdue = open.filter((i) => i.due_at && i.due_at.toDate().getTime() < now.getTime()).length;
  const unassigned = open.filter((i) => i.assignee_uids.length === 0).length;
  const doneTotal = byStatus("done") + byStatus("closed");

  const statusSegments = [
    { label: "Open", value: byStatus("open"), color: "hsl(var(--info))" },
    { label: "In progress", value: byStatus("in_progress"), color: "hsl(var(--warning))" },
    { label: "Blocked", value: byStatus("blocked"), color: "hsl(var(--destructive))" },
    { label: "Done", value: byStatus("done"), color: "hsl(var(--success))" },
    { label: "Closed", value: byStatus("closed"), color: "hsl(var(--muted-foreground))" },
  ];

  const activeProjects = projects.filter((p) => p.status === "active");
  const topProjects = [...activeProjects]
    .map((p) => {
      const total = p.issue_count || 0;
      const done = p.done_issue_count || 0;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return { id: p.id, title: p.title, status: p.status, open: p.open_issue_count || 0, done, total, pct };
    })
    .sort((a, b) => b.open - a.open || b.total - a.total)
    .slice(0, 5);

  const upcoming = calendar
    .filter((e) => e.date.toMillis() >= startOfDay(now))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.title || "Untitled",
      color: e.color,
      dateLabel: new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(e.date.toDate()),
    }));

  const data: HomeDashboardData = {
    greeting: greeting(now),
    userName: firstName(user?.name ?? user?.email ?? ""),
    dateLabel: new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" }).format(now),
    issues: {
      open: open.length,
      inProgress: byStatus("in_progress"),
      blocked: byStatus("blocked"),
      done: doneTotal,
      total: issues.length,
      completedThisWeek,
      overdue,
      unassigned,
      newThisWeek: issues.filter((i) => i.created_at.toMillis() >= weekStart).length,
    },
    statusSegments,
    projects: topProjects,
    activeProjectCount: activeProjects.length,
    toast: {
      configured: Boolean(toast?.configured),
      netSales: toast?.sales.netSales ?? 0,
      orderCount: toast?.sales.orderCount ?? 0,
      laborHours: toast?.labor.laborHours ?? 0,
      laborCost: toast?.labor.laborCost ?? 0,
      topItems: (toast?.sales.productMix ?? []).slice(0, 4).map((m) => ({ name: m.name, quantity: m.quantity })),
      error: toast?.error ?? null,
    },
    sling: {
      configured: Boolean(sling?.configured),
      ok: sling?.summary.ok ?? 0,
      attention: sling?.summary.attention ?? 0,
      alert: sling?.summary.alert ?? 0,
      total: sling?.summary.total ?? 0,
      missedTasks: sling?.summary.missedTasks ?? 0,
      coverageGaps: sling?.summary.coverageGaps ?? 0,
      stores: (sling?.stores ?? []).map((s) => ({ name: s.name, overall: s.overall })),
      error: sling?.error ?? null,
    },
    schedule: {
      posted: sling?.summary.schedulesPosted ?? 0,
      total: sling?.summary.total ?? 0,
      nextRangeLabel: sling?.stores[0]?.schedule.nextWeekRangeLabel ?? null,
    },
    calendar: upcoming,
  };

  return (
    <>
      <HomeDashboard data={data} />
      <StockAlertBanner events={stockOutages} />
    </>
  );
}

function greeting(now: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(value: string): string {
  const name = value.includes("@") ? value.split("@")[0] : value;
  return name.split(/[ .]/)[0].replace(/^\w/, (c) => c.toUpperCase());
}

function startOfWeek(d: Date): number {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m.getTime();
}

function startOfDay(d: Date): number {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.getTime();
}
