import "server-only";

import {
  asRecord,
  getSlingScheduleContext,
  onSlingCacheClear,
  shiftStatus,
  slingApiGet,
  str,
  tzParts,
  userName,
  type SlingScheduleContext,
} from "@/src/lib/sling/api";
import type {
  ChangeKind,
  ChangeShift,
  FieldChange,
  ScheduleChange,
  ScheduleChangesResult,
} from "@/src/lib/sling/schedule-change-format";

// Sling schedule change log.
//
// Sling's web app reads two undocumented endpoints that our browser token can
// also read:
//   GET /activity/logs?pagesize=200[&before=<id>]  company-wide feed, newest first
//   GET /calendar/{shiftId}/logs                    one shift's full history
// Entries look like { type, created_at|posted, actor|user, items[] (shifts as
// they were right after the action), data: { field: { from, to } } }.
// Everything here is read-only and parsed defensively.

const PAGE_SIZE = 200;
const MAX_PAGES = 10;
const CACHE_TTL_MS = 2 * 60 * 1000;

let cache: { at: number; sinceMs: number; data: ScheduleChangesResult } | null = null;
onSlingCacheClear(() => {
  cache = null;
});

/** Changes since `since` (newest first). With `before`, returns one older page instead. */
export async function getScheduleChanges(options: { since: Date; before?: string | null }): Promise<ScheduleChangesResult> {
  const sinceMs = options.since.getTime();
  if (!options.before && cache && Date.now() - cache.at < CACHE_TTL_MS && cache.sinceMs <= sinceMs) {
    return { ...cache.data, changes: cache.data.changes.filter((c) => Date.parse(c.at) >= sinceMs) };
  }

  let ctx: SlingScheduleContext | null;
  try {
    ctx = await getSlingScheduleContext();
  } catch (e) {
    return { changes: [], nextBefore: null, error: message(e) };
  }
  if (!ctx) return { changes: [], nextBefore: null, error: "Sling isn't configured." };

  const raw: unknown[] = [];
  let before = options.before ?? null;
  let nextBefore: string | null = null;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const query: Record<string, string> = { pagesize: String(PAGE_SIZE) };
      if (before) query.before = before;
      const res = await slingApiGet("/activity/logs", query);
      const items = Array.isArray(res) ? res : [];
      raw.push(...items);
      const last = asRecord(items.at(-1));
      nextBefore = items.length === PAGE_SIZE && last.id != null ? String(last.id) : null;
      if (!nextBefore) break;
      before = nextBefore;
      if (options.before) break; // "Load older": one page at a time
      const lastAt = Date.parse(String(last.created_at ?? ""));
      if (Number.isFinite(lastAt) && lastAt < sinceMs) break;
    }
  } catch (e) {
    return { changes: [], nextBefore: null, error: message(e) };
  }

  const changes = raw
    .map((entry) => normalize(entry, ctx))
    .filter((c): c is ScheduleChange => c !== null)
    .filter((c) => options.before || Date.parse(c.at) >= sinceMs);
  const data = { changes, nextBefore, error: null };
  if (!options.before) cache = { at: Date.now(), sinceMs, data };
  return data;
}

/** One shift's full history, oldest first. */
export async function getShiftHistory(shiftId: string): Promise<{ entries: ScheduleChange[]; error: string | null }> {
  if (!/^\d{1,20}$/.test(shiftId)) return { entries: [], error: "Invalid shift id." };
  try {
    const ctx = await getSlingScheduleContext();
    if (!ctx) return { entries: [], error: "Sling isn't configured." };
    const res = await slingApiGet(`/calendar/${shiftId}/logs`);
    const entries = (Array.isArray(res) ? res : [])
      .map((entry) => normalize(entry, ctx))
      .filter((c): c is ScheduleChange => c !== null)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return { entries, error: null };
  } catch (e) {
    return { entries: [], error: message(e) };
  }
}

// ---- normalizing -----------------------------------------------------------

