"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { moveIssueOnBoard } from "@/src/lib/ops/actions";
import { AvatarStack } from "@/src/components/ops/AvatarStack";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { PriorityBadge, StatusBadge } from "@/src/components/issues/IssueBadges";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { formatDate, formatIssueNumber } from "@/src/lib/ops/format";
import { isUrgentPriority, locationBorderClass, priorityBorderClass, priorityRowClass } from "@/src/lib/ops/semantic";
import { cn } from "@/src/lib/utils";
import type { IssuePriority, IssueStatus, LocationKind, UserProfile } from "@/src/types/firestore";
import type { UserProfileClient } from "@/src/lib/ops/serialize";

export type KanbanIssue = {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  issue_number?: number;
  assignee_uids: string[];
  due_at: number | null;
  location_kind: LocationKind | null;
  location_name: string | null;
  checklist_total: number;
  checklist_done: number;
};

type Column = { status: IssueStatus; title: string; issues: KanbanIssue[] };

export function ProjectKanbanBoard({
  columns: initialColumns,
  users,
}: {
  columns: Column[];
  users: UserProfileClient[];
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [pending, startTransition] = useTransition();
  const userById = new Map(users.map((user) => [user.uid, user as unknown as UserProfile]));
  const filteredColumns = columns.map((column) => ({
    ...column,
    issues: column.issues.filter((issue) => {
      if (assigneeFilter && !issue.assignee_uids.includes(assigneeFilter)) return false;
      if (priorityFilter && issue.priority !== priorityFilter) return false;
      if (locationFilter && issue.location_name !== locationFilter) return false;
      return true;
    }),
  }));
  const locations = Array.from(new Set(columns.flatMap((column) => column.issues.map((issue) => issue.location_name).filter(Boolean)))) as string[];

  function onDragStart(issueId: string) {
    return (event: React.DragEvent) => {
      event.dataTransfer.setData("text/issue-id", issueId);
      event.dataTransfer.effectAllowed = "move";
    };
  }

  function onDrop(targetStatus: IssueStatus) {
    return (event: React.DragEvent) => {
      event.preventDefault();
      const issueId = event.dataTransfer.getData("text/issue-id");
      if (!issueId) return;

      let moved: KanbanIssue | null = null;
      const next = columns.map((column) => {
        const issues = column.issues.filter((issue) => {
          if (issue.id === issueId) {
            moved = { ...issue, status: targetStatus };
            return false;
          }
          return true;
        });
        return { ...column, issues };
      });
      if (!moved) return;

      const withMove = next.map((column) =>
        column.status === targetStatus ? { ...column, issues: [...column.issues, moved!] } : column
      );
      setColumns(withMove);

      startTransition(async () => {
        await moveIssueOnBoard(issueId, targetStatus);
      });
    };
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-card md:grid-cols-3">
        <BoardSelect
          value={assigneeFilter}
          onValueChange={setAssigneeFilter}
          placeholder="Any assignee"
          ariaLabel="Filter by assignee"
          options={[{ value: "", label: "Any assignee" }, ...users.map((user) => ({ value: user.uid, label: user.display_name }))]}
        />
        <BoardSelect
          value={priorityFilter}
          onValueChange={setPriorityFilter}
          placeholder="Any priority"
          ariaLabel="Filter by priority"
          options={[
            { value: "", label: "Any priority" },
            { value: "urgent", label: "Urgent" },
            { value: "high", label: "High" },
            { value: "normal", label: "Normal" },
            { value: "low", label: "Low" },
          ]}
        />
        <BoardSelect
          value={locationFilter}
          onValueChange={setLocationFilter}
          placeholder="Any location"
          ariaLabel="Filter by location"
          options={[{ value: "", label: "Any location" }, ...locations.map((location) => ({ value: location, label: location }))]}
        />
      </div>
      <div className={cn("grid gap-4 xl:grid-cols-5", pending && "opacity-80")}>
        {filteredColumns.map((column) => (
          <section
            key={column.status}
            className="rounded-lg border border-border bg-card p-3 shadow-card"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop(column.status)}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <span className="rounded-md bg-secondary px-2 py-0.5 text-xs">{column.issues.length}</span>
            </div>
            <div className="min-h-[120px] space-y-3">
              {column.issues.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">Drop issues here</p>
              ) : (
                column.issues.map((issue) => (
                  <div
                    key={issue.id}
                    draggable
                    onDragStart={onDragStart(issue.id)}
                    className={cn(
                      "group cursor-grab rounded-md border border-border border-l-4 bg-background p-3 active:cursor-grabbing",
                      isUrgentPriority(issue.priority)
                        ? priorityBorderClass("urgent")
                        : locationBorderClass(issue.location_kind ?? undefined),
                      priorityRowClass(issue.priority)
                    )}
                  >
                    <div className="mb-2 flex flex-wrap gap-2">
                      {isUrgentPriority(issue.priority) ? <PriorityBadge priority={issue.priority} prominent /> : null}
                      <StatusBadge status={column.status} showPulse />
                      {!isUrgentPriority(issue.priority) ? <PriorityBadge priority={issue.priority} /> : null}
                      {issue.location_kind && issue.location_name ? (
                        <LocationKindBadge kind={issue.location_kind} name={issue.location_name} />
                      ) : null}
                    </div>
                    <Link
                      href={`/issues/${issue.id}`}
                      className={cn("text-sm font-medium hover:underline", isUrgentPriority(issue.priority) && "font-semibold text-destructive")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {issue.title}{" "}
                      <span className="font-normal text-muted-foreground">
                        {formatIssueNumber({ id: issue.id, issue_number: issue.issue_number })}
                      </span>
                    </Link>
                    <div className="mt-2">
                      <AvatarStack uids={issue.assignee_uids} usersById={userById} max={3} />
                    </div>
                    {issue.checklist_total > 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Checklist {issue.checklist_done}/{issue.checklist_total}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">Due {issue.due_at ? formatDate(issue.due_at) : "No date"}</p>
                    <StatusMoveSelect
                      issue={issue}
                      currentStatus={column.status}
                      columns={columns}
                      disabled={pending}
                      onMove={(targetStatus) => {
                        startTransition(() => moveIssueOnBoard(issue.id, targetStatus));
                        setColumns((current) =>
                          current.map((source) => ({
                            ...source,
                            issues:
                              source.status === column.status
                                ? source.issues.filter((item) => item.id !== issue.id)
                                : source.status === targetStatus
                                  ? [...source.issues, { ...issue, status: targetStatus }]
                                  : source.issues,
                          }))
                        );
                      }}
                    />
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function StatusMoveSelect({
  issue,
  currentStatus,
  columns,
  disabled,
  onMove,
}: {
  issue: KanbanIssue;
  currentStatus: IssueStatus;
  columns: Column[];
  disabled: boolean;
  onMove: (status: IssueStatus) => void;
}) {
  return (
    <div className="mt-3 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
      <Select
        value={currentStatus}
        onValueChange={(value) => {
          const status = value as IssueStatus;
          if (status !== currentStatus) onMove(status);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-xs" aria-label={`Move ${issue.title}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {columns.map((target) => (
            <SelectItem key={target.status} value={target.status}>
              Move to {target.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function BoardSelect({
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  options,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  const emptyValue = "__empty__";
  const currentValue = value || emptyValue;
  return (
    <Select value={currentValue} onValueChange={(next) => onValueChange(next === emptyValue ? "" : next)}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={`${ariaLabel}-${option.value || "empty"}`} value={option.value || emptyValue}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
