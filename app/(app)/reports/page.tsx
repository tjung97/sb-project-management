import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { IssueSummaryList } from "@/src/components/ops/IssueSummaryList";
import { Button } from "@/src/components/ui/button";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { SelectField } from "@/src/components/ui/select-field";
import { WeeklyRecapCopy } from "@/src/components/ops/WeeklyRecapCopy";
import { listIssues, listLocations, listProjects, listUserProfiles } from "@/src/lib/ops/data";
import { formatDate } from "@/src/lib/ops/format";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locationFilter = one(params.location);
  const projectFilter = one(params.project);
  const [allIssues, locations, projects, users] = await Promise.all([listIssues({ status: "all" }), listLocations(), listProjects(), listUserProfiles()]);
  const issues = allIssues.filter((issue) => {
    if (locationFilter && issue.location_id !== locationFilter) return false;
    if (projectFilter && issue.project_id !== projectFilter) return false;
    return true;
  });
  const open = issues.filter((issue) => !["done", "closed"].includes(issue.status));
  const completed = issues.filter((issue) => ["done", "closed"].includes(issue.status));
  const weekStart = startOfWeek(new Date());
  const newThisWeek = issues.filter((issue) => issue.created_at.toMillis() >= weekStart.getTime());
  const completedThisWeek = completed.filter((issue) => (issue.closed_at?.toMillis() ?? 0) >= weekStart.getTime());
  const overdue = open.filter((issue) => issue.due_at && issue.due_at.toDate() < new Date());
  const blocked = open.filter((issue) => issue.status === "blocked");
  const nowMs = new Date().getTime();
  const unassigned48h = open.filter((issue) => issue.assignee_uids.length === 0 && nowMs - issue.updated_at.toMillis() > 48 * 60 * 60 * 1000);
  const dueSoon = open.filter((issue) => {
    const due = issue.due_at?.toDate();
    if (!due) return false;
    const week = new Date();
    week.setDate(week.getDate() + 7);
    return due <= week;
  });
  const staleBlocked = blocked.filter((issue) => nowMs - issue.updated_at.toMillis() > 72 * 60 * 60 * 1000);
  const ownerLoad = users
    .map((user) => ({ user, count: open.filter((issue) => issue.assignee_uids.includes(user.uid)).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const locationLoad = locations
    .map((location) => ({ location, count: open.filter((issue) => issue.location_id === location.id).length }))
    .sort((a, b) => b.count - a.count);
  const blockedByLocation = locations
    .map((location) => ({ location, count: blocked.filter((issue) => issue.location_id === location.id).length }))
    .sort((a, b) => b.count - a.count)[0];
  const oldestBlocked = blocked.sort((a, b) => a.updated_at.toMillis() - b.updated_at.toMillis())[0];
  const exportQuery = new URLSearchParams();
  exportQuery.set("status", "all");
  if (locationFilter) exportQuery.set("location", locationFilter);
  if (projectFilter) exportQuery.set("project", projectFilter);
  const recap = [
    "Seoul Bowl Ops weekly recap",
    `Open: ${open.length}`,
    `Blocked: ${blocked.length}`,
    `Overdue: ${overdue.length}`,
    `New this week: ${newThisWeek.length}`,
    `Completed this week: ${completedThisWeek.length}`,
    ownerLoad[0] ? `Highest workload: ${ownerLoad[0].user.display_name} (${ownerLoad[0].count})` : "Highest workload: None",
    oldestBlocked ? `Oldest blocked: ${oldestBlocked.title}` : "Oldest blocked: None",
  ].join("\n");

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Exports and SLA-style bottleneck indicators.">
        <WeeklyRecapCopy text={recap} />
        <a href={`/api/exports/issues?${exportQuery.toString()}`}>
          <Button type="button" variant="outline" size="sm">
            Export all issues
          </Button>
        </a>
      </PageHeader>
      <form className="grid gap-2 rounded-lg border border-border/80 bg-card p-4 shadow-card sm:grid-cols-[1fr_1fr_auto]" action="/reports">
        <SelectField
          name="location"
          defaultValue={locationFilter ?? ""}
          placeholder="All locations"
          options={[{ value: "", label: "All locations" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
        />
        <SelectField
          name="project"
          defaultValue={projectFilter ?? ""}
          placeholder="All projects"
          options={[{ value: "", label: "All projects" }, ...projects.map((project) => ({ value: project.id, label: project.title }))]}
        />
        <Button type="submit" variant="outline">Apply</Button>
      </form>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Open" value={open.length} />
        <Metric label="Blocked" value={blocked.length} />
        <Metric label="Overdue" value={overdue.length} />
        <Metric label="Completed" value={completed.length} />
        <Metric label="Due this week" value={dueSoon.length} />
        <Metric label="Blocked 72h+" value={staleBlocked.length} />
        <Metric label="Unassigned 48h+" value={unassigned48h.length} />
        <Metric label="Avg completion days" value={averageCompletionDays(completed)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Weekly recap</CardTitle>
            <CardDescription>Small-team readout you can copy into chat or email.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-lg bg-secondary p-3 text-xs leading-relaxed text-foreground">{recap}</pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weekly movement</CardTitle>
            <CardDescription>Created and completed since Monday.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Metric label="New this week" value={newThisWeek.length} />
            <Metric label="Completed this week" value={completedThisWeek.length} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leadership readout</CardTitle>
            <CardDescription>Plain-language prompts for the weekly meeting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Insight label="Most blocked location" value={blockedByLocation?.count ? `${blockedByLocation.location.name} (${blockedByLocation.count})` : "None"} />
            <Insight label="Oldest blocked issue" value={oldestBlocked ? oldestBlocked.title : "None"} />
            <Insight label="Highest workload owner" value={ownerLoad[0] ? `${ownerLoad[0].user.display_name} (${ownerLoad[0].count})` : "None"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Report exports</CardTitle>
            <CardDescription>Use these for weekly recap packets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <a href="/api/exports/issues?status=all"><Button type="button" variant="outline" className="w-full">All issues CSV</Button></a>
            <a href="/api/exports/issues?status=blocked"><Button type="button" variant="outline" className="w-full">Blocked CSV</Button></a>
            <a href="/api/exports/issues?due=overdue"><Button type="button" variant="outline" className="w-full">Overdue CSV</Button></a>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Overdue work</CardTitle>
            <CardDescription>Needs immediate attention.</CardDescription>
          </CardHeader>
          <CardContent className="p-0"><IssueSummaryList issues={overdue} /></CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Owner workload</CardTitle>
            <CardDescription>Open issues by assignee.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ownerLoad.map((row) => (
              <div key={row.user.uid} className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm">
                <span>{row.user.display_name}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By location</CardTitle>
            <CardDescription>Open work by operating area.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {locationLoad.map((row) => (
              <div key={row.location.id} className="flex items-center justify-between rounded-md bg-secondary/60 px-3 py-2 text-sm">
                <span>{row.location.name}</span>
                <strong>{row.count}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Blocked aging</CardTitle>
            <CardDescription>Issues blocked more than 72 hours based on last update.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {staleBlocked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stale blocked work.</p>
            ) : (
              staleBlocked.slice(0, 8).map((issue) => (
                <div key={issue.id} className="rounded-md bg-secondary/60 px-3 py-2 text-sm">
                  <p className="font-medium">{issue.title}</p>
                  <p className="text-xs text-muted-foreground">Last update {formatDate(issue.updated_at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function averageCompletionDays(issues: Awaited<ReturnType<typeof listIssues>>) {
  const closed = issues.filter((issue) => issue.closed_at && issue.created_at);
  if (closed.length === 0) return 0;
  const days = closed.map((issue) => {
    const created = issue.created_at.toMillis();
    const closedAt = issue.closed_at!.toMillis();
    return Math.max(0, Math.round((closedAt - created) / (24 * 60 * 60 * 1000)));
  });
  return Math.round(days.reduce((sum, item) => sum + item, 0) / days.length);
}

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/80 bg-card px-4 py-3 shadow-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
