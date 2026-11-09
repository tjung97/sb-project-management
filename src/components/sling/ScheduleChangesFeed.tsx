"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, ChevronDown, History, Loader2 } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { MARK_BADGE } from "@/src/components/sling/ShiftHistorySheet";
import { cn } from "@/src/lib/utils";
import { loadOlderChanges } from "@/src/lib/sling/schedule-actions";
import {
  KIND_META,
  MARK_STYLE,
  changeLabel,
  clockTime,
  dayHeading,
  localDay,
  relativeTime,
  shiftLine,
  type ChangeShift,
  type MarkKind,
  type ScheduleChange,
} from "@/src/lib/sling/schedule-change-format";
import type { OpenShift } from "@/src/components/sling/ScheduleBoard";

type KindFilter = "all" | MarkKind;
const ALL = "__any__";

const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "edited", label: "Edited" },
  { key: "published", label: "Published" },
  { key: "deleted", label: "Deleted" },
];

export function toOpenShift(s: ChangeShift, deleted = false): OpenShift {
  return {
    id: s.id,
    dayLabel: s.dayLabel,
    timeLabel: s.timeLabel,
    userName: s.userName,
    position: s.position,
    storeName: s.storeName,
    status: deleted ? "Deleted" : s.status === "published" ? "Published" : "Draft",
    deleted,
  };
}

