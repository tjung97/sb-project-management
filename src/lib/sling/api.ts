import "server-only";

// Server-side Sling client for Seoul Bowl ops.
//
// Sling has no dashboard API key. You authenticate with a long-lived browser
// token (grabbed from app.getsling.com DevTools) sent as the `Authorization`
// header. We read it from SLING_TOKEN. Because this app has no background
// worker, we fetch on demand and cache an aggregated snapshot in-memory with a
// short TTL; a Refresh action busts the cache. See the testing/ project README
// for the full set of Sling API quirks this client encodes.

const BASE_URL = "https://api.getsling.com/v1";
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

// ---- Public types ----------------------------------------------------------

export type SlotStatus = "done" | "due" | "upcoming" | "missed";
export type ScheduleState = "posted" | "partial" | "missing" | "unknown";
export type StoreOverall = "ok" | "attention" | "alert";
export type ShiftStatus = "published" | "planning" | "other";

export interface SlingMessageView {
  id: string;
  author: string | null;
  avatar: string | null;
  content: string | null;
  images: string[];
  createdAt: string | null;
}

export interface ChecklistSlot {
  key: string;
  label: string;
  status: SlotStatus;
  at: string | null;
  photo: boolean;
}

export interface SlingShiftView {
  /** Sling shift (event) id — used to match change-log entries. */
  id: string;
  day: string; // YYYY-MM-DD (store local)
  weekday: string; // "Mon"
  start: string; // "9:00 AM"
  end: string;
  startMin: number; // minutes since midnight (store local)
  endMin: number; // minutes since midnight; +1440 if the shift runs past midnight
  userId: string | null;
  user: string;
  userAvatar: string | null;
  position: string;
  status: ShiftStatus;
  /** Unpaid breaks on the shift (store-local minutes). Absent/empty when none are set. */
  breaks?: Array<{ startMin: number; endMin: number }>;
}

export interface CoverageGap {
  start: string; // "11a"
  end: string; // "1p"
  startMin: number;
  endMin: number;
}

export interface ScheduleDay {
  date: string;
  weekday: string;
  isToday: boolean;
  shifts: SlingShiftView[];
  /** Uncovered windows within store hours (zero staff scheduled). */
  gaps: CoverageGap[];
  /** True when the day has no shifts at all (vs. a partial hole). */
  empty: boolean;
}

export interface ScheduleWeek {
  range: string | null;
  rangeLabel: string | null;
  days: ScheduleDay[];
  publishedCount: number;
  draftCount: number;
  totalHours: number;
  /** Days that have at least one shift but still leave part of store hours uncovered. */
  uncoveredDayCount: number;
}

export interface StoreSchedule {
  sourceId: string;
  storeName: string;
  locationId: string | null;
  locationName: string | null;
  thisWeek: ScheduleWeek;
  nextWeek: ScheduleWeek;
  state: ScheduleState;
}

export interface StoreMonitor {
  sourceId: string;
  name: string;
  overall: StoreOverall;
  checklist: ChecklistSlot[];
  lastPostAt: string | null;
  lastMessages: SlingMessageView[];
  schedule: {
    state: ScheduleState;
    thisWeekPublished: number;
    nextWeekPublished: number;
    nextWeekDraft: number;
    nextWeekRangeLabel: string | null;
    coverageGapDays: number; // this-week days with an uncovered window
    coverageGaps: Array<{ weekday: string; ranges: string[] }>; // detail per uncovered day
  };
}

export interface SlingMonitor {
  configured: boolean;
  computedAt: string;
  error: string | null;
  stores: StoreMonitor[];
  summary: {
    total: number;
    ok: number;
    attention: number;
    alert: number;
    missedTasks: number;
    schedulesPosted: number;
    schedulesMissing: number;
    coverageGaps: number; // total this-week days with an uncovered window
  };
}

export interface SlingScheduleBoard {
  configured: boolean;
  computedAt: string;
  error: string | null;
  thisWeekRangeLabel: string | null;
  nextWeekRangeLabel: string | null;
  businessHoursLabel: string;
  stores: StoreSchedule[];
}

// ---- Config ----------------------------------------------------------------

interface SlingSource {
  type: "channel" | "conversation";
  id: string;
}

