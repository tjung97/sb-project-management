"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { MarkdownComposer, MarkdownComposerFooter } from "@/src/components/ops/MarkdownComposer";
import { MarkdownContent } from "@/src/components/ops/MarkdownContent";
import type { MentionUser } from "@/src/lib/ops/mentions";

export function IssueDescriptionPanel({
  issueId,
  authorName,
  openedAt,
  description,
  saveAction,
  mentionUsers = [],
  compactHeader = false,
}: {
  issueId: string;
  authorName: string;
  openedAt: string;
  description: string;
  saveAction: (issueId: string, formData: FormData) => Promise<void>;
  mentionUsers?: MentionUser[];
  compactHeader?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const bound = saveAction.bind(null, issueId);

  return (
    <article className="rounded-lg border border-border bg-card shadow-card">
      <header
        className={
          compactHeader
            ? "flex items-center justify-between gap-2 border-b border-border bg-secondary/30 px-3 py-2"
            : "flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3"
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={
              compactHeader
                ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold"
                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold"
            }
          >
            {authorName.slice(0, 1)}
          </span>
          <p className="text-xs sm:text-sm">
            <span className="font-semibold text-foreground">{authorName}</span>{" "}
            <span className="text-muted-foreground">opened · {openedAt}</span>
          </p>
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : null}
      </header>

      <div className={compactHeader ? "px-4 py-4 sm:px-5" : "px-4 py-4 sm:px-5"}>
        {editing ? (
          <form
            action={(formData) => {
              startTransition(async () => {
                await bound(formData);
                setEditing(false);
              });
            }}
          >
            <MarkdownComposer
              name="description"
              defaultValue={description}
              placeholder="Describe the work, context, and acceptance criteria…"
              minHeight="min-h-48"
              mentionUsers={mentionUsers}
              required
              footer={
                <MarkdownComposerFooter>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={pending}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? "Saving…" : "Save description"}
                  </Button>
                </MarkdownComposerFooter>
              }
            />
          </form>
        ) : (
          <MarkdownContent content={description} mentionUsers={mentionUsers} className="text-sm leading-relaxed" />
        )}
      </div>
    </article>
  );
}
