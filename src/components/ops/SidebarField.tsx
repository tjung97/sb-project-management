"use client";

import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { cn } from "@/src/lib/utils";

export function PickerPopover({
  dialogTitle,
  trigger,
  children,
  flat = false,
}: {
  dialogTitle: string;
  trigger?: ReactNode;
  children: ReactNode;
  flat?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className={cn(
              "rounded-md p-1.5 text-muted-foreground transition-colors",
              flat
                ? "hover:bg-muted hover:text-foreground"
                : "hover:bg-accent hover:text-foreground"
            )}
            aria-label={`Edit ${dialogTitle.toLowerCase()}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-semibold">{dialogTitle}</p>
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function SidebarField({
  label,
  summary,
  dialogTitle,
  children,
  className,
  flat = false,
}: {
  label: string;
  summary: ReactNode;
  dialogTitle: string;
  children: ReactNode;
  className?: string;
  flat?: boolean;
}) {
  return (
    <div
      data-sidebar-field
      className={cn(
        "border-b border-border py-3.5 last:border-b-0",
        flat && "first:pt-0",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          data-sidebar-label
          className={cn(
            "font-semibold",
            flat
              ? "text-[11px] uppercase tracking-wide text-muted-foreground"
              : "text-xs text-foreground"
          )}
        >
          {label}
        </span>
        <PickerPopover dialogTitle={dialogTitle} flat={flat}>
          {children}
        </PickerPopover>
      </div>
      <div
        data-sidebar-summary
        className={cn("mt-2", flat ? "text-sm leading-snug text-foreground" : "text-sm text-foreground/85")}
      >
        {summary}
      </div>
    </div>
  );
}

export function EmbeddedPickerField({
  label,
  summary,
  dialogTitle,
  children,
}: {
  label: string;
  summary: ReactNode;
  dialogTitle: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="form-label">{label}</span>
      <div className="rounded-lg border border-border bg-background px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 text-sm">{summary}</div>
          <PickerPopover dialogTitle={dialogTitle}>{children}</PickerPopover>
        </div>
      </div>
    </div>
  );
}

export function SidebarPickerPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-2", className)}>{children}</div>;
}

export function SidebarFilterInput({
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="form-select h-9 w-full border-primary/30 shadow-none"
    />
  );
}

export function SidebarPickerList({
  children,
  emptyMessage = "Nothing to show",
  isEmpty,
}: {
  children: ReactNode;
  emptyMessage?: string;
  isEmpty: boolean;
}) {
  return (
    <div className="max-h-52 overflow-auto px-1 pb-2">
      {isEmpty ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p> : children}
    </div>
  );
}