interface SlingConfig {
  token: string;
  sources: SlingSource[];
  timezone: string;
  openMin: number;
  closeMin: number;
  hoursLabel: string;
}

function getSlingConfig(): SlingConfig | null {
  const token = (process.env.SLING_TOKEN ?? "").trim();
  const sources = parseSources(process.env.SLING_SOURCES);
  if (!token || sources.length === 0) return null;
  // Store operating hours used to detect uncovered windows. Override per
  // deployment with STORE_OPEN_TIME / STORE_CLOSE_TIME ("HH:MM").
  const openMin = parseHm(process.env.STORE_OPEN_TIME, 11 * 60);
  const closeMin = parseHm(process.env.STORE_CLOSE_TIME, 21 * 60);
  return {
    token,
    sources,
    timezone: process.env.STORE_TIMEZONE ?? "America/Los_Angeles",
    openMin,
    closeMin,
    hoursLabel: `${formatMinLabel(openMin)}–${formatMinLabel(closeMin)}`,
  };
}

function parseHm(value: string | undefined, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseSources(raw: string | undefined): SlingSource[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((pair) => {
      const [type, id] = pair.split(":").map((part) => part.trim());
      if ((type !== "channel" && type !== "conversation") || !id) return [];
      return [{ type, id } as SlingSource];
    });
}

// ---- Daily checklist expectations (store-local times) -----------------------

interface Expectation {
  key: string;
  label: string;
  start: string; // "HH:MM"
  end: string;
  photo?: boolean;
}

const EXPECTATIONS: Expectation[] = [
  { key: "open", label: "Opening", start: "05:00", end: "13:00", photo: true },
  { key: "temp_am", label: "Temp 11a", start: "08:30", end: "14:00" },
  { key: "meat", label: "Meat", start: "11:00", end: "17:00", photo: true },
  { key: "temp_pm", label: "Temp 3p", start: "13:00", end: "18:00" },
  { key: "temp_eve", label: "Temp 7p", start: "16:00", end: "22:00" },
  { key: "close", label: "Closing", start: "18:00", end: "23:59", photo: true },
];

// ---- HTTP client -----------------------------------------------------------

class SlingAuthError extends Error {}

async function slingGet(config: SlingConfig, path: string, query: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, { headers: { Authorization: config.token } });
  if (response.status === 401) {
    throw new SlingAuthError("Sling token was rejected (401). Paste a fresh browser token into SLING_TOKEN.");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Sling GET ${path} failed (${response.status}): ${body.slice(0, 160)}`);
  }
  return response.json();
}

// ---- Snapshot (one aggregated fetch, cached) -------------------------------

interface SlingSnapshot {
  computedAt: string;
  timezone: string;
  error: string | null;
  sources: Array<{ id: string; name: string }>;
  messagesBySource: Record<string, SlingMessageView[]>;
  locations: Record<string, string>;
  positions: Record<string, string>;
  users: Record<string, string>;
  userAvatars: Record<string, string>;
  thisWeekRange: string;
  nextWeekRange: string;
  shiftsThisWeek: Record<string, SlingShiftView[]>;
  shiftsNextWeek: Record<string, SlingShiftView[]>;
}

let snapshotCache: { at: number; data: SlingSnapshot } | null = null;

async function loadSnapshot(config: SlingConfig, force: boolean, now: Date): Promise<SlingSnapshot> {
  if (!force && snapshotCache && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return snapshotCache.data;
  }
  const data = await fetchSnapshot(config, now);
  snapshotCache = { at: Date.now(), data };
  return data;
}

async function fetchSnapshot(config: SlingConfig, now: Date): Promise<SlingSnapshot> {
  const base: SlingSnapshot = {
    computedAt: new Date().toISOString(),
    timezone: config.timezone,
    error: null,
    sources: [],
    messagesBySource: {},
    locations: {},
    positions: {},
    users: {},
    userAvatars: {},
    thisWeekRange: "",
    nextWeekRange: "",
    shiftsThisWeek: {},
    shiftsNextWeek: {},
  };

  try {
    // Names for each configured conversation.
    const nameMap = await buildNameMap(config);
    base.sources = config.sources.map((source) => ({ id: source.id, name: nameMap.get(source.id) ?? source.id }));

    // Messages per source (recent page).
    await Promise.all(
      config.sources.map(async (source) => {
        try {
          const payload =
            source.type === "channel"
              ? await slingGet(config, `/channels/${source.id}/articles`, { pagesize: "60" })
              : await slingGet(config, `/conversations/${source.id}/messages`, { pagesize: "60" });
          base.messagesBySource[source.id] = extractItems(payload)
            .filter((item) => !asRecord(item).deleted)
            .map(toMessageView);
        } catch {
          base.messagesBySource[source.id] = [];
        }
      })
    );

    // Schedule context: org/user, groups, users, and both weeks of shifts.
    const session = asRecord(await slingGet(config, "/account/session"));
    const orgId = String(asRecord(session.org).id ?? "");
    const userId = String(asRecord(session.user).id ?? "");

    const groups = extractItems(await slingGet(config, "/groups"));
    for (const group of groups) {
      const record = asRecord(group);
      const id = record.id != null ? String(record.id) : null;
      const name = typeof record.name === "string" ? record.name : null;
      if (!id || !name) continue;
      if (record.type === "location") base.locations[id] = name;
      if (record.type === "position") base.positions[id] = name;
    }

    const concise = await slingGet(config, "/users/concise");
    const userList = Array.isArray(concise) ? concise : extractItems(asRecord(concise).users);
    for (const user of userList) {
      const record = asRecord(user);
      const name = userName(record);
      if (record.id != null && name) {
        const id = String(record.id);
        base.users[id] = name;
        const avatar = str(record.avatar) || str(record.photo);
        if (avatar) base.userAvatars[id] = avatar;
      }
    }

    const thisMonday = mondayOf(now);
    const nextMonday = new Date(thisMonday.getTime() + 7 * 864e5);
    base.thisWeekRange = weekRange(thisMonday);
    base.nextWeekRange = weekRange(nextMonday);

    if (orgId && userId) {
      const [thisEvents, nextEvents] = await Promise.all([
        slingGet(config, `/calendar/${orgId}/users/${userId}`, { dates: base.thisWeekRange, eventTypes: "shift" }),
        slingGet(config, `/calendar/${orgId}/users/${userId}`, { dates: base.nextWeekRange, eventTypes: "shift" }),
      ]);
      base.shiftsThisWeek = groupShifts(extractItems(thisEvents), base, config.timezone);
      base.shiftsNextWeek = groupShifts(extractItems(nextEvents), base, config.timezone);
    }

    return base;
  } catch (error) {
    base.error =
      error instanceof SlingAuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Sling data could not be loaded.";
    return base;
  }
}

async function buildNameMap(config: SlingConfig): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const add = (items: unknown[]) => {
    for (const item of items) {
      const record = asRecord(item);
      if (record.id != null && typeof record.name === "string") map.set(String(record.id), record.name);
    }
  };
  try {
    add(extractItems(await slingGet(config, "/conversations")));
  } catch {
    /* ignore */
  }
  try {
    add(extractItems(await slingGet(config, "/channels/all")));
  } catch {
    /* ignore */
  }
  return map;
}

// Unpaid breaks explicitly set on a shift, in store-local minutes. Paid breaks
// (if flagged) don't reduce paid coverage, so they're skipped. Defensive about
// field shape — Sling only returns these when a break is on the shift.
function parseShiftBreaks(record: Record<string, unknown>, timezone: string): Array<{ startMin: number; endMin: number }> {
  const raw = record.breaks;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ startMin: number; endMin: number }> = [];
  for (const b of raw) {
    const br = asRecord(b);
    if (br.paid === true || br.isPaid === true) continue;
    if (br.dtstart == null || br.dtend == null) continue;
    const s = tzParts(String(br.dtstart), timezone);
    const e = tzParts(String(br.dtend), timezone);
    const endMin = e.min <= s.min ? e.min + 1440 : e.min;
    if (endMin > s.min) out.push({ startMin: s.min, endMin });
  }
  return out;
}

function groupShifts(events: unknown[], snapshot: SlingSnapshot, timezone: string): Record<string, SlingShiftView[]> {
  const byLoc: Record<string, SlingShiftView[]> = {};
  for (const event of events) {
    const record = asRecord(event);
    const locId = asRecord(record.location).id;
    if (record.type !== "shift" || locId == null) continue;
    const status = shiftStatus(record.status);
    const start = tzParts(String(record.dtstart), timezone);
    const end = tzParts(String(record.dtend), timezone);
    const endMin = end.min <= start.min ? end.min + 1440 : end.min; // overnight
    const key = String(locId);
    (byLoc[key] ??= []).push({
      id: String(record.id ?? ""),
      day: start.ymd,
      weekday: start.weekday,
      start: start.time,
      end: end.time,
      startMin: start.min,
      endMin,
      userId: asRecord(record.user).id != null ? String(asRecord(record.user).id) : null,
      user: snapshot.users[String(asRecord(record.user).id)] ?? "Open shift",
      userAvatar: snapshot.userAvatars[String(asRecord(record.user).id)] ?? null,
      position: snapshot.positions[String(asRecord(record.position).id)] ?? "",
      status,
      breaks: parseShiftBreaks(record, timezone),
    });
  }
  for (const arr of Object.values(byLoc)) {
    arr.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.startMin - b.startMin));
  }
  return byLoc;
}

// ---- Public API ------------------------------------------------------------

export async function getSlingMonitor(options: { force?: boolean; now?: Date } = {}): Promise<SlingMonitor> {
  const now = options.now ?? new Date();
  const config = getSlingConfig();
  if (!config) {
    return {
      configured: false,
      computedAt: now.toISOString(),
      error: "Add SLING_TOKEN and SLING_SOURCES to enable Sling monitoring.",
      stores: [],
      summary: { total: 0, ok: 0, attention: 0, alert: 0, missedTasks: 0, schedulesPosted: 0, schedulesMissing: 0, coverageGaps: 0 },
    };
  }

  const snapshot = await loadSnapshot(config, options.force ?? false, now);
  const todayYmd = localYmd(now, snapshot.timezone);

  const stores: StoreMonitor[] = snapshot.sources.map((source) => {
    const messages = snapshot.messagesBySource[source.id] ?? [];
    const checklist = computeChecklist(messages, snapshot.timezone, now);
    const locId = resolveLocationId(source.name, snapshot.locations);
    const thisShifts = locId ? snapshot.shiftsThisWeek[locId] ?? [] : [];
    const nextShifts = locId ? snapshot.shiftsNextWeek[locId] ?? [] : [];
    const thisPublished = thisShifts.filter((s) => s.status === "published").length;
    const nextPublished = nextShifts.filter((s) => s.status === "published").length;
    const nextDraft = nextShifts.filter((s) => s.status !== "published").length;
    const state = scheduleState(locId, thisPublished, nextPublished);
    const thisWeek = buildWeek(snapshot.thisWeekRange, thisShifts, todayYmd, snapshot.timezone, config.openMin, config.closeMin);
    const coverageGaps = thisWeek.days
      .filter((d) => !d.empty && d.gaps.length > 0)
      .map((d) => ({ weekday: d.weekday, ranges: d.gaps.map((g) => `${g.start}–${g.end}`) }));
    const coverageGapDays = coverageGaps.length;

    const missed = checklist.some((c) => c.status === "missed");
    const due = checklist.some((c) => c.status === "due");
    const overall: StoreOverall =
      missed || state === "missing" || coverageGapDays > 0 ? "alert" : due || state === "partial" ? "attention" : "ok";

    return {
      sourceId: source.id,
      name: source.name,
      overall,
      checklist,
      lastPostAt: messages[0]?.createdAt ?? null,
      lastMessages: messages.slice(0, 6),
      schedule: {
        state,
        thisWeekPublished: thisPublished,
        nextWeekPublished: nextPublished,
        nextWeekDraft: nextDraft,
        nextWeekRangeLabel: rangeLabel(snapshot.nextWeekRange),
        coverageGapDays,
        coverageGaps,
      },
    };
  });

  return {
    configured: true,
    computedAt: snapshot.computedAt,
    error: snapshot.error,
    stores,
    summary: {
      total: stores.length,
      ok: stores.filter((s) => s.overall === "ok").length,
      attention: stores.filter((s) => s.overall === "attention").length,
      alert: stores.filter((s) => s.overall === "alert").length,
      missedTasks: stores.reduce((n, s) => n + s.checklist.filter((c) => c.status === "missed").length, 0),
      schedulesPosted: stores.filter((s) => s.schedule.state === "posted").length,
      schedulesMissing: stores.filter((s) => s.schedule.state === "missing" || s.schedule.state === "partial").length,
      coverageGaps: stores.reduce((n, s) => n + s.schedule.coverageGapDays, 0),
    },
  };
}

export async function getSlingScheduleBoard(options: { force?: boolean; now?: Date } = {}): Promise<SlingScheduleBoard> {
  const now = options.now ?? new Date();
  const config = getSlingConfig();
  if (!config) {
    return {
      configured: false,
      computedAt: now.toISOString(),
      error: "Add SLING_TOKEN and SLING_SOURCES to enable Sling schedules.",
      thisWeekRangeLabel: null,
      nextWeekRangeLabel: null,
      businessHoursLabel: "",
      stores: [],
    };
  }

  const snapshot = await loadSnapshot(config, options.force ?? false, now);
  const todayYmd = localYmd(now, snapshot.timezone);

  const stores: StoreSchedule[] = snapshot.sources.map((source) => {
    const locId = resolveLocationId(source.name, snapshot.locations);
    const thisWeek = buildWeek(snapshot.thisWeekRange, locId ? snapshot.shiftsThisWeek[locId] ?? [] : [], todayYmd, snapshot.timezone, config.openMin, config.closeMin);
    const nextWeek = buildWeek(snapshot.nextWeekRange, locId ? snapshot.shiftsNextWeek[locId] ?? [] : [], todayYmd, snapshot.timezone, config.openMin, config.closeMin);
    const state = scheduleState(locId, thisWeek.publishedCount, nextWeek.publishedCount);
    return {
      sourceId: source.id,
      storeName: source.name,
      locationId: locId,
      locationName: locId ? snapshot.locations[locId] : null,
      thisWeek,
      nextWeek,
      state,
    };
  });

  return {
    configured: true,
    computedAt: snapshot.computedAt,
    error: snapshot.error,
    thisWeekRangeLabel: rangeLabel(snapshot.thisWeekRange),
    nextWeekRangeLabel: rangeLabel(snapshot.nextWeekRange),
    businessHoursLabel: config.hoursLabel,
    stores,
  };
}

/** Bust the snapshot cache (used by the Refresh action). */
export function clearSlingCache(): void {
  snapshotCache = null;
  for (const clear of extraCacheClearers) clear();
}

const extraCacheClearers: Array<() => void> = [];
/** Let other Sling modules (e.g. the change log) clear their caches on Refresh. */
export function onSlingCacheClear(clear: () => void): void {
  if (!extraCacheClearers.includes(clear)) extraCacheClearers.push(clear);
}

// ---- Schedule context — used by the schedule change log (activity.ts) -------

export interface SlingScheduleContext {
  timezone: string;
  users: Record<string, string>;
  positions: Record<string, string>;
  locations: Record<string, string>;
  /** Our stores and the Sling location each one maps to. */
  stores: Array<{ sourceId: string; storeName: string; locationId: string | null }>;
}

/** Name maps + store→location mapping from the cached snapshot. Null if Sling isn't configured. */
export async function getSlingScheduleContext(): Promise<SlingScheduleContext | null> {
  const config = getSlingConfig();
  if (!config) return null;
  const snapshot = await loadSnapshot(config, false, new Date());
  return {
    timezone: snapshot.timezone,
    users: snapshot.users,
    positions: snapshot.positions,
    locations: snapshot.locations,
    stores: snapshot.sources.map((s) => ({
      sourceId: s.id,
      storeName: s.name,
      locationId: resolveLocationId(s.name, snapshot.locations),
    })),
  };
}

/** Authenticated GET against the Sling API (throws on 401 / non-2xx). */
export async function slingApiGet(path: string, query: Record<string, string> = {}): Promise<unknown> {
  const config = getSlingConfig();
  if (!config) throw new Error("Sling isn't configured (SLING_TOKEN / SLING_SOURCES).");
  return slingGet(config, path, query);
}

// ---- Conversations (list + post) — used by the out-of-stock alert ----------

export interface SlingChat {
  id: string;
  name: string;
}

function slingTokenOrThrow(): string {
  const token = (process.env.SLING_TOKEN ?? "").trim();
  if (!token) throw new SlingAuthError("SLING_TOKEN is not set.");
  return token;
}

/** Every Sling chat the token's user belongs to (store Team chats first). */
export async function listSlingChats(): Promise<SlingChat[]> {
  const payload = await slingGet({ token: slingTokenOrThrow() } as SlingConfig, "/conversations", { pagesize: "500" });
  const chats = extractItems(payload)
    .map(asRecord)
    .filter((c) => c.archived !== true)
    .flatMap((c) => {
      const id = c.id == null ? null : String(c.id);
      return id ? [{ id, name: str(c.name) ?? `Chat ${id}` }] : [];
    });
  const isTeam = (n: string) => /\bteam\b/i.test(n);
  return chats.sort((a, b) => Number(isTeam(b.name)) - Number(isTeam(a.name)) || a.name.localeCompare(b.name));
}

/** Post a plain-text message to a Sling chat as the token's user. */
export async function postSlingMessage(conversationId: string, content: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    headers: { Authorization: slingTokenOrThrow(), "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (response.status === 401) {
    throw new SlingAuthError("Sling token was rejected (401). Paste a fresh browser token into SLING_TOKEN.");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Sling post to chat ${conversationId} failed (${response.status}): ${body.slice(0, 160)}`);
  }
}

