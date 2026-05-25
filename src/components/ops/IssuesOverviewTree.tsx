"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { IssueStatsDots } from "@/src/components/ops/IssueStatsDots";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { Button } from "@/src/components/ui/button";
import {
  allOverviewLocationIds,
  allOverviewProjectKeys,
  type IssueBucket,
  type OpsOverviewTree,
  type OverviewIssueNode,
  type OverviewLocationNode,
} from "@/src/lib/ops/overview-tree";
import { cn } from "@/src/lib/utils";

const TREE_TOGGLE_MS = 220;

const BUCKET_MARKER: Record<string, { pill: string; label: string }> = {
  open: { pill: "bg-info/12 text-info ring-info/25", label: "Open" },
  urgent: { pill: "bg-destructive/15 text-destructive ring-destructive/35", label: "Urgent" },
  blocked: { pill: "bg-destructive/10 text-destructive/90 ring-destructive/20", label: "Blocked" },
  overdue: { pill: "bg-warning/15 text-warning ring-warning/30", label: "Overdue" },
  done: { pill: "bg-success/10 text-success ring-success/25", label: "Done" },
};

const STAT_PILLS: {
  key: IssueBucket;
  label: string;
  dot: string;
  activeClass: string;
}[] = [
  { key: "open", label: "Open", dot: "bg-info", activeClass: "border-info/40 bg-info/10 text-info" },
  { key: "urgent", label: "Urgent", dot: "bg-destructive", activeClass: "border-destructive/40 bg-destructive/10 text-destructive" },
  { key: "blocked", label: "Blocked", dot: "bg-destructive/70", activeClass: "border-destructive/30 bg-destructive/10 text-destructive/90" },
  { key: "overdue", label: "Overdue", dot: "bg-warning", activeClass: "border-warning/40 bg-warning/10 text-warning" },
  { key: "done", label: "Done", dot: "bg-success", activeClass: "border-success/30 bg-success/10 text-success" },
];

