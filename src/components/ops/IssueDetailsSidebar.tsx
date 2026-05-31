"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Calendar } from "@/src/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { SidebarField, SidebarPickerPanel } from "@/src/components/ops/SidebarField";
import { SidebarListPicker } from "@/src/components/ops/SidebarListPicker";
import { SidebarPeoplePicker } from "@/src/components/ops/SidebarPeoplePicker";
import { ISSUE_KINDS, ISSUE_PRIORITIES } from "@/src/lib/ops/constants";
import { cn } from "@/src/lib/utils";
import type { UserProfileClient } from "@/src/lib/ops/serialize";

type Option = { id: string; name: string };

export function IssueDetailsSidebar({
  issueId,
  initial,
  labels,
  projects,
  locations,
  users,
  currentUserUid,
  saveMetadataAction,
  savePeopleAction,
}: {
  issueId: string;
  initial: {
    title: string;
    status: string;
    kind: string;
    priority: string;
    projectId: string;
    locationId: string;
    labelIds: string[];
    assigneeUids: string[];
    watcherUids: string[];
    dueAt: string;
    blockedReason: string;
    nextStep: string;
  };
  labels: Option[];
  projects: Array<{ id: string; title: string }>;
  locations: Option[];
  users: UserProfileClient[];
  currentUserUid: string | null;
  saveMetadataAction: (issueId: string, formData: FormData) => Promise<void>;
  savePeopleAction: (issueId: string, formData: FormData) => Promise<void>;
}) {
  const [dueAt, setDueAt] = useState(initial.dueAt);
  const [blockedReason, setBlockedReason] = useState(initial.blockedReason);
  const [nextStep, setNextStep] = useState(initial.nextStep);
  const [pending, startTransition] = useTransition();
  const metadataFormRef = useRef<HTMLFormElement>(null);
  const peopleFormRef = useRef<HTMLFormElement>(null);

  const boundMetadata = saveMetadataAction.bind(null, issueId);
  const boundPeople = savePeopleAction.bind(null, issueId);

  const saveAll = () => {
    const metadataForm = metadataFormRef.current;
    const peopleForm = peopleFormRef.current;
    if (!metadataForm || !peopleForm) return;

    const metadataData = new FormData(metadataForm);
    metadataData.set("title", initial.title);
    metadataData.set("due_at", dueAt);
    metadataData.set("blocked_reason", blockedReason);
    metadataData.set("next_step", nextStep);
    metadataData.set("status", initial.status);

    const peopleData = new FormData(peopleForm);

    startTransition(async () => {
      await boundMetadata(metadataData);
      await boundPeople(peopleData);
    });
  };

  return (
    <aside id="issue-details" className="issue-details-panel">
      <p className="mb-3 hidden text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:block">
        Details
      </p>

      <form ref={peopleFormRef} id={`people-form-${issueId}`} onSubmit={(event) => event.preventDefault()}>
        <div id="people">
          <SidebarPeoplePicker
            name="assignee_uids"
            users={users}
            selected={initial.assigneeUids}
            fieldLabel="Assignees"
            dialogTitle="Set assignees"
            filterPlaceholder="Filter users"
            flat
          />
          <SidebarPeoplePicker
            name="watcher_uids"
            users={users}
            selected={initial.watcherUids}
            fieldLabel="Watchers"
            dialogTitle="Set watchers"
            filterPlaceholder="Filter users"
            flat
          />
          {currentUserUid && !initial.assigneeUids.includes(currentUserUid) ? (
            <div className="border-b border-border pb-3.5">
              <button
                type="button"
                className={cn(
                  buttonVariants({ variant: "link", size: "sm" }),
                  "h-auto px-0 py-0 text-sm font-medium"
                )}
                onClick={() => {
                  const form = peopleFormRef.current;
                  if (!form) return;
                  const data = new FormData(form);
                  if (!data.getAll("assignee_uids").includes(currentUserUid)) {
                    data.append("assignee_uids", currentUserUid);
                  }
                  startTransition(() => boundPeople(data));
                }}
              >
                Assign yourself
              </button>
            </div>
          ) : null}
        </div>
      </form>

      <form ref={metadataFormRef} onSubmit={(event) => event.preventDefault()}>
        <SidebarListPicker
          name="kind"
          mode="single"
          fieldLabel="Type"
          dialogTitle="Set type"
          filterPlaceholder="Filter types"
          options={ISSUE_KINDS.map((item) => ({ value: item.value, label: item.label }))}
          selected={initial.kind}
          flat
        />

        <SidebarListPicker
          name="priority"
          mode="single"
          fieldLabel="Priority"
          dialogTitle="Set priority"
          filterPlaceholder="Filter priorities"
          options={ISSUE_PRIORITIES.map((item) => ({ value: item.value, label: item.label }))}
          selected={initial.priority}
          flat
        />

        <SidebarListPicker
          name="project_id"
          mode="single"
          fieldLabel="Project"
          dialogTitle="Set project"
          filterPlaceholder="Filter projects"
          noneLabel="No project"
          options={projects.map((project) => ({ value: project.id, label: project.title }))}
          selected={initial.projectId}
          flat
        />

        <SidebarListPicker
          name="location_id"
          mode="single"
          fieldLabel="Location"
          dialogTitle="Set location"
          filterPlaceholder="Filter locations"
          noneLabel="No location"
          options={locations.map((location) => ({ value: location.id, label: location.name }))}
          selected={initial.locationId}
          flat
        />

        <SidebarListPicker
          name="label_ids"
          mode="multiple"
          fieldLabel="Labels"
          dialogTitle="Apply labels"
          filterPlaceholder="Filter labels"
          options={labels.map((label) => ({ value: label.id, label: label.name }))}
          selected={initial.labelIds}
          flat
          renderSummary={(selected) =>
            selected.length === 0 ? (
              <span className="text-muted-foreground">None yet</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selected.map((id) => {
                  const label = labels.find((item) => item.id === id);
                  return label ? (
                    <Badge key={id} variant="outline">
                      {label.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            )
          }
        />

        <SidebarField
          label="Due date"
          dialogTitle="Set due date"
          flat
          summary={dueAt ? <span>{dueAt}</span> : <span className="text-muted-foreground">No due date</span>}
        >
          <SidebarPickerPanel>
            <SidebarDueDatePicker value={dueAt} onChange={setDueAt} />
          </SidebarPickerPanel>
        </SidebarField>

        <SidebarField
          label="Blocked / next step"
          dialogTitle="Blocked reason & next step"
          flat
          summary={
            blockedReason || nextStep ? (
              <span className="line-clamp-2 text-muted-foreground">{blockedReason || nextStep}</span>
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )
          }
        >
          <SidebarPickerPanel className="space-y-2">
            <textarea
              value={blockedReason}
              onChange={(event) => setBlockedReason(event.target.value)}
              className="form-textarea min-h-20 w-full"
              placeholder="Why is this blocked?"
            />
            <textarea
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value)}
              className="form-textarea min-h-20 w-full"
              placeholder="Next concrete step"
            />
          </SidebarPickerPanel>
        </SidebarField>
      </form>

      <div className="mt-4 border-t border-border pt-4">
        <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={saveAll}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </aside>
  );
}

function SidebarDueDatePicker({
  value,
  onChange,
}: {
  value: string; // YYYY-MM-DD or ""
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;

  function toDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-[border-color,box-shadow]",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-1",
              !selected && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
            {selected
              ? selected.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "No due date"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              onChange(d ? toDateKey(d) : "");
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {selected && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Clear due date"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
