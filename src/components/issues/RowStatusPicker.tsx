"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { statusDotClassName } from "@/src/components/issues/StatusIndicator";
import { ISSUE_STATUSES } from "@/src/lib/ops/constants";
import { updateIssueStatus } from "@/src/lib/ops/actions";
import { statusLabel } from "@/src/lib/ops/format";
import { cn } from "@/src/lib/utils";
import type { IssueStatus } from "@/src/types/firestore";

export function RowStatusPicker({
  issueId,
  currentStatus,
}: {
  issueId: string;
  currentStatus: IssueStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const action = updateIssueStatus.bind(null, issueId);

  const pick = (status: IssueStatus) => {
    if (status === currentStatus) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.set("status", status);
    startTransition(async () => {
      await action(fd);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          disabled={pending}
          aria-label={`Status: ${statusLabel(currentStatus)}. Click to change.`}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <span
              className={cn("block h-2.5 w-2.5 rounded-full", statusDotClassName(currentStatus))}
              aria-hidden
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-44 p-1"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {ISSUE_STATUSES.map((opt) => {
          const selected = opt.value === currentStatus;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                pick(opt.value);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors",
                selected ? "bg-accent text-foreground" : "hover:bg-secondary/80"
              )}
            >
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClassName(opt.value))}
                aria-hidden
              />
              <span className="flex-1 text-left">{opt.label}</span>
              {selected && <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
