// Shared (client-safe) types + plain-English helpers for the Sling schedule
// change log. The server (activity.ts) resolves ids → names and formats
// times; these helpers only compose display strings.

export type ChangeKind = "created" | "changed" | "published" | "created_and_published" | "unpublished" | "deleted" | "other";

export interface ChangeShift {
  id: string;
  /** Store-local YYYY-MM-DD. */
  day: string;
  /** "Tue 11/10" */
  dayLabel: string;
  /** "5–9:30p" */
  timeLabel: string;
  userId: string | null;
  userName: string;
  position: string;
  locationId: string | null;
  storeSourceId: string | null;
  storeName: string | null;
  status: "published" | "planning" | "other";
}

export interface FieldChange {
  field: string;
  /** "time", "person", "break" … */
  label: string;
  from: string;
  to: string;
}

export interface ScheduleChange {
  id: string;
  /** ISO timestamp of the action. */
  at: string;
  kind: ChangeKind;
  /** Extra context, e.g. "employee deactivated". */
  note: string | null;
  actor: { id: string; name: string } | null;
  shifts: ChangeShift[];
  fields: FieldChange[];
}

export interface ScheduleChangesResult {
  changes: ScheduleChange[];
  /** Cursor for "Load older" (Sling's `before`), null when there's nothing older. */
  nextBefore: string | null;
  error: string | null;
}

/** How a shift is marked on the grid. */
export type MarkKind = "new" | "edited" | "published" | "deleted";

export const KIND_META: Record<ChangeKind, { label: string; verb: string; mark: MarkKind | null }> = {
  created: { label: "New", verb: "created", mark: "new" },
  created_and_published: { label: "New", verb: "created and published", mark: "new" },
  changed: { label: "Edited", verb: "edited", mark: "edited" },
  published: { label: "Published", verb: "published", mark: "published" },
  unpublished: { label: "Unpublished", verb: "unpublished", mark: "edited" },
  deleted: { label: "Deleted", verb: "deleted", mark: "deleted" },
  other: { label: "Updated", verb: "updated", mark: "edited" },
};

/** Tailwind classes per mark (dot, pill, border). */
export const MARK_STYLE: Record<MarkKind, { dot: string; pill: string; label: string }> = {
  new: { dot: "bg-info", pill: "bg-info/15 text-info", label: "New" },
  edited: { dot: "bg-warning", pill: "bg-warning/20 text-warning-foreground", label: "Edited" },
  published: { dot: "bg-success", pill: "bg-success/15 text-success", label: "Published" },
  deleted: { dot: "bg-destructive", pill: "bg-destructive/15 text-destructive", label: "Deleted" },
};

export function markFor(kind: ChangeKind): MarkKind | null {
  return KIND_META[kind]?.mark ?? null;
}

/** Strongest mark among several changes to one shift (new > deleted > edited > published). */
export function strongestMark(kinds: ChangeKind[]): MarkKind | null {
  const marks = new Set(kinds.map(markFor).filter(Boolean) as MarkKind[]);
  for (const m of ["deleted", "new", "edited", "published"] as MarkKind[]) if (marks.has(m)) return m;
  return null;
}

export function fieldLine(f: FieldChange): string {
  if (!f.from && !f.to) return `${f.label} changed`;
  if (!f.from) return `${f.label}: ${f.to}`;
  return `${f.label}: ${f.from} → ${f.to}`;
}

export function actorName(change: ScheduleChange): string {
  return change.actor?.name ?? "Someone";
}

/** "Edited by Noah DeVito · 2h ago — time: 5–9:30p → 5–10p" */
export function changeSummary(change: ScheduleChange, now = Date.now()): string {
  const head = `${changeLabel(change)} by ${actorName(change)} · ${relativeTime(change.at, now)}`;
  const note = change.kind === "other" ? null : change.note;
  const details = [note, ...change.fields.map(fieldLine)].filter(Boolean).join("; ");
  return details ? `${head} — ${details}` : head;
}

/** "Edited", "Deleted", or for other actions their own wording ("Offered for swap"). */
export function changeLabel(change: ScheduleChange): string {
  if (change.kind === "other" && change.note) return change.note[0].toUpperCase() + change.note.slice(1);
  return (KIND_META[change.kind] ?? KIND_META.other).label;
}

export function shiftLine(s: ChangeShift): string {
  return [s.dayLabel, s.timeLabel, s.userName, s.storeName].filter(Boolean).join(" · ");
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

const TZ = "America/Los_Angeles";

export function exactTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function clockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** Store-local YYYY-MM-DD of a timestamp. */
export function localDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso)
  );
}

/** "Today" / "Yesterday" / "Sat, Nov 8" */
export function dayHeading(ymd: string, now = Date.now()): string {
  const today = localDay(new Date(now).toISOString());
  const yesterday = localDay(new Date(now - 864e5).toISOString());
  if (ymd === today) return "Today";
  if (ymd === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${ymd}T12:00:00`)
  );
}
