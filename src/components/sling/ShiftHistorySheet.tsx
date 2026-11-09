"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, MapPin, User } from "lucide-react";
import { Badge, type BadgeProps } from "@/src/components/ui/badge";
import { Separator } from "@/src/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/src/components/ui/sheet";
import { cn } from "@/src/lib/utils";
import { loadShiftHistory } from "@/src/lib/sling/schedule-actions";
import {
  MARK_STYLE,
  changeLabel,
  exactTime,
  markFor,
  relativeTime,
  type MarkKind,
  type ScheduleChange,
} from "@/src/lib/sling/schedule-change-format";
import type { OpenShift } from "@/src/components/sling/ScheduleBoard";

export const MARK_BADGE: Record<MarkKind, BadgeProps["variant"]> = {
  new: "info",
  edited: "warning",
  published: "success",
  deleted: "destructive",
};

// Side sheet with one shift's full Sling history (read-only, loaded on open).
export function ShiftHistorySheet({ shift, onClose }: { shift: OpenShift | null; onClose: () => void }) {
  const [state, setState] = useState<{ id: string; entries: ScheduleChange[]; error: string | null } | null>(null);

  useEffect(() => {
    if (!shift) return;
    let cancelled = false;
    loadShiftHistory(shift.id)
      .then((res) => !cancelled && setState({ id: shift.id, ...res }))
      .catch((e) => !cancelled && setState({ id: shift.id, entries: [], error: e instanceof Error ? e.message : String(e) }));
    return () => {
      cancelled = true;
    };
  }, [shift]);

  const loaded = state && shift && state.id === shift.id ? state : null;
  const statusVariant: BadgeProps["variant"] = shift?.deleted ? "destructive" : shift?.status === "Published" ? "success" : "warning";

  return (
    <Sheet open={Boolean(shift)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        {shift ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant}>{shift.status}</Badge>
                <span className="text-xs text-muted-foreground">Shift history</span>
              </div>
              <SheetTitle className={cn("text-lg", shift.deleted && "text-muted-foreground line-through")}>
                {shift.dayLabel} · {shift.timeLabel}
              </SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {shift.userName}
                    {shift.position ? <span className="text-muted-foreground/70">· {shift.position}</span> : null}
                  </span>
                  {shift.storeName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {shift.storeName}
                    </span>
                  ) : null}
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6">
              {!loaded ? (
                <div className="space-y-5" aria-label="Loading history">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="mt-1 h-3 w-3 animate-pulse rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : loaded.error ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  Couldn&apos;t load history: {loaded.error}
                </div>
              ) : !loaded.entries.length ? (
                <p className="text-sm text-muted-foreground">No history recorded for this shift.</p>
              ) : (
                <ol>
                  {loaded.entries.map((entry, i) => (
                    <TimelineItem key={entry.id} entry={entry} last={i === loaded.entries.length - 1} />
                  ))}
                </ol>
              )}
            </div>

            <Separator />
            <p className="flex items-center gap-1.5 px-6 py-3 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> From Sling&apos;s shift log. Times are Pacific.
            </p>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function TimelineItem({ entry, last }: { entry: ScheduleChange; last: boolean }) {
  const mark = markFor(entry.kind);
  return (
    <li className="relative flex gap-3 pb-6">
      {!last ? <span className="absolute left-[5px] top-4 h-full w-px bg-border" aria-hidden /> : null}
      <span
        className={cn(
          "relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-background",
          mark ? MARK_STYLE[mark].dot : "bg-muted-foreground"
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={mark ? MARK_BADGE[mark] : "muted"}>{changeLabel(entry)}</Badge>
          <span className="text-sm">
            <span className="text-muted-foreground">by </span>
            <span className="font-medium">{entry.actor?.name ?? "Someone"}</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground" title={entry.at}>
          {exactTime(entry.at)} · {relativeTime(entry.at)}
        </p>
        {entry.kind !== "other" && entry.note ? <p className="text-xs text-muted-foreground">{entry.note}</p> : null}
        {entry.fields.length ? <FieldDiffs entry={entry} /> : null}
      </div>
    </li>
  );
}

export function FieldDiffs({ entry, className }: { entry: ScheduleChange; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs", className)}>
      {entry.fields.map((f) => (
        <div key={f.field} className="contents">
          <dt className="capitalize text-muted-foreground">{f.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
            {f.from || f.to ? (
              <>
                {f.from ? <span className="text-muted-foreground line-through decoration-muted-foreground/50">{f.from}</span> : null}
                {f.from ? <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                <span className="font-medium">{f.to}</span>
              </>
            ) : (
              <span className="text-muted-foreground">changed</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
