"use client";

import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/src/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDisplay(date: Date | undefined): string {
  if (!date) return "No due date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function DueDatePicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string; // YYYY-MM-DD or ""
}) {
  const initial = defaultValue ? new Date(`${defaultValue}T12:00:00`) : undefined;
  const [selected, setSelected] = useState<Date | undefined>(initial);
  const [open, setOpen] = useState(false);

  const hiddenValue = selected ? toLocalDateKey(selected) : "";

  return (
    <>
      <input type="hidden" name={name} value={hiddenValue} />
      <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-8 flex-1 justify-start gap-2 border-input/60 bg-transparent px-3 text-sm shadow-none",
                !selected && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
              {formatDisplay(selected)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => {
                setSelected(d);
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(undefined)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input/60 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Clear due date"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </>
  );
}