function normalize(entry: unknown, ctx: SlingScheduleContext): ScheduleChange | null {
  const e = asRecord(entry);
  const at = str(e.created_at) ?? str(e.posted);
  if (e.id == null || !at) return null;
  if (e.log_type != null && e.log_type !== "event") return null; // only shift/event logs

  const type = String(e.type ?? "");
  const actorRec = asRecord(e.actor ?? e.user);
  const actor =
    actorRec.id != null ? { id: String(actorRec.id), name: ctx.users[String(actorRec.id)] ?? personLabel(actorRec) } : null;
  const items = Array.isArray(e.items) ? e.items : [];
  const shifts = items
    .map((item) => toShift(item, ctx))
    .filter((s): s is ChangeShift => s !== null);

  const data = asRecord(e.data);
  const firstItem = asRecord(items[0]);
  const fields = describeFields(data, firstItem, ctx);

  return {
    id: String(e.id),
    at: new Date(at).toISOString(),
    kind: toKind(type),
    note: noteFor(type),
    actor,
    shifts,
    fields,
  };
}

const TYPE_NOTES: Record<string, string> = {
  cancelled_via_user_deactivate: "employee deactivated",
  made_swappable: "offered for swap",
  swap_accepted: "swap accepted",
  made_available: "made an open shift",
  made_unavailable: "no longer an open shift",
};

/** Extra wording for types that aren't plain create/edit/publish/delete. */
function noteFor(type: string): string | null {
  if (TYPE_NOTES[type]) return TYPE_NOTES[type];
  if (toKind(type) !== "other" || !type) return null;
  return type.replace(/_/g, " ");
}

/** "Maksim Maksimov" + lastname "Maksimov" shouldn't become "Maksim Maksimov Maksimov". */
function personLabel(r: Record<string, unknown>): string {
  const first = (str(r.preferredName) ?? str(r.name) ?? "").trim();
  const last = (str(r.lastname) ?? "").trim();
  if (first && last && first.toLowerCase().endsWith(last.toLowerCase())) return first;
  return [first, last].filter(Boolean).join(" ") || (userName(r) ?? "Unknown");
}

function toKind(type: string): ChangeKind {
  switch (type) {
    case "created":
    case "changed":
    case "published":
    case "created_and_published":
    case "unpublished":
      return type;
    case "cancelled":
    case "deleted":
    case "cancelled_via_user_deactivate":
      return "deleted";
    default:
      return "other";
  }
}

function toShift(item: unknown, ctx: SlingScheduleContext): ChangeShift | null {
  const r = asRecord(item);
  if (r.id == null) return null;
  if (r.type != null && r.type !== "shift") return null;
  const startIso = str(r.dtstart);
  const endIso = str(r.dtend);
  const start = startIso ? tzParts(startIso, ctx.timezone) : null;
  const end = endIso ? tzParts(endIso, ctx.timezone) : null;
  const userId = asRecord(r.user).id != null ? String(asRecord(r.user).id) : null;
  const locationId = asRecord(r.location).id != null ? String(asRecord(r.location).id) : null;
  const store = locationId ? ctx.stores.find((s) => s.locationId === locationId) : undefined;
  return {
    id: String(r.id),
    day: start?.ymd ?? "",
    dayLabel: start ? `${start.weekday} ${start.ymd.slice(5).replace("-", "/")}` : "",
    timeLabel: start && end ? `${compact(start.time)}–${compact(end.time)}` : "",
    userId,
    userName: userId ? (ctx.users[userId] ?? `User ${userId}`) : "Open shift",
    position: ctx.positions[String(asRecord(r.position).id)] ?? "",
    locationId,
    storeSourceId: store?.sourceId ?? null,
    storeName: store?.storeName ?? (locationId ? (ctx.locations[locationId] ?? null) : null),
    status: shiftStatus(r.status),
  };
}