export function IssuesOverviewTree({ tree }: { tree: OpsOverviewTree }) {
  const [treeOpen, setTreeOpen] = useState(false);
  const [openLocations, setOpenLocations] = useState(() => new Set<string>());
  const [openProjects, setOpenProjects] = useState(() => new Set<string>());
  const [activeBucket, setActiveBucket] = useState<IssueBucket | null>(null);
  const toggleLockRef = useRef(false);

  const allLocationIds = useMemo(() => allOverviewLocationIds(tree), [tree]);
  const allProjectKeys = useMemo(() => allOverviewProjectKeys(tree), [tree]);

  const isAllExpanded = useMemo(() => {
    if (!treeOpen) return false;
    for (const id of allLocationIds) if (!openLocations.has(id)) return false;
    for (const key of allProjectKeys) if (!openProjects.has(key)) return false;
    return true;
  }, [treeOpen, openLocations, openProjects, allLocationIds, allProjectKeys]);

  function toggleExpandCollapse() {
    if (toggleLockRef.current) return;
    toggleLockRef.current = true;
    setTimeout(() => { toggleLockRef.current = false; }, TREE_TOGGLE_MS);

    if (isAllExpanded) {
      setTreeOpen(false);
      setOpenLocations(new Set());
      setOpenProjects(new Set());
      setActiveBucket(null);
    } else {
      setTreeOpen(true);
      setOpenLocations(allLocationIds);
      setOpenProjects(allProjectKeys);
    }
  }

  function selectBucket(bucket: IssueBucket) {
    if (activeBucket === bucket) {
      setActiveBucket(null);
      return;
    }
    setActiveBucket(bucket);
    setTreeOpen(true);

    const locIds = new Set<string>();
    const projKeys = new Set<string>();
    for (const loc of tree.locations) {
      const allIssues = [...loc.projects.flatMap((p) => p.issues), ...loc.unlinkedIssues];
      if (allIssues.some((i) => i.bucket === bucket)) {
        locIds.add(loc.id);
        for (const proj of loc.projects) {
          if (proj.issues.some((i) => i.bucket === bucket)) {
            projKeys.add(`${loc.id}:${proj.id}`);
          }
        }
      }
    }
    setOpenLocations(locIds);
    setOpenProjects(projKeys);
  }

  function toggleLocation(id: string) {
    setOpenLocations((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleProject(key: string) {
    setOpenProjects((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (tree.locations.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground">No operational work in your scope right now.</p>;
  }

  const { totals } = tree;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {STAT_PILLS.filter((pill) => totals[pill.key] > 0).map((pill) => {
            const isActive = activeBucket === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => selectBucket(pill.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs transition hover:bg-accent/50",
                  isActive ? pill.activeClass : "text-muted-foreground"
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", pill.dot)} aria-hidden />
                <span>{pill.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{totals[pill.key]}</span>
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={toggleExpandCollapse}
          aria-expanded={isAllExpanded}
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform duration-200 ease-out", isAllExpanded && "rotate-90")}
            aria-hidden
          />
          {isAllExpanded ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          treeOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="divide-y divide-border">
            {tree.locations.map((location) => (
              <LocationSection
                key={location.id}
                location={location}
                open={openLocations.has(location.id)}
                onToggle={() => toggleLocation(location.id)}
                openProjects={openProjects}
                onToggleProject={toggleProject}
                activeBucket={activeBucket}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LocationSection({
  location,
  open,
  onToggle,
  openProjects,
  onToggleProject,
  activeBucket,
}: {
  location: OverviewLocationNode;
  open: boolean;
  onToggle: () => void;
  openProjects: Set<string>;
  onToggleProject: (key: string) => void;
  activeBucket: IssueBucket | null;
}) {
  const filteredProjects = activeBucket
    ? location.projects.filter((p) => p.issues.some((i) => i.bucket === activeBucket))
    : location.projects;

  const filteredUnlinked = activeBucket
    ? location.unlinkedIssues.filter((i) => i.bucket === activeBucket)
    : location.unlinkedIssues;

  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
        aria-expanded={open}
      >
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition duration-150", open && "rotate-90")} />
        <LocationKindBadge kind={location.kind} name={location.name} className="shrink-0" />
        <span className="min-w-0 flex-1" />
        <IssueStatsDots stats={location.stats} hrefPrefix={`/issues?location=${location.id}`} size="xs" />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-l border-border/80 ml-5 mr-2 pb-2 pl-5">
            {filteredProjects.map((project) => {
              const key = `${location.id}:${project.id}`;
              const projectOpen = openProjects.has(key);
              const filteredIssues = activeBucket
                ? project.issues.filter((i) => i.bucket === activeBucket)
                : project.issues;
              return (
                <div key={project.id}>
                  <button
                    type="button"
                    onClick={() => onToggleProject(key)}
                    className="flex w-full items-center gap-2 py-1.5 pl-2 text-left text-sm hover:bg-accent/30"
                    aria-expanded={projectOpen}
                  >
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition duration-150", projectOpen && "rotate-90")}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{project.title}</span>
                    <IssueStatsDots
                      stats={project.stats}
                      hrefPrefix={`/issues?location=${location.id}&project=${project.id}`}
                      size="xs"
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-150 ease-out motion-reduce:transition-none",
                      projectOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="ml-4 border-l border-dashed border-border/70 pl-3">
                        {filteredIssues.map((issue) => (
                          <IssueStrip key={issue.id} issue={issue} />
                        ))}
                        {filteredIssues.length === 0 ? (
                          <p className="py-1 text-xs text-muted-foreground">No issues in this project here.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredUnlinked.length > 0 ? (
              <div className="mt-1">
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No project</p>
                <div className="ml-2 border-l border-dashed border-border/70 pl-3">
                  {filteredUnlinked.map((issue) => (
                    <IssueStrip key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function IssueStrip({ issue }: { issue: OverviewIssueNode }) {
  const followUp = issue.latestFollowUp;
  const marker = BUCKET_MARKER[issue.bucket] ?? { pill: "bg-muted text-muted-foreground ring-border", label: issue.bucket };

  return (
    <Link
      href={issue.href}
      title={marker.label}
      className="my-0.5 flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-accent/50"
    >
      <span className="flex min-w-0 flex-1 items-baseline gap-1.5 overflow-hidden">
        {issue.issue_number ? (
          <span
            className={cn(
              "shrink-0 rounded px-1 py-px font-mono text-[11px] font-semibold tabular-nums ring-1 ring-inset",
              marker.pill
            )}
          >
            #{issue.issue_number}
          </span>
        ) : null}
        <span
          className={cn(
            "min-w-0 max-w-[38%] truncate font-medium sm:max-w-[45%]",
            issue.bucket === "done" ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {issue.title}
        </span>
        {followUp ? (
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            <span className="text-muted-foreground/55" aria-hidden>
              {" "}
              |{" "}
            </span>
            <span className="font-medium text-foreground">{followUp.authorName}</span>
            {followUp.preview ? (
              <>
                <span aria-hidden> · </span>
                <span className="text-foreground/85">{followUp.preview}</span>
              </>
            ) : null}
            <span aria-hidden> · </span>
            <span>{followUp.relativeAt}</span>
          </span>
        ) : null}
      </span>
    </Link>
  );
}
