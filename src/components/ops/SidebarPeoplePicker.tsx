"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { UserAvatar } from "@/src/components/ops/UserAvatar";
import {
  EmbeddedPickerField,
  SidebarField,
  SidebarFilterInput,
  SidebarPickerList,
  SidebarPickerPanel,
} from "@/src/components/ops/SidebarField";
import { cn } from "@/src/lib/utils";
import type { UserProfileClient } from "@/src/lib/ops/serialize";

export function SidebarPeoplePicker({
  name,
  users,
  selected: initialSelected,
  fieldLabel,
  dialogTitle,
  filterPlaceholder = "Filter users",
  noneLabel = "None yet",
  display = "sidebar",
  flat = false,
}: {
  name: string;
  users: UserProfileClient[];
  selected: string[];
  fieldLabel: string;
  dialogTitle: string;
  filterPlaceholder?: string;
  noneLabel?: string;
  display?: "sidebar" | "embedded";
  flat?: boolean;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users.slice(0, 20);
    return users.filter((user) => `${user.display_name} ${user.email ?? ""}`.toLowerCase().includes(q)).slice(0, 20);
  }, [query, users]);

  const summary =
    selected.length === 0 ? (
      <span className="text-muted-foreground">{noneLabel}</span>
    ) : (
      <ul className="space-y-1.5">
        {selected.map((uid) => {
          const user = users.find((item) => item.uid === uid);
          if (!user) return null;
          return (
            <li key={uid} className="flex items-center gap-2">
              <UserAvatar uid={uid} name={user.display_name} size="sm" />
              <span className="text-sm text-foreground">{user.display_name}</span>
            </li>
          );
        })}
      </ul>
    );

  function toggle(uid: string) {
    setSelected((current) => (current.includes(uid) ? current.filter((item) => item !== uid) : [...current, uid]));
  }

  const list = (
    <SidebarPickerList isEmpty={filtered.length === 0} emptyMessage="No users match your search">
      <ul className="space-y-0.5">
        {filtered.map((user) => {
          const active = selected.includes(user.uid);
          return (
            <li key={user.uid}>
              <button
                type="button"
                onClick={() => toggle(user.uid)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent/60",
                  active && "bg-accent/40"
                )}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                </span>
                <UserAvatar uid={user.uid} name={user.display_name} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{user.display_name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </SidebarPickerList>
  );

  const pickerContent = (
    <>
      <SidebarPickerPanel>
        <SidebarFilterInput value={query} onChange={setQuery} placeholder={filterPlaceholder} autoFocus />
      </SidebarPickerPanel>
      {list}
    </>
  );

  const hiddenInputs = selected.map((uid) => <input key={uid} type="hidden" name={name} value={uid} />);

  if (display === "embedded") {
    return (
      <>
        {hiddenInputs}
        <EmbeddedPickerField label={fieldLabel} dialogTitle={dialogTitle} summary={summary}>
          {pickerContent}
        </EmbeddedPickerField>
      </>
    );
  }

  return (
    <>
      {hiddenInputs}
      <SidebarField label={fieldLabel} dialogTitle={dialogTitle} summary={summary} flat={flat}>
        {pickerContent}
      </SidebarField>
    </>
  );
}
