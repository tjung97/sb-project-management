"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { StatusIndicator } from "@/src/components/issues/StatusIndicator";
import { ISSUE_STATUSES } from "@/src/lib/ops/constants";
import { cn } from "@/src/lib/utils";
import type { IssueStatus } from "@/src/types/firestore";

export function IssueStatusPicker({
  currentStatus,
  action,
}: {
  currentStatus: IssueStatus;
  action: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const pick = (status: IssueStatus) => {
    if (status === currentStatus) {
      setOpen(false);
      return;
    }
    const formData = new FormData();
    formData.set("status", status);
    startTransition(async () => {
      await action(formData);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-border/80 bg-background px-2 py-1 text-left shadow-sm",
            "transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
            pending && "opacity-70"
          )}
          aria-label="Change issue status"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <StatusIndicator status={currentStatus} showPulse />
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1" role="listbox" aria-label="Issue status">
        {ISSUE_STATUSES.map((option) => {
          const selected = option.value === currentStatus;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={pending}
              onClick={() => pick(option.value)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                selected ? "bg-accent text-foreground" : "hover:bg-secondary/80"
              )}
            >
              <StatusIndicator status={option.value} />
              {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