// ---- Derivations -----------------------------------------------------------

function buildWeek(
  range: string,
  shifts: SlingShiftView[],
  todayYmd: string,
  timezone: string,
  openMin: number,
  closeMin: number
): ScheduleWeek {
  const days: ScheduleDay[] = [];
  if (range) {
    const [start] = range.split("/");
    for (let i = 0; i < 7; i++) {
      const date = new Date(`${start}T12:00:00`);
      date.setDate(date.getDate() + i);
      const ymd = date.toISOString().slice(0, 10);
      const dayShifts = shifts.filter((s) => s.day === ymd);
      days.push({
        date: ymd,
        weekday: new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date),
        isToday: ymd === todayYmd,
        shifts: dayShifts,
        gaps: computeCoverageGaps(dayShifts, openMin, closeMin),
        empty: dayShifts.length === 0,
      });
    }
  }
  return {
    range: range || null,
    rangeLabel: rangeLabel(range),
    days,
    publishedCount: shifts.filter((s) => s.status === "published").length,
    draftCount: shifts.filter((s) => s.status !== "published").length,
    totalHours: Math.round(shifts.reduce((sum, s) => sum + shiftHours(s), 0)),
    // Count only days that have staff but still leave a hole — an unambiguous
    // staffing gap (fully-empty days may simply be a closed day).
    uncoveredDayCount: days.filter((d) => !d.empty && d.gaps.length > 0).length,
  };
}

