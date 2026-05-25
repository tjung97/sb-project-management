"use client";

import { useTransition } from "react";
import { CheckSquare } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { addChecklistItem, toggleChecklistItem } from "@/src/lib/ops/actions";
import { cn } from "@/src/lib/utils";

export type ChecklistItemClient = {
  id: string;
  title: string;
  done: boolean;
};

export function IssueChecklist({
  issueId,
  items,
  total,
  done,
}: {
  issueId: string;
  items: ChecklistItemClient[];
  total: number;
  done: number;
}) {
  const [pending, startTransition] = useTransition();
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <section className="rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          {total > 0 ? (
            <>
              Checklist · {done}/{total}
              <span className="text-xs font-normal text-muted-foreground">({percent}%)</span>
            </>
          ) : (
            "Checklist"
          )}
        </span>
        {total > 0 ? (
          <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-secondary sm:block">
            <span className="block h-full rounded-full bg-success" style={{ width: `${percent}%` }} />
          </span>
        ) : null}
      </div>

      <div className={cn("px-4 pb-3", pending && "opacity-70")}>
        {total > 0 ? (
          <ul className="max-h-48 space-y-1 overflow-auto py-2">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-accent/40">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => {
                      const formData = new FormData();
                      formData.set("done", item.done ? "false" : "true");
                      startTransition(() => toggleChecklistItem(issueId, item.id, formData));
                    }}
                    className="mt-0.5"
                  />
                  <span className={cn("text-sm", item.done && "text-muted-foreground line-through")}>{item.title}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No checklist items yet.</p>
        )}
        <AddItemForm issueId={issueId} pending={pending} startTransition={startTransition} />
      </div>
    </section>
  );
}

function AddItemForm({
  issueId,
  pending,
  startTransition,
}: {
  issueId: string;
  pending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <form
      action={(formData) => {
        startTransition(() => addChecklistItem(issueId, formData));
      }}
      className="flex gap-2"
    >
      <input name="title" className="form-select h-8 flex-1 text-sm" placeholder="Add checklist item…" />
      <Button
        type="submit"
        variant="link"
        size="sm"
        className="h-8 shrink-0 px-2 font-medium"
        disabled={pending}
      >
        Add
      </Button>
    </form>
  );
}
