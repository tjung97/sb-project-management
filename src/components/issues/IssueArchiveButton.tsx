"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { archiveIssue, restoreIssue } from "@/src/lib/ops/actions";
import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

export function IssueArchiveButton({
  issueId,
  isArchived,
}: {
  issueId: string;
  isArchived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      if (isArchived) {
        await restoreIssue(issueId);
      } else {
        await archiveIssue(issueId);
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "gap-1.5",
        pending && "opacity-60"
      )}
      aria-label={isArchived ? "Restore issue" : "Archive issue"}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : isArchived ? (
        <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Archive className="h-3.5 w-3.5" aria-hidden />
      )}
      {isArchived ? "Restore" : "Archive"}
    </button>
  );
}
