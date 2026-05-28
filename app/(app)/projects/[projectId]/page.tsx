import Link from "next/link";
import { notFound } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, CalendarClock, ListChecks, PlusCircle, Settings2, UserX } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { buttonVariants } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { ISSUE_STATUSES } from "@/src/lib/ops/constants";
import { ProjectKanbanBoard } from "@/src/components/ops/ProjectKanbanBoard";
import { formatDate } from "@/src/lib/ops/format";
import { serializeUserProfile } from "@/src/lib/ops/serialize";
import { getProject, listLocations, listProjectIssues, listUserProfiles } from "@/src/lib/ops/data";
import { EditProjectForm } from "../ProjectForms";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "success" | "muted" | "warning"> = {
  active: "success",
  paused: "warning",
  completed: "muted",
  archived: "muted",
};

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const [project, issues, users, locations] = await Promise.all([
    getProject(projectId),
    listProjectIssues(projectId),
    listUserProfiles(),
    listLocations(),
  ]);
  if (!project) notFound();

  const owner = users.find((user) => user.uid === project.owner_uid);
  const projectLocations = locations.filter((location) => project.location_ids.includes(location.id));
  const total = Math.max(project.issue_count, 1);
  const progress = Math.round((project.done_issue_count / total) * 100);
  const overdue = issues.filter((issue) => issue.due_at && issue.due_at.toDate() < new Date() && !["done", "closed"].includes(issue.status)).length;
  const unassigned = issues.filter((issue) => issue.assignee_uids.length === 0).length;
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dueSoon = issues.filter((issue) => {
    const due = issue.due_at?.toDate();
    return Boolean(due && due <= weekEnd && !["done", "closed"].includes(issue.status));
  }).length;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,380px)] xl:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-2xl text-balance">{project.title}</CardTitle>
                  <CardDescription className="text-pretty">{project.description}</CardDescription>
                </div>
                <Badge variant={STATUS_VARIANT[project.status] ?? "muted"}>{project.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                  <span>{progress}% complete</span>
                  <span className="tabular-nums">
                    {project.done_issue_count}/{project.issue_count} issues done
                  </span>
                </div>
                <div className="h-3 rounded-full bg-secondary">
                  <div className="h-3 rounded-full bg-success transition-[width] duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-3">
                <Detail label="Owner" value={owner?.display_name ?? "Unassigned"} />
                <Detail label="Due" value={formatDate(project.due_at)} />
                <Detail label="Locations" value={projectLocations.map((location) => location.name).join(", ") || "Company-wide"} />
                <Detail label="Blocked" value={String(project.blocked_issue_count)} />
                <Detail label="Overdue" value={String(overdue)} />
                <Detail label="Unassigned" value={String(unassigned)} />
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-border pt-5">
                <Link href={`/issues/new?project=${project.id}`} className={buttonVariants({ variant: "default", size: "sm" })}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  Add issue
                </Link>
                <Link href={`/issues?project=${project.id}&status=openish`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <ListChecks className="h-3.5 w-3.5" />
                  Open work
                </Link>
                <Link href={`/issues?project=${project.id}&due=week`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <CalendarClock className="h-3.5 w-3.5" />
                  Due this week
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-4">
            <HealthTile icon={AlertTriangle} label="Blocked" value={project.blocked_issue_count} href={`/issues?project=${project.id}&status=blocked`} warn={project.blocked_issue_count > 0} />
            <HealthTile icon={CalendarClock} label="Overdue" value={overdue} href={`/issues?project=${project.id}&due=overdue`} warn={overdue > 0} />
            <HealthTile icon={UserX} label="Unassigned" value={unassigned} href={`/issues?project=${project.id}&unassigned=1`} warn={unassigned > 0} />
            <HealthTile icon={CalendarClock} label="Due soon" value={dueSoon} href={`/issues?project=${project.id}&due=week`} />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Next decision</CardTitle>
              <CardDescription>The current action or dependency holding the project state.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <CommandNote
                label="Next step"
                value={project.next_step ?? "No next step set"}
                empty={!project.next_step}
              />
              <CommandNote
                label="Blocked reason"
                value={project.blocked_reason ?? "No blocker recorded"}
                empty={!project.blocked_reason}
                warn={Boolean(project.blocked_reason)}
              />
            </CardContent>
          </Card>

          <ProjectKanbanBoard
            columns={ISSUE_STATUSES.map((status) => ({
              status: status.value,
              title: status.label,
              issues: issues
                .filter((issue) => issue.status === status.value)
                .map((issue) => {
                  const location = issue.location_id ? locations.find((l) => l.id === issue.location_id) : null;
                  return {
                    id: issue.id,
                    title: issue.title,
                    status: issue.status,
                    priority: issue.priority,
                    issue_number: issue.issue_number,
                    assignee_uids: issue.assignee_uids,
                    due_at: issue.due_at ? issue.due_at.toMillis() : null,
                    location_kind: location?.kind ?? null,
                    location_name: location?.name ?? null,
                    checklist_total: issue.checklist_total,
                    checklist_done: issue.checklist_done,
                  };
                }),
            }))}
            users={users.map(serializeUserProfile)}
          />
        </div>

        <aside className="xl:sticky xl:top-24">
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Project settings</CardTitle>
              </div>
              <CardDescription>Update basics, ownership, schedule, and locations.</CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              <EditProjectForm project={project} locations={locations} users={users} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function CommandNote({
  label,
  value,
  empty = false,
  warn = false,
}: {
  label: string;
  value: string;
  empty?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={warn ? "rounded-lg border border-destructive/25 bg-destructive/5 p-3" : "rounded-lg border border-border bg-secondary/35 p-3"}>
      <p className={warn ? "text-xs font-medium uppercase tracking-wide text-destructive" : "text-xs font-medium uppercase tracking-wide text-muted-foreground"}>
        {label}
      </p>
      <p className={empty ? "mt-1 text-sm text-muted-foreground" : "mt-1 text-sm font-medium text-foreground"}>{value}</p>
    </div>
  );
}

function HealthTile({
  icon: Icon,
  label,
  value,
  href,
  warn = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={warn ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 shadow-card transition hover:bg-destructive/10" : "rounded-lg border border-border bg-card p-3 shadow-card transition hover:bg-accent/30"}
    >
      <div className={warn ? "flex items-center gap-1.5 text-xs text-destructive" : "flex items-center gap-1.5 text-xs text-muted-foreground"}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
