"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { PopoverClose } from "@/src/components/ui/popover";
import {
  EmbeddedPickerField,
  SidebarField,
  SidebarFilterInput,
  SidebarPickerList,
  SidebarPickerPanel,
} from "@/src/components/ops/SidebarField";
import { cn } from "@/src/lib/utils";

export interface SidebarPickerOption {
  value: string;
  label: string;
  description?: string;
}

export function SidebarListPicker({
  name,
  mode,
  options,
  selected: initialSelected,
  fieldLabel,
  dialogTitle,
  filterPlaceholder,
  emptyMessage = "Nothing to show",
  noneLabel = "None yet",
  display = "sidebar",
  flat = false,
  renderSummary,
}: {
  name: string;
  mode: "single" | "multiple";
  options: SidebarPickerOption[];
  selected: string | string[];
  fieldLabel: string;
  dialogTitle: string;
  filterPlaceholder: string;
  emptyMessage?: string;
  noneLabel?: string;
  display?: "sidebar" | "embedded";
  flat?: boolean;
  renderSummary?: (selected: string[]) => ReactNode;
}) {
  const initial = Array.isArray(initialSelected) ? initialSelected : initialSelected ? [initialSelected] : [];
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const haystack = `${option.label} ${option.description ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  const summary =
    renderSummary?.(selected) ??
    (selected.length === 0 ? (
      <span className="text-muted-foreground">{noneLabel}</span>
    ) : mode === "single" ? (
      <span>{options.find((option) => option.value === selected[0])?.label ?? noneLabel}</span>
    ) : (
      <span>{selected.map((value) => options.find((option) => option.value === value)?.label ?? value).join(", ")}</span>
    ));

  function toggle(value: string) {
    if (mode === "single") {
      setSelected(value ? [value] : []);
      return;
    }
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  const hiddenInputs =
    mode === "single" && selected.length === 0 ? (
      <input type="hidden" name={name} value="" />
    ) : (
      selected.map((value) => <input key={value} type="hidden" name={name} value={value} />)
    );

  const listContent = (
    <>
      <SidebarPickerPanel>
        <SidebarFilterInput value={query} onChange={setQuery} placeholder={filterPlaceholder} autoFocus />
      </SidebarPickerPanel>
      <SidebarPickerList isEmpty={filtered.length === 0} emptyMessage={emptyMessage}>
        <ul className="space-y-0.5">
          {mode === "single" ? (
            <li>
              <PickerRow
                active={selected.length === 0}
                label={noneLabel}
                onClick={() => {
                  setSelected([]);
                }}
                closeOnSelect
              />
            </li>
          ) : null}
          {filtered.map((option) => {
            const active = selected.includes(option.value);
            const row = (
              <PickerRow
                key={option.value}
                active={active}
                label={option.label}
                description={option.description}
                onClick={() => toggle(option.value)}
                closeOnSelect={mode === "single"}
              />
            );
            return <li key={option.value}>{row}</li>;
          })}
        </ul>
      </SidebarPickerList>
    </>
  );

  if (display === "embedded") {
    return (
      <>
        {hiddenInputs}
        <EmbeddedPickerField label={fieldLabel} dialogTitle={dialogTitle} summary={summary}>
          <SidebarPickerPanel>
            <SidebarFilterInput value={query} onChange={setQuery} placeholder={filterPlaceholder} autoFocus />
          </SidebarPickerPanel>
          <SidebarPickerList isEmpty={filtered.length === 0} emptyMessage={emptyMessage}>
            <ul className="space-y-0.5">
              {mode === "single" ? (
                <li>
                  <PickerRow active={selected.length === 0} label={noneLabel} onClick={() => setSelected([])} closeOnSelect />
                </li>
              ) : null}
              {filtered.map((option) => (
                <li key={option.value}>
                  <PickerRow
                    active={selected.includes(option.value)}
                    label={option.label}
                    description={option.description}
                    onClick={() => toggle(option.value)}
                    closeOnSelect={mode === "single"}
                  />
                </li>
              ))}
            </ul>
          </SidebarPickerList>
        </EmbeddedPickerField>
      </>
    );
  }

  return (
    <>
      {hiddenInputs}
      <SidebarField label={fieldLabel} dialogTitle={dialogTitle} summary={summary} flat={flat}>
        {listContent}
      </SidebarField>
    </>
  );
}

function PickerRow({
  active,
  label,
  description,
  onClick,
  closeOnSelect,
}: {
  active: boolean;
  label: string;
  description?: string;
  onClick: () => void;
  closeOnSelect?: boolean;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent/60",
        active && "bg-accent/40"
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {description ? <span className="block truncate text-xs text-muted-foreground">{description}</span> : null}
      </span>
    </button>
  );

  if (closeOnSelect) {
    return <PopoverClose asChild>{button}</PopoverClose>;
  }

  return button;
}
