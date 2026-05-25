"use client";

import { useTransition } from "react";
import { Button } from "@/src/components/ui/button";
import { CollapsiblePanel } from "@/src/components/ops/CollapsiblePanel";
import { PeoplePicker } from "@/src/components/ops/PeoplePicker";
import type { UserProfileClient } from "@/src/lib/ops/serialize";

export function AssigneeSidebar({
  issueId,
  users,
  assigneeUids,
  watcherUids,
  currentUserUid,
  saveAction,
}: {
  issueId: string;
  users: UserProfileClient[];
  assigneeUids: string[];
  watcherUids: string[];
  currentUserUid: string | null;
  saveAction: (issueId: string, formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const bound = saveAction.bind(null, issueId);

  function quickAssignSelf() {
    const form = document.getElementById(`assignees-form-${issueId}`) as HTMLFormElement | null;
    if (!form || !currentUserUid) return;
    const data = new FormData(form);
    if (!data.getAll("assignee_uids").includes(currentUserUid)) {
      data.append("assignee_uids", currentUserUid);
    }
    startTransition(() => bound(data));
  }

  return (
    <CollapsiblePanel title="People" defaultOpen className="rounded-lg border border-border bg-card/50 px-3">
      <form
        id={`assignees-form-${issueId}`}
        action={(formData) => {
          startTransition(() => bound(formData));
        }}
        className="space-y-4"
      >
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Assignees</p>
          <PeoplePicker name="assignee_uids" users={users} selected={assigneeUids} placeholder="Add assignee…" />
          <div className="mt-2 flex flex-wrap gap-2">
            {currentUserUid && !assigneeUids.includes(currentUserUid) ? (
              <Button type="button" variant="outline" size="sm" onClick={quickAssignSelf}>
                Assign yourself
              </Button>
            ) : null}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Watchers</p>
          <PeoplePicker name="watcher_uids" users={users} selected={watcherUids} placeholder="Add watcher…" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Saving…" : "Save people"}
        </Button>
      </form>
    </CollapsiblePanel>
  );
}
