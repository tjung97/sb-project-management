"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Clock, MapPin, Store, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { cn } from "@/src/lib/utils";
import type { ScheduleWeek, SlingShiftView, StoreSchedule } from "@/src/lib/sling/api";
import {
  MARK_STYLE,
  changeLabel,
  relativeTime,
  type ChangeShift,
  type MarkKind,
  type ScheduleChange,
} from "@/src/lib/sling/schedule-change-format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/src/components/ui/tooltip";
import { FieldDiffs, MARK_BADGE } from "@/src/components/sling/ShiftHistorySheet";

/** A change mark for one shift on the grid. */
export interface ShiftMark {
  mark: MarkKind;
  /** Plain-text summary, e.g. "Edited by Noah · 2h ago — break: 30m → none". */
  summary: string;
  /** The change that earned the mark (for the tooltip). */
  change: ScheduleChange;
  /** Most recent change, when it's a different one (e.g. published after the edit). */
  latest: ScheduleChange | null;
  /** How many changes in the window touched this shift. */
  count: number;
}

/** What the history dialog needs to show a shift. */
export interface OpenShift {
  id: string;
  dayLabel: string;
  timeLabel: string;
  userName: string;
  position: string;
  storeName: string | null;
  status: string;
  deleted?: boolean;
}

interface MarkProps {
  marks?: Map<string, ShiftMark>;
  /** Shifts deleted in the selected window (shown as faded ghosts). */
  ghosts?: ChangeShift[];
  onOpenShift?: (shift: OpenShift) => void;
}

type GridShift = SlingShiftView & { ghost?: ChangeShift };

type WeekKey = "thisWeek" | "nextWeek";

const GRID_TEMPLATE = "minmax(176px, 210px) repeat(7, minmax(104px, 1fr)) 56px";

export function ScheduleBoard({
  stores,
  thisWeekRangeLabel,
  nextWeekRangeLabel,
  businessHoursLabel,
  marks,
  ghosts,
  onOpenShift,
}: {
  stores: StoreSchedule[];
  thisWeekRangeLabel: string | null;
  nextWeekRangeLabel: string | null;
  businessHoursLabel?: string;
} & MarkProps) {
  const [week, setWeek] = useState<WeekKey>("thisWeek");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup type="single" value={week} onValueChange={(v) => v && setWeek(v as WeekKey)} aria-label="Week">
          <ToggleGroupItem value="thisWeek" className="h-auto flex-col items-start gap-0 px-3 py-1.5">
            <span className="text-sm">This week</span>
            {thisWeekRangeLabel ? <span className="text-[11px] font-normal text-muted-foreground">{thisWeekRangeLabel}</span> : null}
          </ToggleGroupItem>
          <ToggleGroupItem value="nextWeek" className="h-auto flex-col items-start gap-0 px-3 py-1.5">
            <span className="text-sm">Next week</span>
            {nextWeekRangeLabel ? <span className="text-[11px] font-normal text-muted-foreground">{nextWeekRangeLabel}</span> : null}
          </ToggleGroupItem>
        </ToggleGroup>
        {businessHoursLabel ? (
          <Badge variant="outline" className="gap-1.5 font-normal text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Store hours {businessHoursLabel}
          </Badge>
        ) : null}
      </div>

      <div className="space-y-5">
        {stores.map((store) => (
          <StoreRoster
            key={store.sourceId}
            store={store}
            week={store[week]}
            isNext={week === "nextWeek"}
            marks={marks}
            ghosts={ghosts}
            onOpenShift={onOpenShift}
          />
        ))}
      </div>
    </div>
  );
}