// Uncovered windows within store hours: clip shifts to [open, close], merge
// them, and return the parts of the window with zero staff.
function computeCoverageGaps(shifts: SlingShiftView[], openMin: number, closeMin: number): CoverageGap[] {
  const intervals = shifts
    .map((s) => [Math.max(openMin, s.startMin), Math.min(closeMin, s.endMin)] as const)
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);

  const gaps: CoverageGap[] = [];
  let cursor = openMin;
  for (const [a, b] of intervals) {
    if (a > cursor) gaps.push(toGap(cursor, a));
    cursor = Math.max(cursor, b);
    if (cursor >= closeMin) break;
  }
  if (cursor < closeMin) gaps.push(toGap(cursor, closeMin));
  return gaps;
}

function toGap(startMin: number, endMin: number): CoverageGap {
  return { startMin, endMin, start: formatMinLabel(startMin), end: formatMinLabel(endMin) };
}

function computeChecklist(messages: SlingMessageView[], timezone: string, now: Date): ChecklistSlot[] {
  const nowL = localParts(now, timezone);
  const today = messages
    .map((m) => ({ m, p: m.createdAt ? localParts(new Date(m.createdAt), timezone) : null }))
    .filter((x) => x.p && x.p.ymd === nowL.ymd);

  return EXPECTATIONS.map((e) => {
    const start = toMin(e.start);
    const end = toMin(e.end);
    const hit = today.find((x) => x.p!.minutes >= start && x.p!.minutes <= end && (!e.photo || x.m.images.length > 0));
    let status: SlotStatus;
    if (hit) status = "done";
    else if (nowL.minutes < start) status = "upcoming";
    else if (nowL.minutes <= end) status = "due";
    else status = "missed";
    return { key: e.key, label: e.label, status, at: hit?.m.createdAt ?? null, photo: Boolean(e.photo) };
  });
}

