import Link from "next/link";
import { Suspense } from "react";
import { Download, Plus } from "lucide-react";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import { CardListBody } from "@/src/components/ui/card";
import { IssueListRow } from "@/src/components/ops/IssueListRow";
import { IssuesDensityToggle } from "@/src/components/ops/IssuesDensityToggle";
import { IssuesEmptyState } from "@/src/components/ops/IssuesEmptyState";
import { IssuesMetricsBar } from "@/src/components/ops/IssuesMetricsBar";
import { IssuesOverviewTree } from "@/src/components/ops/IssuesOverviewTree";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { IssuesQueueControls } from "@/src/components/ops/IssuesQueueControls";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { buildOpsOverviewTree } from "@/src/lib/ops/overview-tree";
import { filtersToSearchParams, hasActiveFilters, parseIssueFilters } from "@/src/lib/ops/issue-filters";
import { getIssueByNumber, listIssues, listLabels, listLocations, listProjects, listUserProfiles } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseIssueFilters(params);
  const user = await getCurrentUser();
  const [issues, overviewIssues, projects, locations, labels, users] = await Promise.all([
    listIssues(filters),
    listIssues({}, 500),
    listProjects(),
    listLocations(),
    listLabels(),
    listUserProfiles(),
  ]);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const userById = new Map(users.map((user) => [user.uid, user]));
  const labelById = new Map(labels.map((label) => [label.id, label]));
  const compact = one(params.density) === "compact";
  const activeFilters = hasActiveFilters(filters);
  const issueNumberQuery = filters.q?.trim().match(/^#?(\d+)$/)?.[1];
  const quickIssue = issueNumberQuery ? await getIssueByNumber(Number(issueNumberQuery)) : null;
  const exportParams = filtersToSearchParams(filters);
  const now = new Date();
  const overview = user ? buildOpsOverviewTree(user, locations, projects, overviewIssues, now) : null;

  const filterLookups = {
    users: users.map((user) => ({ uid: user.uid, display_name: user.display_name })),
    locations: locations.map((location) => ({ id: location.id, name: location.name })),
    projects: projects.map((project) => ({ id: project.id, title: project.title })),
  };

  return (
    <div className="space-y-4">
      <IssuesQueueControls
        defaultQuery={filters.q ?? ""}
        resultCount={issues.length}
        userUid={user?.uid ?? null}
        users={filterLookups.users}
        locations={filterLookups.locations}
        projects={filterLookups.projects}
        activeFilters={activeFilters}
      />

      <PageHeader
        title="Issues"
        description="Location overview, filters, and the work queue for your scope."
      >
        <Link
          href={`/api/exports/issues${exportParams.toString() ? `?${exportParams.toString()}` : ""}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Link>
        <Link href="/issues/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="h-3.5 w-3.5" />
          New issue
        </Link>
      </PageHeader>

      {overview ? (
        <section className="rounded-lg border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Operational overview</p>
            <IssuesMetricsBar stats={overview.totals} />
          </div>
          <IssuesOverviewTree tree={overview} />
        </section>
      ) : null}

      {quickIssue ? (
        <Link
          href={`/issues/${quickIssue.id}`}
          className="block rounded-lg border border-primary/30 bg-accent/50 px-3 py-2 text-sm shadow-card transition hover:bg-accent"
        >
          Quick jump: <span className="font-medium">{quickIssue.title}</span>{" "}
          <span className="font-mono text-muted-foreground">#{quickIssue.issue_number}</span>
        </Link>
      ) : null}

      <details className="overflow-hidden rounded-lg border border-border bg-card shadow-card" open>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          Work queue
          <span className="ml-2 font-normal text-muted-foreground">
            ({issues.length} issue{issues.length === 1 ? "" : "s"}
            {activeFilters ? ", filtered" : ""})
          </span>
        </summary>
        <CardListBody className="border-t border-border transition-opacity duration-150">
          {issues.length === 0 ? (
            <IssuesEmptyState hasFilters={activeFilters} />
          ) : (
            issues.map((issue) => (
              <IssueListRow
                key={issue.id}
                issue={issue}
                project={issue.project_id ? projectById.get(issue.project_id) : null}
                location={issue.location_id ? locationById.get(issue.location_id) : null}
                issueLabels={issue.label_ids.map((id) => labelById.get(id))}
                userById={userById}
                compact={compact}
                isOverdue={Boolean(
                  issue.due_at && issue.due_at.toDate() < now && !["done", "closed"].includes(issue.status)
                )}
              />
            ))
          )}
        </CardListBody>
        <div className="flex justify-end border-t border-border px-4 py-2">
          <Suspense fallback={<span className="text-xs text-muted-foreground">Density…</span>}>
            <IssuesDensityToggle />
          </Suspense>
        </div>
      </details>
    </div>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