function StoreRoster({
  store,
  week,
  isNext,
  marks,
  ghosts,
  onOpenShift,
}: { store: StoreSchedule; week: ScheduleWeek; isNext: boolean } & MarkProps) {
  // Deleted shifts that belonged to this store + week, shown as ghosts.
  const storeGhosts = useMemo(() => {
    const days = new Set(week.days.map((d) => d.date));
    return (ghosts ?? []).filter((g) => g.locationId && g.locationId === store.locationId && days.has(g.day));
  }, [ghosts, week, store.locationId]);
  const employees = useMemo(() => buildEmployees(week, storeGhosts), [week, storeGhosts]);
  // Changed shifts (+ ghosts) per day, for the header count.
  const changedPerDay = useMemo(
    () =>
      week.days.map(
        (d) => d.shifts.filter((s) => marks?.has(s.id)).length + storeGhosts.filter((g) => g.day === d.date).length
      ),
    [week, marks, storeGhosts]
  );
  const coverage = useMemo(() => week.days.map((d) => ({ peak: peakHeadcount(d.shifts), hours: sumHours(d.shifts) })), [week]);
  const maxPeak = Math.max(1, ...coverage.map((c) => c.peak));
  const uncoveredDays = useMemo(() => week.days.filter((d) => !d.empty && d.gaps.length > 0), [week]);
  const staffCount = employees.filter((e) => !e.ghostOnly).length;

  const planLabel = isNext
    ? week.publishedCount === 0 && week.draftCount === 0
      ? "Not started"
      : week.publishedCount === 0
        ? "Draft only"
        : "Published"
    : "Published";

  return (
    <Card className="dash-rise overflow-hidden p-0">
      {/* store header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Store className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">{store.storeName}</h3>
            {store.locationName ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> Sling: {store.locationName}
              </p>
            ) : (
              <p className="text-xs text-warning-foreground">No matching Sling location</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> {staffCount} staff
          </Badge>
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" /> {week.publishedCount} shifts
          </Badge>
          <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {week.totalHours}h
          </Badge>
          {week.draftCount > 0 ? <Badge variant="warning">{week.draftCount} draft</Badge> : null}
          {uncoveredDays.length ? (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="h-3 w-3" />
              {uncoveredDays.length} coverage gap{uncoveredDays.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <Badge variant={planLabel === "Published" ? "success" : planLabel === "Draft only" ? "warning" : "muted"}>
            {planLabel}
          </Badge>
        </div>
      </div>

      {uncoveredDays.length ? (
        <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold">Uncovered store hours:</span>{" "}
            {uncoveredDays.map((d) => `${d.weekday} ${d.gaps.map((g) => `${g.start}–${g.end}`).join(", ")}`).join(" · ")}
          </p>
        </div>
      ) : null}

      {employees.length ? (
        <div className="overflow-x-auto border-t border-border/70">
          <div className="grid min-w-[960px] gap-px bg-border/60" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
            {/* header row */}
            <div className="flex items-end bg-muted/40 px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Staff</span>
            </div>
            {week.days.map((day, i) => {
              const uncovered = !day.empty && day.gaps.length > 0;
              const changed = changedPerDay[i];
              return (
                <div
                  key={day.date}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-2 py-2",
                    day.isToday ? "bg-accent" : "bg-muted/40"
                  )}
                >
                  {day.isToday ? <span className="absolute inset-x-0 top-0 h-[3px] bg-amber-500" aria-hidden /> : null}
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide",
                      day.isToday ? "text-foreground" : "text-muted-foreground",
                      uncovered && "text-destructive"
                    )}
                  >
                    {uncovered ? <TriangleAlert className="h-3 w-3" /> : null}
                    {day.weekday}
                  </span>
                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-semibold tabular-nums",
                      day.isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground"
                    )}
                    aria-label={day.isToday ? "Today" : undefined}
                  >
                    {Number(day.date.slice(8))}
                  </span>
                  <div className="flex h-4 items-center gap-1">
                    {day.isToday ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">Today</span>
                    ) : null}
                    {changed ? (
                      <Badge
                        variant="warning"
                        className="h-4 gap-1 px-1.5 py-0 text-[10px]"
                        title={`${changed} changed shift${changed === 1 ? "" : "s"}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                        {changed}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div className="flex items-end justify-end bg-muted/40 px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Hrs</span>
            </div>

            {/* employee rows */}
            {employees.map((emp) => (
              <EmployeeRow
                key={emp.key}
                emp={emp}
                days={week.days}
                storeName={store.storeName}
                marks={marks}
                onOpenShift={onOpenShift}
              />
            ))}

            {/* coverage footer */}
            <div className="flex items-center bg-muted/30 px-3 py-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Coverage</span>
            </div>
            {week.days.map((day, i) => {
              const uncovered = !day.empty && day.gaps.length > 0;
              const c = coverage[i];
              return (
                <div
                  key={day.date}
                  className={cn("flex flex-col justify-center gap-1.5 px-2.5 py-2.5", day.isToday ? "bg-accent/70" : "bg-muted/30")}
                  title={uncovered ? `Uncovered: ${day.gaps.map((g) => `${g.start}–${g.end}`).join(", ")}` : undefined}
                >
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", uncovered ? "bg-destructive" : "bg-primary/70")}
                      style={{ width: `${c.peak ? Math.max(12, (c.peak / maxPeak) * 100) : 0}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-[10px] tabular-nums",
                      uncovered ? "font-medium text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {uncovered ? (
                      <>
                        <TriangleAlert className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">Gap {day.gaps.map((g) => `${g.start}–${g.end}`).join(", ")}</span>
                      </>
                    ) : c.peak ? (
                      `Peak ${c.peak} · ${c.hours}h`
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-end bg-muted/30 px-3 py-2.5">
              <span className="text-xs font-semibold tabular-nums">{week.totalHours}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-8 text-sm text-muted-foreground">
          <CalendarRange className="h-4 w-4" /> No shifts scheduled this week.
        </div>
      )}
    </Card>
  );
}

