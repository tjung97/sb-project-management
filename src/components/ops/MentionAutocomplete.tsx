"use client";

import { useEffect, useRef } from "react";
import type { MentionUser } from "@/src/lib/ops/mentions";
import { cn } from "@/src/lib/utils";

export function MentionAutocomplete({
  open,
  users,
  selectedIndex,
  onSelect,
  onHover,
}: {
  open: boolean;
  users: MentionUser[];
  selectedIndex: number;
  onSelect: (user: MentionUser) => void;
  onHover: (index: number) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [open, selectedIndex]);

  if (!open || users.length === 0) return null;

  return (
    <ul
      ref={listRef}
      role="listbox"
      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
    >
      {users.map((user, index) => (
        <li key={user.uid} role="option" aria-selected={index === selectedIndex}>
          <button
            type="button"
            data-active={index === selectedIndex ? "true" : undefined}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
              index === selectedIndex ? "bg-accent text-foreground" : "hover:bg-accent/60"
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(user);
            }}
            onMouseEnter={() => onHover(index)}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {user.display_name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{user.display_name}</span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">@{user.handle}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
