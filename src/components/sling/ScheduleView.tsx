"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, CheckCheck, History } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { ScheduleBoard, type OpenShift, type ShiftMark } from "@/src/components/sling/ScheduleBoard";
import { ScheduleChangesFeed } from "@/src/components/sling/ScheduleChangesFeed";
import { ShiftHistorySheet } from "@/src/components/sling/ShiftHistorySheet";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Separator } from "@/src/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { TooltipProvider } from "@/src/components/ui/tooltip";
import { markScheduleSeenAction, recordScheduleVisitAction } from "@/src/lib/sling/schedule-actions";
import {
  MARK_STYLE,
  changeSummary,
  markFor,
  strongestMark,
  type ChangeShift,
  type MarkKind,
  type ScheduleChange,
} from "@/src/lib/sling/schedule-change-format";
import type { StoreSchedule } from "@/src/lib/sling/api";

type Tab = "schedule" | "changes";
type Window = "visit" | "24h" | "3d" | "7d" | "off";

const WINDOWS: { key: Window; label: string }[] = [
  { key: "visit", label: "Since last visit" },
  { key: "24h", label: "24h" },
  { key: "3d", label: "3 days" },
  { key: "7d", label: "7 days" },
  { key: "off", label: "Off" },
];
const WINDOW_MS: Record<Exclude<Window, "visit" | "off">, number> = { "24h": 864e5, "3d": 3 * 864e5, "7d": 7 * 864e5 };