function EmployeeRow({
  emp,
  days,
  storeName,
  marks,
  onOpenShift,
}: {
  emp: Employee;
  days: { date: string; isToday: boolean }[];
  storeName: string;
} & Pick<MarkProps, "marks" | "onOpenShift">) {
  const palette = ROLE_PALETTE[emp.roleIdx];
  return (
    <>
      <div className={cn("flex items-center gap-2.5 bg-card px-3 py-2", emp.ghostOnly && "opacity-60")}>
        <Avatar name={emp.name} url={emp.avatar} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-tight">{emp.name}</p>
          {emp.role ? (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", palette.dot)} />
              {emp.role}
            </p>
          ) : null}
        </div>
      </div>
      {days.map((day) => {
        const shifts = emp.byDay.get(day.date) ?? [];
        return (
          <div key={day.date} className={cn("min-h-[3.25rem] p-1.5", day.isToday ? "bg-accent/40" : "bg-card")}>
            <div className="space-y-1">
              {shifts.map((shift, idx) =>
                shift.ghost ? (
                  <GhostChip key={`ghost-${shift.id}`} ghost={shift.ghost} onOpen={onOpenShift} />
                ) : (
                  <ShiftChip
                    key={`${shift.id || shift.startMin}-${idx}`}
                    shift={shift}
                    palette={palette}
                    mark={marks?.get(shift.id)}
                    onOpen={
                      onOpenShift && shift.id
                        ? () =>
                            onOpenShift({
                              id: shift.id,
                              dayLabel: `${shift.weekday} ${shift.day.slice(5).replace("-", "/")}`,
                              timeLabel: `${compactTime(shift.start)}–${compactTime(shift.end)}`,
                              userName: shift.user,
                              position: shift.position,
                              storeName,
                              status: shift.status === "published" ? "Published" : "Draft",
                            })
                        : undefined
                    }
                  />
                )
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-end bg-card px-3">
        <span className={cn("text-xs font-medium tabular-nums", !emp.totalHours && "text-muted-foreground")}>{emp.totalHours}</span>
      </div>
    </>
  );
}

const MARK_RING: Record<MarkKind, string> = {
  new: "ring-info/50",
  edited: "ring-warning/60",
  published: "ring-success/50",
  deleted: "ring-destructive/50",
};

function ShiftChip({
  shift,
  palette,
  mark,
  onOpen,
}: {
  shift: SlingShiftView;
  palette: RolePalette;
  mark?: ShiftMark;
  onOpen?: () => void;
}) {
  const draft = shift.status !== "published";
  const base = `${shift.start}–${shift.end} · ${shift.user}${shift.position ? ` · ${shift.position}` : ""}${draft ? " · draft" : ""}`;
  const chip = (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={mark ? `${base}. ${mark.summary}` : base}
      title={mark ? undefined : `${base}\nClick for history`}
      className={cn(
        "group relative flex w-full flex-col overflow-visible rounded-md border bg-background py-1 pl-2.5 pr-2 text-left shadow-xs transition",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
        draft ? "border-dashed bg-muted/40" : "border-border",
        onOpen && "cursor-pointer hover:-translate-y-px hover:shadow-sm",
        mark && cn("ring-2", MARK_RING[mark.mark])
      )}
    >
      <span className={cn("absolute inset-y-1 left-1 w-[3px] rounded-full", palette.dot)} aria-hidden />
      {mark ? (
        <span
          className={cn("absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card", MARK_STYLE[mark.mark].dot)}
          aria-hidden
        />
      ) : null}
      <span className="text-[11px] font-semibold leading-tight tabular-nums text-foreground">
        {compactTime(shift.start)}
        <span className="font-normal text-muted-foreground">–{compactTime(shift.end)}</span>
      </span>
      {draft ? (
        <span className="text-[9px] font-medium uppercase tracking-wide text-warning-foreground">Draft</span>
      ) : null}
    </button>
  );
  if (!mark) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="top" className="w-72 max-w-72 space-y-2 p-3">
        <ChangeTooltipBody change={mark.change} latest={mark.latest} mark={mark.mark} count={mark.count} subtitle={base} />
      </TooltipContent>
    </Tooltip>
  );
}

function ChangeTooltipBody({
  change,
  latest,
  mark,
  count,
  subtitle,
}: {
  change: ScheduleChange;
  latest: ScheduleChange | null;
  mark: MarkKind;
  count: number;
  subtitle: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Badge variant={MARK_BADGE[mark]} className="px-2 py-0 text-[10px]">
          {mark === "deleted" ? "Deleted" : changeLabel(change)}
        </Badge>
        <span className="truncate text-xs">
          by <span className="font-medium">{change.actor?.name ?? "Someone"}</span>
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{relativeTime(change.at)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      {change.fields.length ? <FieldDiffs entry={change} className="bg-muted/60" /> : null}
      {latest ? (
        <p className="text-[11px] text-muted-foreground">
          Then {changeLabel(latest).toLowerCase()} by {latest.actor?.name ?? "someone"} · {relativeTime(latest.at)}
        </p>
      ) : null}
      <p className="text-[10px] text-muted-foreground">
        {count > 1 ? `${count} changes in this period · ` : ""}Click for full history
      </p>
    </>
  );
}

function GhostChip({ ghost, onOpen }: { ghost: ChangeShift; onOpen?: (shift: OpenShift) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Deleted shift ${ghost.timeLabel}, ${ghost.userName}`}
          onClick={() =>
            onOpen?.({
              id: ghost.id,
              dayLabel: ghost.dayLabel,
              timeLabel: ghost.timeLabel,
              userName: ghost.userName,
              position: ghost.position,
              storeName: ghost.storeName,
              status: "Deleted",
              deleted: true,
            })
          }
          className="relative flex w-full flex-col rounded-md border border-dashed border-destructive/40 bg-destructive/[0.04] px-2 py-1 text-left outline-none transition hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/45"
        >
          <span className={cn("absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card", MARK_STYLE.deleted.dot)} aria-hidden />
          <span className="text-[11px] font-medium leading-tight text-destructive/80 line-through">{ghost.timeLabel}</span>
          <span className="text-[9px] font-medium uppercase tracking-wide text-destructive/80">Deleted</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="w-64 space-y-1 p-3">
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="px-2 py-0 text-[10px]">
            Deleted
          </Badge>
          <span className="text-xs">
            {ghost.dayLabel} · {ghost.timeLabel}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {ghost.userName}
          {ghost.position ? ` · ${ghost.position}` : ""}
        </p>
        <p className="text-[10px] text-muted-foreground">Click to see who deleted it and when</p>
      </TooltipContent>
    </Tooltip>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-border" loading="lazy" />;
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
      {initials || "?"}
    </span>
  );
}

// ---- data shaping ----------------------------------------------------------

interface Employee {
  key: string;
  name: string;
  avatar: string | null;
  role: string;
  roleIdx: number;
  totalHours: number;
  byDay: Map<string, GridShift[]>;
  /** Only here because of deleted (ghost) shifts. */
  ghostOnly: boolean;
}

function buildEmployees(week: ScheduleWeek, ghosts: ChangeShift[] = []): Employee[] {
  const map = new Map<string, Employee & { roleCounts: Record<string, number> }>();

  for (const day of week.days) {
    for (const shift of day.shifts) {
      const key = shift.userId ?? shift.user;
      let emp = map.get(key);
      if (!emp) {
        emp = {
          key,
          name: shift.user,
          avatar: shift.userAvatar,
          role: "",
          roleIdx: 0,
          totalHours: 0,
          byDay: new Map(),
          roleCounts: {},
          ghostOnly: false,
        };
        map.set(key, emp);
      }
      if (!emp.avatar && shift.userAvatar) emp.avatar = shift.userAvatar;
      emp.totalHours += Math.max(0, shift.endMin - shift.startMin) / 60;
      if (shift.position) emp.roleCounts[shift.position] = (emp.roleCounts[shift.position] ?? 0) + 1;
      const list = emp.byDay.get(day.date) ?? [];
      list.push(shift);
      emp.byDay.set(day.date, list);
    }
  }

  // Deleted shifts go into their person's row (a row is added if they have no other shifts).
  for (const g of ghosts) {
    const key = g.userId ?? g.userName;
    let emp = map.get(key);
    if (!emp) {
      emp = {
        key,
        name: g.userName,
        avatar: null,
        role: g.position,
        roleIdx: 0,
        totalHours: 0,
        byDay: new Map(),
        roleCounts: {},
        ghostOnly: true,
      };
      map.set(key, emp);
    }
    const list = emp.byDay.get(g.day) ?? [];
    list.push({ ...EMPTY_SHIFT, id: g.id, day: g.day, user: g.userName, userId: g.userId, position: g.position, ghost: g });
    emp.byDay.set(g.day, list);
  }

  const employees = [...map.values()].map((emp) => {
    const role = Object.entries(emp.roleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return {
      key: emp.key,
      name: emp.name,
      avatar: emp.avatar,
      role,
      roleIdx: role ? hashIndex(role, ROLE_PALETTE.length) : ROLE_PALETTE.length - 1,
      totalHours: Math.round(emp.totalHours),
      byDay: emp.byDay,
      ghostOnly: emp.ghostOnly,
    };
  });

  // Open shifts last, people with only deleted shifts after that, then most-scheduled first.
  return employees.sort((a, b) => {
    if (a.ghostOnly !== b.ghostOnly) return a.ghostOnly ? 1 : -1;
    const ao = a.name === "Open shift" ? 1 : 0;
    const bo = b.name === "Open shift" ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return b.totalHours - a.totalHours || a.name.localeCompare(b.name);
  });
}

const EMPTY_SHIFT: SlingShiftView = {
  id: "",
  day: "",
  weekday: "",
  start: "",
  end: "",
  startMin: 0,
  endMin: 0,
  userId: null,
  user: "",
  userAvatar: null,
  position: "",
  status: "other",
};

function sumHours(shifts: SlingShiftView[]): number {
  return Math.round(shifts.reduce((sum, s) => sum + Math.max(0, s.endMin - s.startMin) / 60, 0));
}

function peakHeadcount(shifts: SlingShiftView[]): number {
  if (!shifts.length) return 0;
  const points = shifts.flatMap((s) => [
    { t: s.startMin, d: 1 },
    { t: s.endMin, d: -1 },
  ]);
  points.sort((a, b) => a.t - b.t || a.d - b.d);
  let cur = 0;
  let peak = 0;
  for (const p of points) {
    cur += p.d;
    if (cur > peak) peak = cur;
  }
  return peak;
}

function compactTime(label: string): string {
  // "9:00 AM" -> "9a", "1:30 PM" -> "1:30p"
  const m = label.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return label;
  const hour = m[1];
  const minute = m[2] && m[2] !== "00" ? `:${m[2]}` : "";
  const suffix = m[3] ? m[3][0].toLowerCase() : "";
  return `${hour}${minute}${suffix}`;
}

function hashIndex(value: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % mod;
}

interface RolePalette {
  /** Role color (stripe on shift boxes + dot next to the role). */
  dot: string;
}

// Role colors are only a thin stripe + dot, so they don't compete with the change marks.
const ROLE_PALETTE: RolePalette[] = [
  { dot: "bg-violet-500" },
  { dot: "bg-sky-500" },
  { dot: "bg-teal-500" },
  { dot: "bg-amber-500" },
  { dot: "bg-pink-500" },
  { dot: "bg-slate-400" },
];
