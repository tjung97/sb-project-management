"use client";

import { useMemo, useRef, useState } from "react";
import { Bold, Code, Heading2, Italic, Link2, List, ListOrdered, Quote, Strikethrough } from "lucide-react";
import { MarkdownContent } from "@/src/components/ops/MarkdownContent";
import { MentionAutocomplete } from "@/src/components/ops/MentionAutocomplete";
import {
  filterMentionUsers,
  getMentionContext,
  insertMention,
  type MentionUser,
} from "@/src/lib/ops/mentions";
import { cn } from "@/src/lib/utils";

type Tab = "write" | "preview";

export function MarkdownComposer({
  name,
  defaultValue = "",
  placeholder = "Write in Markdown…",
  minHeight = "min-h-40",
  footer,
  required,
  mentionUsers = [],
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  minHeight?: string;
  footer?: React.ReactNode;
  required?: boolean;
  mentionUsers?: MentionUser[];
}) {
  const [tab, setTab] = useState<Tab>("write");
  const [value, setValue] = useState(defaultValue);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionRange, setMentionRange] = useState<{ start: number; end: number } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionCandidates = useMemo(
    () => (mentionUsers.length > 0 ? filterMentionUsers(mentionUsers, mentionQuery) : []),
    [mentionUsers, mentionQuery]
  );

  function syncMentionState(nextValue: string, cursor: number) {
    if (mentionUsers.length === 0) {
      setMentionOpen(false);
      return;
    }
    const context = getMentionContext(nextValue, cursor);
    if (!context) {
      setMentionOpen(false);
      setMentionQuery("");
      setMentionRange(null);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(context.query);
    setMentionRange({ start: context.start, end: context.end });
    setMentionIndex(0);
  }

  function applyMention(user: MentionUser) {
    if (!mentionRange) return;
    const next = insertMention(value, mentionRange.start, mentionRange.end, user.handle);
    const cursor = mentionRange.start + user.handle.length + 2;
    setValue(next);
    setMentionOpen(false);
    setMentionQuery("");
    setMentionRange(null);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function wrap(before: string, after = before) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + before.length + selected.length + after.length;
      el.setSelectionRange(cursor, cursor);
      syncMentionState(next, cursor);
    });
  }

  function prefixLine(prefix: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      syncMentionState(next, el.selectionStart);
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40">
        <div className="flex">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={cn(
              "border-r border-border px-4 py-2 text-sm font-medium transition",
              tab === "write" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition",
              tab === "preview" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Preview
          </button>
        </div>
        <div className="hidden items-center gap-0.5 px-2 sm:flex">
          <ToolbarButton label="Heading" onClick={() => prefixLine("## ")} icon={Heading2} />
          <ToolbarButton label="Bold" onClick={() => wrap("**")} icon={Bold} />
          <ToolbarButton label="Italic" onClick={() => wrap("_")} icon={Italic} />
          <ToolbarButton label="Quote" onClick={() => prefixLine("> ")} icon={Quote} />
          <ToolbarButton label="Code" onClick={() => wrap("`")} icon={Code} />
          <ToolbarButton label="Link" onClick={() => wrap("[", "](url)")} icon={Link2} />
          <ToolbarButton label="Bullet list" onClick={() => prefixLine("- ")} icon={List} />
          <ToolbarButton label="Numbered list" onClick={() => prefixLine("1. ")} icon={ListOrdered} />
          <ToolbarButton label="Strikethrough" onClick={() => wrap("~~")} icon={Strikethrough} />
        </div>
      </div>

      <input type="hidden" name={name} value={value} />
      {tab === "write" ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              syncMentionState(next, event.target.selectionStart);
            }}
            onClick={(event) => syncMentionState(value, event.currentTarget.selectionStart)}
            onKeyUp={(event) => syncMentionState(value, event.currentTarget.selectionStart)}
            onKeyDown={(event) => {
              if (!mentionOpen || mentionCandidates.length === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setMentionIndex((index) => (index + 1) % mentionCandidates.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setMentionIndex((index) => (index - 1 + mentionCandidates.length) % mentionCandidates.length);
              } else if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                applyMention(mentionCandidates[mentionIndex] ?? mentionCandidates[0]);
              } else if (event.key === "Escape") {
                event.preventDefault();
                setMentionOpen(false);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => setMentionOpen(false), 120);
            }}
            className={cn(
              "w-full resize-y border-0 bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground",
              minHeight
            )}
            placeholder={placeholder}
            required={required}
          />
          <MentionAutocomplete
            open={mentionOpen}
            users={mentionCandidates}
            selectedIndex={mentionIndex}
            onSelect={applyMention}
            onHover={setMentionIndex}
          />
        </div>
      ) : (
        <div className={cn("bg-background px-4 py-3", minHeight)}>
          <MarkdownContent content={value} mentionUsers={mentionUsers} />
        </div>
      )}

      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Markdown supported: **bold**, _italic_, `code`, lists, links, tables, task lists, headings.
        {mentionUsers.length > 0 ? " Type @ to tag someone." : null}
      </div>
      {footer ? <div className="border-t border-border bg-card px-3 py-2">{footer}</div> : null}
    </div>
  );
}

export function MarkdownComposerFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>{children}</div>;
}

function ToolbarButton({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
