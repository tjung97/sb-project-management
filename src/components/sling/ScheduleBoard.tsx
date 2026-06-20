"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Clock, TriangleAlert, Users } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";
import type { ScheduleWeek, SlingShiftView, StoreSchedule } from "@/src/lib/sling/api";

type WeekKey = "thisWeek" | "nextWeek";

const GRID_TEMPLATE = "minmax(168px, 200px) repeat(7, minmax(96px, 1fr)) 52px";

export function ScheduleBoard({
  stores,
  thisWeekRangeLabel,
  nextWeekRangeLabel,
  businessHoursLabel,
}: {
  stores: StoreSchedule[];
  thisWeekRangeLabel: string | null;
  nextWeekRangeLabel: string | null;
  businessHoursLabel?: string;
}) {
  const [week, setWeek] = useState<WeekKey>("thisWeek");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border/80 bg-card p-1 text-sm shadow-sm">
          <WeekTab active={week === "thisWeek"} onClick={() => setWeek("thisWeek")} label="This week" sub={thisWeekRangeLabel} />
          <WeekTab active={week === "nextWeek"} onClick={() => setWeek("nextWeek")} label="Next week" sub={nextWeekRangeLabel} accent />
        </div>
        {businessHoursLabel ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Store hours {businessHoursLabel}
          </span>
        ) : null}
      </div>

      <div className="space-y-5">
        {stores.map((store) => (
          <StoreRoster key={store.sourceId} store={store} week={store[week]} isNext={week === "nextWeek"} />
        ))}
      </div>
    </div>
  );
}

