import Link from "next/link";
import { CalendarClock, Plus, UserCircle2 } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { formatDate } from "@/src/lib/ops/format";
import { listLocations, listProjects, listUserProfiles } from "@/src/lib/ops/data";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { CreateProjectForm, CreateProjectFromTemplateForm } from "./ProjectForms";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, locations, users] = await Promise.all([listProjects(), listLocations(), listUserProfiles()]);
  const userById = new Map(users.map((user) => [user.uid, user]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const now = new Date();
  const sortedProjects = [...projects].sort((a, b) => projectScore(b, now) - projectScore(a, now) || b.updated_at.toMillis() - a.updated_at.toMillis());

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="space-y-5">
        <PageHeader
          title="Projects"
          description="Larger initiatives with an owner, due date, and linked issues."
          className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6"
        />

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          {projects.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No projects yet. Create one for larger initiatives.</p>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_9rem_7rem_7rem] gap-3 border-b border-border/80 bg-secondary/50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Project</span>
                <span>Owner</span>
                <span>Due</span>
                <span className="text-center">Health</span>
              </div>
              <div className="divide-y divide-border/80">
                {sortedProjects.map((project) => {
                  const total = Math.max(project.issue_count, 1);
                  const progress = Math.round((project.done_issue_count / total) * 100);
                  const owner = project.owner_uid ? userById.get(project.owner_uid) : null;
                  const projectLocations = project.location_ids.map((id) => locationById.get(id)?.name).filter(Boolean);
                  const overdue = Boolean(project.due_at && project.due_at.toDate() < now && !["completed", "archived"].includes(project.status));
                  const hasBlocker = project.blocked_issue_count > 0 || Boolean(project.blocked_reason);
                  return (
                    <Link key={project.id} href={`/projects/${project.id}`} className="block px-4 py-4 transition hover:bg-accent/35">
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem] lg:items-center">
                        <div className="min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-sm font-semibold text-foreground">{project.title}</h2>
                            <Badge variant={project.status === "active" ? "success" : project.status === "paused" ? "warning" : "muted"}>{project.status}</Badge>
                            {overdue ? <Badge variant="warning">Overdue</Badge> : null}
                            {hasBlocker ? <Badge variant="destructive">Blocked</Badge> : null}
                            {!project.owner_uid ? <Badge variant="outline">Needs owner</Badge> : null}
                          </div>
                          <p className="line-clamp-1 text-xs text-muted-foreground">{project.description}</p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {project.next_step ? `Next: ${project.next_step}` : projectLocations.join(", ") || "Company-wide"}
                          </p>
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <UserCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{owner?.display_name ?? "No owner"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{formatDate(project.due_at)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
                          <MiniStat label="Open" value={project.open_issue_count} />
                          <MiniStat label="Blocked" value={project.blocked_issue_count} warn={project.blocked_issue_count > 0} />
                          <MiniStat label="Done" value={`${progress}%`} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <aside>
        <div className="sticky top-[calc(var(--app-header-height,96px)+1.5rem)] space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <CardTitle>Create project</CardTitle>
              </div>
              <CardDescription>Group operational work into a visible project.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateProjectForm locations={locations} users={users} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Create from playbook</CardTitle>
              <CardDescription>Generate a project with child issues and checklists.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateProjectFromTemplateForm locations={locations} users={users} />
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}

function projectScore(project: Awaited<ReturnType<typeof listProjects>>[number], now: Date) {
  let score = 0;
  if (project.status === "active") score += 10;
  if (project.blocked_issue_count > 0 || project.blocked_reason) score += 8;
  if (project.due_at && project.due_at.toDate() < now && !["completed", "archived"].includes(project.status)) score += 6;
  if (!project.owner_uid) score += 4;
  if (project.next_step) score += 1;
  return score;
}

function MiniStat({ label, value, warn = false }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={warn ? "rounded-md bg-destructive/10 px-1.5 py-1 text-destructive" : "rounded-md bg-secondary px-1.5 py-1"}>
      <p className="font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