function describeFields(data: Record<string, unknown>, item: Record<string, unknown>, ctx: SlingScheduleContext): FieldChange[] {
  const out: FieldChange[] = [];
  const tz = ctx.timezone;
  const fromTo = (key: string) => {
    const v = asRecord(data[key]);
    return { from: v.from, to: v.to };
  };

  // Start/end together read as one "time" change.
  if (data.dtstart || data.dtend) {
    const s = fromTo("dtstart");
    const en = fromTo("dtend");
    const newStart = str(s.to) ?? str(item.dtstart);
    const newEnd = str(en.to) ?? str(item.dtend);
    const oldStart = str(s.from) ?? newStart;
    const oldEnd = str(en.from) ?? newEnd;
    const fmt = (a: string | null, b: string | null, withDay: boolean) => {
      if (!a || !b) return "";
      const pa = tzParts(a, tz);
      const pb = tzParts(b, tz);
      const day = `${pa.weekday} ${pa.ymd.slice(5).replace("-", "/")} `;
      return `${withDay ? day : ""}${compact(pa.time)}–${compact(pb.time)}`;
    };
    const dayChanged = oldStart && newStart ? tzParts(oldStart, tz).ymd !== tzParts(newStart, tz).ymd : false;
    out.push({ field: "time", label: dayChanged ? "day/time" : "time", from: fmt(oldStart, oldEnd, dayChanged), to: fmt(newStart, newEnd, dayChanged) });
  }

  for (const [key, raw] of Object.entries(data)) {
    if (key === "dtstart" || key === "dtend") continue;
    const v = asRecord(raw);
    switch (key) {
      case "user":
        out.push({ field: key, label: "person", from: personName(v.from, ctx), to: personName(v.to, ctx) });
        break;
      case "position":
        out.push({ field: key, label: "position", from: groupName(v.from, ctx.positions), to: groupName(v.to, ctx.positions) });
        break;
      case "location":
        out.push({ field: key, label: "location", from: groupName(v.from, ctx.locations), to: groupName(v.to, ctx.locations) });
        break;
      case "status":
        out.push({ field: key, label: "status", from: statusLabel(v.from), to: statusLabel(v.to) });
        break;
      case "breakDuration":
        out.push({ field: key, label: "break", from: breakLabel(v.from), to: breakLabel(v.to) });
        break;
      case "available":
        out.push({ field: key, label: "open shift", from: v.from ? "yes" : "no", to: v.to ? "yes" : "no" });
        break;
      case "summary":
      case "assigneeNotes":
        out.push({ field: key, label: "notes", from: quote(v.from), to: quote(v.to) });
        break;
      case "tags":
        out.push({ field: key, label: "tags", from: "", to: "" });
        break;
      case "taskTemplates":
        out.push({ field: key, label: "tasks", from: "", to: "" });
        break;
      default:
        out.push({ field: key, label: key, from: "", to: "" });
    }
  }
  return out;
}

function personName(value: unknown, ctx: SlingScheduleContext): string {
  const r = asRecord(value);
  if (r.id == null) return "Open shift";
  return ctx.users[String(r.id)] ?? personLabel(r);
}

function groupName(value: unknown, map: Record<string, string>): string {
  const r = asRecord(value);
  return r.id == null ? "none" : (map[String(r.id)] ?? str(r.name) ?? `#${r.id}`);
}

function statusLabel(value: unknown): string {
  if (value === "published") return "Published";
  if (value === "planning") return "Draft";
  if (value === "cancelled") return "Deleted";
  return typeof value === "string" ? value : "—";
}

function breakLabel(value: unknown): string {
  const n = Number(value);
  return value == null || !Number.isFinite(n) || n <= 0 ? "none" : `${n}m`;
}

function quote(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? `“${s.length > 60 ? `${s.slice(0, 57)}…` : s}”` : "none";
}

/** "9:00 AM" → "9a", "1:30 PM" → "1:30p" */
function compact(label: string): string {
  const m = label.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return label;
  const minute = m[2] && m[2] !== "00" ? `:${m[2]}` : "";
  return `${m[1]}${minute}${m[3] ? m[3][0].toLowerCase() : ""}`;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