function WeekTab({
  active,
  onClick,
  label,
  sub,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string | null;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-md px-4 py-1.5 transition",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        {accent && !active ? <span className="h-1.5 w-1.5 rounded-full bg-info" /> : null}
        {label}
      </span>
      {sub ? <span className={cn("text-[11px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{sub}</span> : null}
    </button>
  );
}

function StoreRoster({ store, week, isNext }: { store: StoreSchedule; week: ScheduleWeek; isNext: boolean }) {
  const employees = useMemo(() => buildEmployees(week), [week]);
  const coverage = useMemo(
    () => week.days.map((d) => ({ peak: peakHeadcount(d.shifts), hours: sumHours(d.shifts) })),
    [week]
  );
  const maxPeak = Math.max(1, ...coverage.map((c) => c.peak));
  const uncoveredDays = useMemo(() => week.days.filter((d) => !d.empty && d.gaps.length > 0), [week]);

  const planLabel = isNext
    ? week.publishedCount === 0 && week.draftCount === 0
      ? "Not started"
      : week.publishedCount === 0
        ? "Draft only"
        : "Published"
    : "Published";

  return (
    <div className="dash-card dash-rise overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{store.storeName}</h3>
          {store.locationName ? (
            <p className="text-[11px] text-muted-foreground">Sling location: {store.locationName}</p>
          ) : (
            <p className="text-[11px] text-warning-foreground">No matching Sling location</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Stat icon={<Users className="h-3.5 w-3.5" />} value={`${employees.length} staff`} />
          <Stat icon={null} value={`${week.publishedCount} shifts`} />
          {week.draftCount > 0 ? <Stat icon={null} value={`${week.draftCount} draft`} tone="warning" /> : null}
          <Stat icon={<Clock className="h-3.5 w-3.5" />} value={`${week.totalHours}h`} />
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
        <div className="flex items-start gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold">Uncovered store hours:</span>{" "}
            {uncoveredDays
              .map((d) => `${d.weekday} ${d.gaps.map((g) => `${g.start}–${g.end}`).join(", ")}`)
              .join(" · ")}
          </p>
        </div>
      ) : null}

      {employees.length ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] gap-px bg-border/60" style={{ gridTemplateColumns: GRID_TEMPLATE }}>
            {/* Header */}
            <HeaderCell className="bg-muted/40">
              <span className="text-[11px] font-medium text-muted-foreground">Staff</span>
            </HeaderCell>
            {week.days.map((day) => {
              const uncovered = !day.empty && day.gaps.length > 0;
              return (
                <HeaderCell
                  key={day.date}
                  className={cn(
                    "bg-muted/40 text-center",
                    day.isToday && "sched-today",
                    uncovered && "bg-destructive/10"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center gap-1 text-xs font-semibold",
                      day.isToday && "text-primary",
                      uncovered && "text-destructive"
                    )}
                  >
                    {uncovered ? <TriangleAlert className="h-3 w-3" /> : null}
                    {day.weekday}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{day.date.slice(5).replace("-", "/")}</div>
                </HeaderCell>
              );
            })}
            <HeaderCell className="bg-muted/40 text-center">
              <span className="text-[10px] font-medium text-muted-foreground">Hrs</span>
            </HeaderCell>

            {/* Employee rows */}
            {employees.map((emp) => (
              <EmployeeRow key={emp.key} emp={emp} days={week.days.map((d) => d.date)} todayDates={week.days} />
            ))}

            {/* Coverage footer */}
            <FooterCell className="bg-muted/30">
              <span className="text-[11px] font-medium text-muted-foreground">Coverage</span>
            </FooterCell>
            {week.days.map((day, i) => {
              const uncovered = !day.empty && day.gaps.length > 0;
              return (
                <FooterCell
                  key={day.date}
                  className={cn("bg-muted/30", day.isToday && "sched-today", uncovered && "bg-destructive/10")}
                  title={uncovered ? `Uncovered: ${day.gaps.map((g) => `${g.start}–${g.end}`).join(", ")}` : undefined}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex h-5 w-full items-end justify-center gap-px">
                      <span
                        className={cn(
                          "w-full max-w-[28px] rounded-sm",
                          uncovered ? "bg-destructive/70" : coverage[i].peak > 0 ? "progress-fill" : "bg-muted"
                        )}
                        style={{ height: `${Math.max(coverage[i].peak > 0 ? 22 : 8, (coverage[i].peak / maxPeak) * 100)}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-[10px] tabular-nums",
                        uncovered ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {uncovered ? <TriangleAlert className="h-2.5 w-2.5" /> : null}
                      {coverage[i].peak ? `▲${coverage[i].peak}` : "—"}
                    </span>
                  </div>
                </FooterCell>
              );
            })}
            <FooterCell className="bg-muted/30 text-center">
              <span className="text-[11px] font-semibold tabular-nums">{week.totalHours}</span>
            </FooterCell>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
          <CalendarRange className="h-4 w-4" /> No shifts scheduled this week.
        </div>
      )}
    </div>
  );
}

function EmployeeRow({
  emp,
  days,
  todayDates,
}: {
  emp: Employee;
  days: string[];
  todayDates: { date: string; isToday: boolean }[];
}) {
  const palette = ROLE_PALETTE[emp.roleIdx];
  return (
    <>
      <div className="flex items-center gap-2 bg-card px-2.5 py-2">
        <Avatar name={emp.name} url={emp.avatar} />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold leading-tight">{emp.name}</p>
          {emp.role ? (
            <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              <span className={cn("h-1.5 w-1.5 rounded-full", palette.dot)} />
              {emp.role}
            </p>
          ) : null}
        </div>
      </div>
      {days.map((date, i) => {
        const shifts = emp.byDay.get(date) ?? [];
        return (
          <div key={date} className={cn("min-h-[3rem] bg-card p-1.5", todayDates[i]?.isToday && "sched-today")}>
            <div className="space-y-1">
              {shifts.length ? (
                shifts.map((shift, idx) => <ShiftChip key={`${shift.startMin}-${idx}`} shift={shift} palette={palette} />)
              ) : (
                <span className="block py-1 text-center text-[10px] text-muted-foreground/40">·</span>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-center bg-card px-1">
        <span className="text-xs font-medium tabular-nums">{emp.totalHours}</span>
      </div>
    </>
  );
}

function ShiftChip({ shift, palette }: { shift: SlingShiftView; palette: RolePalette }) {
  const draft = shift.status !== "published";
  return (
    <div
      className={cn(
        "rounded-md border px-1.5 py-1 text-[10px] leading-tight",
        palette.bar,
        draft && "border-dashed opacity-90"
      )}
      title={`${shift.start}–${shift.end} · ${shift.user}${shift.position ? ` · ${shift.position}` : ""}${draft ? " · draft" : ""}`}
    >
      <div className="font-semibold">
        {compactTime(shift.start)}<span className="opacity-70">–{compactTime(shift.end)}</span>
      </div>
      {draft ? <div className="text-[9px] uppercase tracking-wide opacity-70">draft</div> : null}
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-7 w-7 shrink-0 rounded-full object-cover" loading="lazy" />;
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
      {initials || "?"}
    </span>
  );
}

function HeaderCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-2 py-2", className)}>{children}</div>;
}

function FooterCell({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={cn("flex items-center px-2 py-2", className)} title={title}>
      {children}
    </div>
  );
}

function Stat({ icon, value, tone }: { icon: React.ReactNode; value: string; tone?: "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px]",
        tone === "warning" ? "text-warning-foreground" : "text-muted-foreground"
      )}
    >
      {icon}
      {value}
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
  byDay: Map<string, SlingShiftView[]>;
}

function buildEmployees(week: ScheduleWeek): Employee[] {
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
    };
  });

  // Open shifts last, then most-scheduled first.
  return employees.sort((a, b) => {
    const ao = a.name === "Open shift" ? 1 : 0;
    const bo = b.name === "Open shift" ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return b.totalHours - a.totalHours || a.name.localeCompare(b.name);
  });
}

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
  bar: string;
  dot: string;
}

const ROLE_PALETTE: RolePalette[] = [
  { bar: "border-info/40 bg-info/10 text-info", dot: "bg-info" },
  { bar: "border-success/40 bg-success/10 text-success", dot: "bg-success" },
  { bar: "border-warning/50 bg-warning/10 text-warning-foreground", dot: "bg-warning" },
  { bar: "border-role-admin/40 bg-role-admin/10 text-role-admin", dot: "bg-role-admin" },
  { bar: "border-destructive/40 bg-destructive/10 text-destructive", dot: "bg-destructive" },
  { bar: "border-border bg-muted/50 text-foreground", dot: "bg-muted-foreground" },
];
