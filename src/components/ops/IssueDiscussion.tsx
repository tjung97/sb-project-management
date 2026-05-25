"use client";

import { UserCircle2, Send } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { MarkdownComposer, MarkdownComposerFooter } from "@/src/components/ops/MarkdownComposer";
import { MarkdownContent } from "@/src/components/ops/MarkdownContent";
import type { MentionUser } from "@/src/lib/ops/mentions";

export type DiscussionComment = {
  id: string;
  authorName: string;
  createdAt: string;
  body: string;
  attachments: Array<{ name: string; url: string; kind: "link" | "file" | "image" }>;
};

export function IssueDiscussion({
  comments,
  mentionUsers,
  commentAction,
}: {
  comments: DiscussionComment[];
  mentionUsers: MentionUser[];
  commentAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <section id="discussion" className="scroll-mt-28 space-y-5 pt-1">
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Discussion <span className="font-normal text-muted-foreground">({comments.length})</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Team updates and @mentions. Status changes appear in Activity history below.
        </p>
      </div>

      {comments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
          No comments yet. Add an update so the team knows what happened last.
        </p>
      ) : (
        comments.map((comment) => <CommentCard key={comment.id} mentionUsers={mentionUsers} {...comment} />)
      )}

      <div className="flex gap-3">
        <div className="flex w-10 shrink-0 justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary ring-1 ring-border">
            <UserCircle2 className="h-6 w-6 text-muted-foreground" />
          </span>
        </div>
        <form action={commentAction} className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold">Add a comment</p>
          <MarkdownComposer
            name="body"
            placeholder="Add an update or @mention a teammate"
            minHeight="min-h-32"
            required
            mentionUsers={mentionUsers}
            footer={
              <MarkdownComposerFooter>
                <p className="text-xs text-muted-foreground">
                  {mentionUsers.length > 0
                    ? `Type @ to tag — e.g. ${mentionUsers.slice(0, 3).map((user) => `@${user.handle}`).join(", ")}`
                    : "No teammates available to tag."}
                </p>
                <Button type="submit" size="sm">
                  <Send className="h-4 w-4" />
                  Comment
                </Button>
              </MarkdownComposerFooter>
            }
          />
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground/80">Add attachment (optional)</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input name="attachment_name" className="form-select h-9" placeholder="Attachment name" />
              <input name="attachment_url" className="form-select h-9" placeholder="Link or image URL" />
            </div>
          </details>
        </form>
      </div>
    </section>
  );
}

function CommentCard({
  id,
  authorName,
  createdAt,
  body,
  attachments,
  mentionUsers,
}: DiscussionComment & { id: string; mentionUsers: MentionUser[] }) {
  return (
    <article id={`comment-${id}`} className="scroll-mt-28 flex gap-3">
      <div className="flex w-10 shrink-0 justify-center">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
          {authorName.slice(0, 1)}
        </span>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <header className="border-b border-border bg-secondary/30 px-4 py-3 text-xs sm:text-sm">
          <span className="font-semibold text-foreground">{authorName}</span>{" "}
          <span className="text-muted-foreground">commented · {createdAt}</span>
        </header>
        <div className="px-4 py-4 sm:px-5 sm:py-5">
          <MarkdownContent content={body} mentionUsers={mentionUsers} className="text-sm leading-relaxed" />
          {attachments.length > 0 ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <a
                  key={attachment.url}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-border p-2 text-sm hover:bg-accent/40"
                >
                  {attachment.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={attachment.url} alt={attachment.name} className="mb-2 max-h-40 rounded-md object-cover" />
                  ) : null}
                  <span className="font-medium">{attachment.name}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
