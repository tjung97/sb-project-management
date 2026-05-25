"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { UserAvatar } from "@/src/components/ops/UserAvatar";
import type { UserProfileClient } from "@/src/lib/ops/serialize";

export function PeoplePicker({
  name,
  users,
  selected,
  placeholder = "Search team members…",
}: {
  name: string;
  users: UserProfileClient[];
  selected: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedUids, setSelectedUids] = useState(selected);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.filter((user) => !selectedUids.includes(user.uid)).slice(0, 8);
    return users
      .filter((user) => {
        if (selectedUids.includes(user.uid)) return false;
        const haystack = `${user.display_name} ${user.email ?? ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [query, selectedUids, users]);

  function add(uid: string) {
    setSelectedUids((current) => (current.includes(uid) ? current : [...current, uid]));
    setQuery("");
  }

  function remove(uid: string) {
    setSelectedUids((current) => current.filter((item) => item !== uid));
  }

  return (
    <div className="space-y-2">
      {selectedUids.map((uid) => (
        <input key={uid} type="hidden" name={name} value={uid} />
      ))}
      <div className="flex flex-wrap gap-2">
        {selectedUids.map((uid) => {
          const user = users.find((item) => item.uid === uid);
          if (!user) return null;
          return (
            <span key={uid} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 py-0.5 pl-0.5 pr-2 text-sm">
              <UserAvatar uid={uid} name={user.display_name} size="sm" />
              <span>{user.display_name}</span>
              <button type="button" onClick={() => remove(uid)} className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Remove ${user.display_name}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filtered[0]) {
            event.preventDefault();
            add(filtered[0].uid);
          }
        }}
        className="form-select h-9"
        placeholder={placeholder}
      />
      {filtered.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded-lg border border-border bg-card text-sm shadow-card">
          {filtered.map((user) => (
            <li key={user.uid}>
              <button type="button" onClick={() => add(user.uid)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/50">
                <UserAvatar uid={user.uid} name={user.display_name} size="sm" />
                <span>{user.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
