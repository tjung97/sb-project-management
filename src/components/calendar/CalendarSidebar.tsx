"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { Calendar } from "@/src/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useCalendarPanel } from "@/src/components/calendar/CalendarPanelContext";
import { createCalendarEvent, deleteCalendarEvent } from "@/src/lib/ops/calendar-actions";
import { cn } from "@/src/lib/utils";
import type { SerializedIssueDue, SerializedCalendarEvent } from "@/src/components/calendar/CalendarSidebarServer";

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatPickerDate(date: Date | undefined): string {
  if (!date) return "Pick a date";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-400",
  normal: "text-muted-foreground",
  low: "text-muted-foreground/60",
};

export function CalendarSidebar({
  events,
  issues,
}: {
  events: SerializedCalendarEvent[];
  issues: SerializedIssueDue[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { open, hydrated, toggle } = useCalendarPanel();
  // Route-based collapse is deterministic from the URL, so it must NOT be gated
  // on `hydrated`: this component streams in via Suspense and hydrates after the
  // provider's effect has already flipped `hydrated`, which made the client's
  // hydration render disagree with the server HTML (hydration mismatch).
  const routeCollapsed = pathname.startsWith("/issues/") || pathname.startsWith("/operations");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [month, setMonth] = useState<Date>(new Date());

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventDate, setEventDate] = useState<Date | undefined>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const [, startTransition] = useTransition();

  // Reconstruct Date objects from ms timestamps
  const issueDates = issues.map((i) => new Date(i.due_at_ms));
  const eventDates = events.map((e) => new Date(e.date_ms));

  // Items for the selected day
  const selectedKey = toLocalDateKey(selectedDate);
  const dayIssues = issues.filter((i) => toLocalDateKey(new Date(i.due_at_ms)) === selectedKey);
  const dayEvents = events.filter((e) => toLocalDateKey(new Date(e.date_ms)) === selectedKey);

  function openNewEvent(date: Date) {
    setEventDate(date);
    setDialogOpen(true);
  }

  function handleDelete(eventId: string) {
    startTransition(async () => {
      await deleteCalendarEvent(eventId);
      router.refresh();
    });
  }

  // Serialize date to YYYY-MM-DD for the hidden form input
  function serializeDateForForm(date: Date | undefined): string {
    if (!date) return "";
    return toLocalDateKey(date);
  }

  return (
    <>
      <aside
        // The open/closed state comes from localStorage and can differ from the
        // server HTML when this streamed component hydrates late — expected.
        suppressHydrationWarning
        className={cn(
          "calendar-panel liquid-side-panel",
          hydrated && !open && "calendar-panel--closed",
          routeCollapsed && "calendar-panel--route-collapsed"
        )}
        aria-label="Calendar"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Calendar
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openNewEvent(selectedDate)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="New event"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={toggle}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Close calendar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="px-1">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => { if (d) setSelectedDate(d); }}
            month={month}
            onMonthChange={setMonth}
            modifiers={{ hasIssue: issueDates, hasEvent: eventDates }}
            modifiersClassNames={{
              hasIssue: "cal-has-issue",
              hasEvent: "cal-has-event",
            }}
            className="w-full"
          />
        </div>

        {/* Legend */}
        {(issueDates.length > 0 || eventDates.length > 0) && (
          <div className="flex items-center gap-3 px-4 pb-2 text-[10px] text-muted-foreground">
            {issueDates.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />
                Issue due
              </span>
            )}
            {eventDates.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                Event
              </span>
            )}
          </div>
        )}

        {/* Day detail */}
        <div className="border-t border-border/60 px-3 py-3">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {formatDayHeader(selectedDate)}
          </p>

          <div key={selectedKey} className="calendar-day-events space-y-1.5">
            {dayIssues.length === 0 && dayEvents.length === 0 && (
              <p className="text-xs text-muted-foreground/60">No items</p>
            )}

            {dayIssues.map((issue) => (
              <Link
                key={issue.id}
                href={`/issues/${issue.id}`}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors group"
              >
                <AlertCircle className={cn("mt-0.5 h-3 w-3 shrink-0", PRIORITY_COLORS[issue.priority])} />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {issue.title}
                </span>
              </Link>
            ))}

            {dayEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs group"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-foreground">{event.title}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(event.id)}
                  className="shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                  title="Delete event"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => openNewEvent(selectedDate)}
            className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add event
          </button>
        </div>
      </aside>

      {/* New event dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setDatePickerOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
          </DialogHeader>
          <form
            action={async (fd) => {
              await createCalendarEvent(fd);
              setDialogOpen(false);
              router.refresh();
            }}
            className="space-y-4 pt-2"
          >
            {/* Hidden date value for FormData */}
            <input type="hidden" name="date" value={serializeDateForForm(eventDate)} />

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="event-title">
                Title
              </label>
              <Input
                id="event-title"
                name="title"
                placeholder="Team lunch, review deadline…"
                required
              />
            </div>

            {/* Shadcn date picker */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date</label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start gap-2 text-left font-normal",
                      !eventDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
                    {formatPickerDate(eventDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={eventDate}
                    onSelect={(d) => {
                      setEventDate(d);
                      setDatePickerOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="event-notes">
                Notes{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="event-notes"
                name="notes"
                placeholder="Location, link, details…"
              />
            </div>

            {/* Color picker */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Color{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="flex gap-2">
                {(["blue", "green", "yellow", "red", "purple"] as const).map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input type="radio" name="color" value={c} className="sr-only peer" />
                    <span
                      className={cn(
                        "block h-5 w-5 rounded-full border-2 border-transparent ring-offset-background transition-all peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-ring/40 peer-checked:ring-offset-2",
                        c === "blue" && "bg-blue-500",
                        c === "green" && "bg-green-500",
                        c === "yellow" && "bg-yellow-400",
                        c === "red" && "bg-red-500",
                        c === "purple" && "bg-purple-500"
                      )}
                    />
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!eventDate}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                Create event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
