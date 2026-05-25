"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { IssueStatsDots } from "@/src/components/ops/IssueStatsDots";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { Button } from "@/src/components/ui/button";
import {
  allOverviewLocationIds,
  allOverviewProjectKeys,
  type OpsOverviewTree,
  type OverviewIssueNode,
  type OverviewLocationNode,
} from "@/src/lib/ops/overview-tree";
import { cn } from "@/src/lib/utils";

const TREE_TOGGLE_MS = 220;

const BUCKET_MARKER: Record<string, { pill: string; label: string }> = {
  open: {
    pill: "bg-info/12 text-info ring-info/25",
    label: "Open",
  },
  urgent: {
    pill: "bg-destructive/15 text-destructive ring-destructive/35",
    label: "Urgent",
  },
  blocked: {
    pill: "bg-destructive/10 text-destructive/90 ring-destructive/20",
    label: "Blocked",
  },
  overdue: {
    pill: "bg-warning/15 text-warning ring-warning/30",
    label: "Overdue",
  },
  done: {
    pill: "bg-success/10 text-success ring-success/25",
    label: "Done",
  },
};

export function IssuesOverviewTree({ tree }: { tree: OpsOverviewTree }) {
  const [treeOpen, setTreeOpen] = useState(false);
  const [openLocations, setOpenLocations] = useState(() => new Set<string>());
  const [openProjects, setOpenProjects] = useState(() => new Set<string>());
  const toggleLockRef = useRef(false);

  const toggleTree = useCallback(() => {
    if (toggleLockRef.current) return;
    toggleLockRef.current = true;
    setTreeOpen((open) => !open);
    window.setTimeout(() => {
      toggleLockRef.current = false;
    }, TREE_TOGGLE_MS);
  }, []);

  function expandAll() {
    setTreeOpen(true);
    setOpenLocations(allOverviewLocationIds(tree));
    setOpenProjects(allOverviewProjectKeys(tree));
  }

  function collapseAll() {
    setOpenLocations(new Set());
    setOpenProjects(new Set());
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{tree.scopeLabel}</span>
            <span className="text-muted-foreground/70"> · {tree.locations.length} locations</span>
          </span>
          <IssueStatsDots stats={tree.totals} hrefPrefix="/issues" size="xs" />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {treeOpen ? (
            <>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={expandAll}>
                <ChevronsUpDown className="h-3 w-3" aria-hidden />
                Expand all
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={collapseAll}>
                <ChevronsDownUp className="h-3 w-3" aria-hidden />
                Collapse all
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            onClick={toggleTree}
            aria-expanded={treeOpen}
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform duration-200 ease-out", treeOpen && "rotate-90")}
              aria-hidden
            />
            {treeOpen ? "Collapse" : "Expand"}
          </Button>
        </div>
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
}: {
  location: OverviewLocationNode;
  open: boolean;
  onToggle: () => void;
  openProjects: Set<string>;
  onToggleProject: (key: string) => void;
}) {
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
          <div className="border-l border-border/80 pb-2 pl-5 ml-5 mr-2">
            {location.projects.map((project) => {
              const key = `${location.id}:${project.id}`;
              const projectOpen = openProjects.has(key);
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
                      <div className="border-l border-dashed border-border/70 ml-4 pl-3">
                        {project.issues.map((issue) => (
                          <IssueStrip key={issue.id} issue={issue} />
                        ))}
                        {project.issues.length === 0 ? (
                          <p className="py-1 text-xs text-muted-foreground">No issues in this project here.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {location.unlinkedIssues.length > 0 ? (
              <div className="mt-1">
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">No project</p>
                <div className="border-l border-dashed border-border/70 ml-2 pl-3">
                  {location.unlinkedIssues.map((issue) => (
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