// "Changes" tab: every Sling schedule action, newest first, grouped by day.
export function ScheduleChangesFeed({
  initialChanges,
  initialNextBefore,
  error,
  baseline,
  weekDays,
  onOpenShift,
}: {
  initialChanges: ScheduleChange[];
  initialNextBefore: string | null;
  error: string | null;
  /** Changes after this (ms) are highlighted as new. */
  baseline: number;
  /** Days (YYYY-MM-DD) of this + next week, for the "only this & next week" filter. */
  weekDays: string[];
  onOpenShift: (shift: OpenShift) => void;
}) {
  const [changes, setChanges] = useState(initialChanges);
  const [nextBefore, setNextBefore] = useState(initialNextBefore);
  const [olderError, setOlderError] = useState<string | null>(null);
  const [loadingOlder, startOlder] = useTransition();

  const [kind, setKind] = useState<KindFilter>("all");
  const [store, setStore] = useState(ALL);
  const [actor, setActor] = useState(ALL);
  const [weeksOnly, setWeeksOnly] = useState(false);

  const stores = useMemo(
    () => [...new Set(changes.flatMap((c) => c.shifts.map((s) => s.storeName)).filter(Boolean) as string[])].sort(),
    [changes]
  );
  const actors = useMemo(() => [...new Set(changes.map((c) => c.actor?.name).filter(Boolean) as string[])].sort(), [changes]);
  const weekSet = useMemo(() => new Set(weekDays), [weekDays]);

  // Everything except the kind filter (so the kind toggles can show counts).
  const scoped = useMemo(
    () =>
      changes.filter(
        (c) =>
          (store === ALL || c.shifts.some((s) => s.storeName === store)) &&
          (actor === ALL || c.actor?.name === actor) &&
          (!weeksOnly || c.shifts.some((s) => weekSet.has(s.day)))
      ),
    [changes, store, actor, weeksOnly, weekSet]
  );
  const counts = useMemo(() => {
    const out: Record<KindFilter, number> = { all: scoped.length, new: 0, edited: 0, published: 0, deleted: 0 };
    for (const c of scoped) {
      const m = KIND_META[c.kind]?.mark;
      if (m) out[m]++;
    }
    return out;
  }, [scoped]);
  const visible = useMemo(() => (kind === "all" ? scoped : scoped.filter((c) => KIND_META[c.kind]?.mark === kind)), [scoped, kind]);
  const groups = useMemo(() => {
    const out: { day: string; items: ScheduleChange[] }[] = [];
    for (const c of visible) {
      const day = localDay(c.at);
      const last = out.at(-1);
      if (last && last.day === day) last.items.push(c);
      else out.push({ day, items: [c] });
    }
    return out;
  }, [visible]);
  const unseen = scoped.filter((c) => Date.parse(c.at) > baseline).length;
  const filtered = store !== ALL || actor !== ALL || weeksOnly || kind !== "all";

  function loadOlder() {
    if (!nextBefore) return;
    setOlderError(null);
    startOlder(async () => {
      try {
        const res = await loadOlderChanges(nextBefore);
        if (res.error) setOlderError(res.error);
        setChanges((cur) => {
          const seen = new Set(cur.map((c) => c.id));
          return [...cur, ...res.changes.filter((c) => !seen.has(c.id))];
        });
        setNextBefore(res.nextBefore);
      } catch (e) {
        setOlderError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  if (error) {
    return (
      <Card className="border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning-foreground">
        Couldn&apos;t load schedule changes from Sling: {error}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* filters */}
      <Card className="flex flex-wrap items-center gap-2 p-2">
        <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as KindFilter)} aria-label="Change type">
          {KIND_FILTERS.map((f) => (
            <ToggleGroupItem key={f.key} value={f.key}>
              {f.key !== "all" ? <span className={cn("h-2 w-2 rounded-full", MARK_STYLE[f.key].dot)} /> : null}
              {f.label}
              <span className="tabular-nums text-muted-foreground">{counts[f.key]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select value={store} onValueChange={setStore}>
          <SelectTrigger className="h-9 w-[180px] text-xs" aria-label="Filter by store">
            <SelectValue placeholder="All stores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All stores</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger className="h-9 w-[170px] text-xs" aria-label="Filter by who made the change">
            <SelectValue placeholder="Anyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Changed by anyone</SelectItem>
            {actors.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-muted-foreground">
          <Checkbox checked={weeksOnly} onCheckedChange={(v) => setWeeksOnly(v === true)} />
          This &amp; next week only
        </label>

        <div className="ml-auto flex items-center gap-2">
          {filtered ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setKind("all");
                setStore(ALL);
                setActor(ALL);
                setWeeksOnly(false);
              }}
            >
              Clear filters
            </Button>
          ) : null}
          {unseen ? <Badge variant="info">{unseen} new since your last visit</Badge> : null}
        </div>
      </Card>

      {/* feed */}
      {groups.length ? (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.day} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{dayHeading(g.day)}</h3>
                <span className="text-[11px] text-muted-foreground/70">
                  {g.items.length} change{g.items.length === 1 ? "" : "s"}
                </span>
              </div>
              <Card className="divide-y divide-border/60 overflow-hidden p-0">
                {g.items.map((c) => (
                  <ChangeRow key={c.id} change={c} unseen={Date.parse(c.at) > baseline} onOpenShift={onOpenShift} />
                ))}
              </Card>
            </section>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
          <History className="h-5 w-5" />
          No schedule changes match these filters.
        </Card>
      )}

      {olderError ? <p className="text-xs text-destructive">{olderError}</p> : null}
      {nextBefore ? (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
            Load older changes
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ChangeRow({
  change,
  unseen,
  onOpenShift,
}: {
  change: ScheduleChange;
  unseen: boolean;
  onOpenShift: (shift: OpenShift) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const mark = KIND_META[change.kind]?.mark;
  const deleted = change.kind === "deleted";
  const single = change.shifts.length === 1 ? change.shifts[0] : null;
  const verb = change.kind === "other" ? (change.note ?? "updated") : KIND_META[change.kind].verb;

  return (
    <div className={cn("relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30", unseen && "bg-info/[0.04]")}>
      {unseen ? <span className="absolute inset-y-0 left-0 w-0.5 bg-info" aria-label="New since your last visit" /> : null}
      <Badge variant={mark ? MARK_BADGE[mark] : "muted"} className="mt-0.5 h-fit w-[78px] shrink-0 justify-center px-1.5 text-[11px]">
        {changeLabel(change)}
      </Badge>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{change.actor?.name ?? "Someone"}</span>{" "}
          <span className="text-muted-foreground">{verb}</span>{" "}
          {single ? (
            <button
              type="button"
              onClick={() => onOpenShift(toOpenShift(single, deleted))}
              className={cn(
                "rounded-sm text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/45",
                deleted && "line-through decoration-destructive/60"
              )}
            >
              {shiftLine(single)}
            </button>
          ) : (
            <span className="font-medium">
              {change.shifts.length} shift{change.shifts.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
        {change.kind !== "other" && change.note ? <p className="text-xs text-muted-foreground">{change.note}</p> : null}
        {change.fields.length ? (
          <div className="flex flex-wrap gap-1.5">
            {change.fields.map((f) => (
              <span
                key={f.field}
                className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[11px]"
              >
                <span className="capitalize text-muted-foreground">{f.label}</span>
                {f.from || f.to ? (
                  <>
                    {f.from ? <span className="text-muted-foreground line-through decoration-muted-foreground/50">{f.from}</span> : null}
                    {f.from ? <ArrowRight className="h-3 w-3 text-muted-foreground" /> : null}
                    <span className="font-medium">{f.to}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">changed</span>
                )}
              </span>
            ))}
          </div>
        ) : null}
        {!single && change.shifts.length ? (
          <div>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setExpanded((e) => !e)}>
              {expanded ? "Hide shifts" : `Show ${change.shifts.length} shifts`}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </Button>
            {expanded ? (
              <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                {change.shifts.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenShift(toOpenShift(s, deleted))}
                      className="text-left text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {shiftLine(s)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-xs font-medium tabular-nums">{clockTime(change.at)}</p>
        <p className="text-[11px] text-muted-foreground">{relativeTime(change.at)}</p>
      </div>
    </div>
  );
}