export function ScheduleView({
  stores,
  thisWeekRangeLabel,
  nextWeekRangeLabel,
  businessHoursLabel,
  changes,
  changesNextBefore,
  changesError,
  initialBaseline,
  renderedAt,
}: {
  stores: StoreSchedule[];
  thisWeekRangeLabel: string | null;
  nextWeekRangeLabel: string | null;
  businessHoursLabel?: string;
  changes: ScheduleChange[];
  changesNextBefore: string | null;
  changesError: string | null;
  initialBaseline: number;
  renderedAt: number;
}) {
  const [tab, setTab] = useState<Tab>("schedule");
  const [win, setWin] = useState<Window>("visit");
  const [baseline, setBaseline] = useState(initialBaseline);
  const [openShift, setOpenShift] = useState<OpenShift | null>(null);
  const [marking, startMarking] = useTransition();

  // Record this visit (moves "last visit" forward for next time).
  useEffect(() => {
    recordScheduleVisitAction().catch(() => {});
  }, []);

  const since = win === "off" ? null : win === "visit" ? baseline : renderedAt - WINDOW_MS[win];
  // The grid only shows our stores; the Changes tab shows every Sling location.
  const storeLocations = useMemo(() => new Set(stores.map((s) => s.locationId).filter(Boolean) as string[]), [stores]);
  const sinceVisitCount = useMemo(() => changes.filter((c) => Date.parse(c.at) > baseline).length, [changes, baseline]);
  const sinceVisitStoreCount = useMemo(
    () =>
      changes.filter(
        (c) => Date.parse(c.at) > baseline && c.shifts.some((s) => s.locationId && storeLocations.has(s.locationId))
      ).length,
    [changes, baseline, storeLocations]
  );

  // Marks for live shifts + ghosts for deleted ones, from changes inside the window.
  const { marks, ghosts, counts } = useMemo(() => {
    const marks = new Map<string, ShiftMark>();
    const ghosts: ChangeShift[] = [];
    const counts: Record<MarkKind, number> = { new: 0, edited: 0, published: 0, deleted: 0 };
    if (since == null) return { marks, ghosts, counts };

    const perShift = new Map<string, { list: ScheduleChange[]; shift: ChangeShift }>();
    for (const c of changes) {
      if (Date.parse(c.at) <= since) continue;
      for (const s of c.shifts) {
        if (!s.locationId || !storeLocations.has(s.locationId)) continue;
        const entry = perShift.get(s.id);
        if (entry) entry.list.push(c);
        else perShift.set(s.id, { list: [c], shift: s }); // changes are newest first
      }
    }
    for (const [id, { list, shift }] of perShift) {
      const mark = strongestMark(list.map((c) => c.kind));
      if (!mark) continue;
      counts[mark]++;
      if (mark === "deleted") ghosts.push(shift);
      else {
        // Show the change that earned the mark (e.g. the edit), plus the latest action if different.
        const rep = list.find((c) => markFor(c.kind) === mark) ?? list[0];
        marks.set(id, {
          mark,
          summary: changeSummary(rep, renderedAt),
          change: rep,
          latest: list[0] !== rep ? list[0] : null,
          count: list.length,
        });
      }
    }
    return { marks, ghosts, counts };
  }, [changes, since, renderedAt, storeLocations]);

  const weekDays = useMemo(
    () => (stores[0] ? [...stores[0].thisWeek.days, ...stores[0].nextWeek.days].map((d) => d.date) : []),
    [stores]
  );

  function markAllSeen() {
    startMarking(async () => {
      try {
        setBaseline(await markScheduleSeenAction());
      } catch {
        setBaseline(Date.now());
      }
    });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="schedule">
            <CalendarDays className="h-4 w-4" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="changes">
            <History className="h-4 w-4" />
            Changes
            {sinceVisitCount ? (
              <Badge variant="info" className="ml-0.5 px-1.5 py-0 text-[10px]">
                {sinceVisitCount} new
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* forceMount keeps each tab's state (filters, loaded pages) while switching */}
        <TabsContent value="schedule" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Show changes</span>
            <ToggleGroup type="single" value={win} onValueChange={(v) => v && setWin(v as Window)} aria-label="Change window">
              {WINDOWS.map((w) => (
                <ToggleGroupItem key={w.key} value={w.key}>
                  {w.label}
                  {w.key === "visit" && sinceVisitStoreCount ? (
                    <Badge variant="info" className="px-1.5 py-0 text-[10px] tabular-nums">
                      {sinceVisitStoreCount}
                    </Badge>
                  ) : null}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {win !== "off" ? (
              <>
                <Separator orientation="vertical" className="hidden h-5 sm:block" />
                <div className="flex flex-wrap items-center gap-1.5">
                  {(["new", "edited", "published", "deleted"] as MarkKind[]).map((m) => (
                    <Badge key={m} variant="outline" className="gap-1.5 px-2 py-0.5 text-[11px] font-normal">
                      <span className={cn("h-2 w-2 rounded-full", MARK_STYLE[m].dot)} />
                      {MARK_STYLE[m].label}
                      <span className="font-semibold tabular-nums">{counts[m]}</span>
                    </Badge>
                  ))}
                </div>
              </>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {changesError ? (
                <span className="text-[11px] text-warning-foreground">Changes unavailable: {changesError}</span>
              ) : null}
              {win === "visit" && sinceVisitCount ? (
                <Button variant="ghost" size="sm" onClick={markAllSeen} disabled={marking} className="h-8 text-info">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all as seen
                </Button>
              ) : null}
            </div>
          </Card>

          <ScheduleBoard
            stores={stores}
            thisWeekRangeLabel={thisWeekRangeLabel}
            nextWeekRangeLabel={nextWeekRangeLabel}
            businessHoursLabel={businessHoursLabel}
            marks={marks}
            ghosts={ghosts}
            onOpenShift={setOpenShift}
          />
        </TabsContent>

        <TabsContent value="changes" forceMount className="data-[state=inactive]:hidden">
          <ScheduleChangesFeed
            initialChanges={changes}
            initialNextBefore={changesNextBefore}
            error={changesError}
            baseline={baseline}
            weekDays={weekDays}
            onOpenShift={setOpenShift}
          />
        </TabsContent>
      </Tabs>

      <ShiftHistorySheet shift={openShift} onClose={() => setOpenShift(null)} />
    </TooltipProvider>
  );
}