function resolveLocationId(storeName: string, locations: Record<string, string>): string | null {
  const needle = storeName.toLowerCase();
  let best: { id: string; len: number } | null = null;
  for (const [id, name] of Object.entries(locations)) {
    const ln = name.toLowerCase();
    if (needle.includes(ln) && (!best || ln.length > best.len)) best = { id, len: ln.length };
  }
  return best?.id ?? null;
}

function scheduleState(locId: string | null, thisPublished: number, nextPublished: number): ScheduleState {
  if (!locId) return "unknown";
  if (thisPublished > 0 && nextPublished >= thisPublished * 0.6) return "posted";
  if (nextPublished === 0) return "missing";
  if (nextPublished >= 10) return "posted";
  return "partial";
}

// ---- Small helpers ---------------------------------------------------------

function toMessageView(item: unknown): SlingMessageView {
  const record = asRecord(item);
  const author = asRecord(record.author ?? record.user);
  const name =
    str(author.preferredName) ||
    [str(author.name), str(author.lastname)].filter(Boolean).join(" ") ||
    str(author.legalName) ||
    null;
  const attachments = extractItems(record.attachments);
  const images = attachments
    .map((att) => {
      const a = asRecord(att);
      const mimetype = str(a.mimetype);
      if (mimetype && !mimetype.startsWith("image/")) return null;
      return str(a.url) || str(a.image);
    })
    .filter((url): url is string => Boolean(url));

  return {
    id: String(record.id ?? cryptoRandom()),
    author: name,
    avatar: str(asRecord(record.author).avatar) || str(author.avatar),
    content: str(record.content) || str(record.title),
    images,
    createdAt: str(record.timestamp) || str(record.createdAt),
  };
}

