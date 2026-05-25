import Link from "next/link";
import { AlertTriangle, Clock3, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { IssueSummaryList } from "@/src/components/ops/IssueSummaryList";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { computeHqHealth, listIssues, listProjects } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

export default async function HqPage() {
  const [issues, projects] = await Promise.all([listIssues({ status: "openish" }), listProjects()]);
  const health = computeHqHealth(issues);
  const hq = issues.filter((issue) => ["hq", "office", "global"].includes(issue.location_id ?? "") || issue.kind === "office_work");
  const unassigned = issues.filter((issue) => issue.assignee_uids.length === 0);
  const blocked = issues.filter((issue) => issue.status === "blocked");

  return (
    <div className="space-y-6">
      <PageHeader title="HQ" description="Cross-location health signals and leadership queues." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthMetric icon={AlertTriangle} label="Blocked" value={health.blocked} href="/issues?status=blocked" />
        <HealthMetric icon={Clock3} label="Overdue" value={health.overdue} href="/issues?due=overdue" />
        <HealthMetric icon={UserX} label="Unassigned" value={health.unassigned} href="/issues?unassigned=1" />
        <HealthMetric icon={Clock3} label="Unassigned 48h+" value={health.unassignedStale} href="/issues?unassigned=1" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>HQ and office work</CardTitle>
            <CardDescription>Decisions, email follow-ups, office tasks, and cross-store work.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <IssueSummaryList issues={hq.slice(0, 10)} />
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Active projects</CardTitle>
              <CardDescription>{projects.length} projects · {health.open} open issues org-wide</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {projects.slice(0, 8).map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-lg bg-secondary p-2 hover:bg-accent/40">
                  <p className="font-medium">{project.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.blocked_issue_count} blocked · {project.open_issue_count} open
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Unassigned work</CardTitle>
              <CardDescription>Needs an owner before it can move.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <IssueSummaryList issues={unassigned.slice(0, 5)} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Blocked queue</CardTitle>
              <CardDescription>{blocked.length} issues waiting on a decision or vendor.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <IssueSummaryList issues={blocked.slice(0, 5)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HealthMetric({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-card p-4 shadow-card transition hover:bg-accent/30">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </Link>
  );
}
