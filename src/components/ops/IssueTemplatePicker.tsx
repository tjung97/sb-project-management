"use client";

import { useRouter } from "next/navigation";
import { FileStack } from "lucide-react";
import { ISSUE_TEMPLATES } from "@/src/lib/ops/templates";

export function IssueTemplatePicker() {
  const router = useRouter();

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <FileStack className="h-4 w-4" />
        Start from a template
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ISSUE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => router.push(`/issues/new?template=${template.id}`)}
            className="rounded-lg border border-border bg-card p-3 text-left text-sm transition hover:border-primary/40 hover:bg-accent/40"
          >
            <p className="font-medium">{template.name}</p>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
            {template.suggested_recurrence ? (
              <p className="mt-2 text-xs text-muted-foreground">Suggested: {template.suggested_recurrence} recurrence</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