export function shiftStatus(value: unknown): ShiftStatus {
  if (value === "published") return "published";
  if (value === "planning") return "planning";
  return "other";
}

function shiftHours(shift: SlingShiftView): number {
  return Math.max(0, shift.endMin - shift.startMin) / 60;
}

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  m.setHours(12, 0, 0, 0);
  return m;
}

function weekRange(monday: Date): string {
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  return `${ymd(monday)}/${ymd(new Date(monday.getTime() + 6 * 864e5))}`;
}

function rangeLabel(range: string): string | null {
  if (!range) return null;
  const [start, end] = range.split("/");
  if (!start || !end) return null;
  const fmt = (ymd: string) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${ymd}T12:00:00`));
  return `${fmt(start)} – ${fmt(end)}`;
}

function localParts(d: Date, tz: string): { ymd: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  let hh = get("hour");
  if (hh === "24") hh = "00";
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(hh) * 60 + Number(get("minute")) };
}

function localYmd(d: Date, tz: string): string {
  return localParts(d, tz).ymd;
}

export function tzParts(iso: string, tz: string): { ymd: string; weekday: string; time: string; min: number } {
  const d = new Date(iso);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { ymd, weekday, time, min: g("hour") * 60 + g("minute") };
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function formatMinLabel(min: number): string {
  const h = ((Math.floor(min / 60) % 24) + 24) % 24;
  const m = min % 60;
  const suffix = h < 12 ? "a" : "p";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

export function userName(record: Record<string, unknown>): string | null {
  const first = str(record.name)?.trim() ?? "";
  const last = str(record.lastname)?.trim() ?? "";
  // Some profiles already include the last name in `name` ("Maksim Maksimov" + "Maksimov").
  const full = first && last && first.toLowerCase().endsWith(last.toLowerCase()) ? first : [first, last].filter(Boolean).join(" ");
  return str(record.preferredName) || full || str(record.legalName) || null;
}

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of ["items", "messages", "articles", "users", "data"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function cryptoRandom(): string {
  return Math.random().toString(36).slice(2);
}
