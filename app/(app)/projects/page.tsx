import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleDot, Plus } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { formatDate } from "@/src/lib/ops/format";
import { listLocations, listProjects, listUserProfiles } from "@/src/lib/ops/data";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { CreateProjectForm, CreateProjectFromTemplateForm } from "./ProjectForms";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, locations, users] = await Promise.all([listProjects(), listLocations(), listUserProfiles()]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="space-y-6">
        <PageHeader
          title="Projects"
          description="Larger initiatives with an owner, due date, and linked issues."
          className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6"
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">No projects yet. Create one for larger initiatives.</CardContent>
            </Card>
          ) : (
            projects.map((project) => {
              const total = Math.max(project.issue_count, 1);
              const progress = Math.round((project.done_issue_count / total) * 100);
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-float">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>{project.title}</CardTitle>
                          <CardDescription className="mt-2 line-clamp-2">{project.description}</CardDescription>
                        </div>
                        <Badge variant={project.status === "active" ? "success" : "muted"}>{project.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                          <span>{progress}% complete</span>
                          <span>{project.done_issue_count}/{project.issue_count} issues</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary">
                          <div className="h-2 rounded-full bg-success" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <Stat icon={CircleDot} label="Open" value={project.open_issue_count} />
                        <Stat icon={AlertTriangle} label="Blocked" value={project.blocked_issue_count} />
                        <Stat icon={CheckCircle2} label="Due" value={formatDate(project.due_at)} />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </section>

      <aside>
        <div className="sticky top-24 space-y-4">
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

function Stat({ icon: Icon, label, value }: { icon: typeof CircleDot; label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-secondary p-2">
      <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
      <p className="font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
