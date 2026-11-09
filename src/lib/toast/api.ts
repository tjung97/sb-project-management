import { DateTime } from "luxon";

export interface ToastProductMixItem {
  id: string;
  name: string;
  quantity: number;
  netSales: number;
}

export interface ToastItemSalesPoint {
  /** ISO date, YYYY-MM-DD (restaurant timezone business day). */
  date: string;
  quantity: number;
  netSales: number;
}

export interface ToastItemHistory {
  itemName: string;
  days: number;
  points: ToastItemSalesPoint[];
  totalQuantity: number;
  totalNetSales: number;
  error: string | null;
}

export interface ToastStockItem {
  guid: string;
  name: string;
  status: "OUT_OF_STOCK" | "QUANTITY";
  quantity: number | null;
}

export interface ToastOutOfStock {
  configured: boolean;
  computedAt: string;
  items: ToastStockItem[]; // 86'd items that are on the live menu, de-duped
  totalTracked: number; // raw count of out-of-stock records before filtering
  error: string | null;
}

export interface ToastLaborEmployeeStatus {
  id: string;
  name: string;
  job: string;
  status: "working" | "break" | "clocked_out";
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  hours: number;
  regularHours: number;
  overtimeHours: number;
  breakMinutes: number;
}

export interface ToastLocation {
  guid: string;
  name: string;
  ref: string | null;
}

export interface ToastStoreSummary {
  guid: string;
  name: string;
  summary: ToastOpsSummary;
}

export interface ToastStoreStock {
  guid: string;
  name: string;
  stock: ToastOutOfStock;
}

export interface ToastOpsSummary {
  configured: boolean;
  businessDate: string;
  locationName: string | null;
  sales: {
    netSales: number;
    orderCount: number;
    productMix: ToastProductMixItem[];
  };
  labor: {
    activeCount: number;
    breakCount: number;
    clockedOutCount: number;
    laborHours: number;
    laborCost: number;
    employees: ToastLaborEmployeeStatus[];
  };
  error: string | null;
}

const OVERTIME_MULTIPLIER = 1.5;

interface ToastConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  restaurantExternalId: string;
  timezone: string;
}

interface ToastToken {
  accessToken: string;
  tokenType: string;
}

type ToastRecord = Record<string, unknown>;

const DEFAULT_TOAST_BASE_URL = "https://ws-api.toasttab.com";

export async function getToastOpsSummary(restaurantGuid?: string, now = new Date()): Promise<ToastOpsSummary> {
  const base = getToastBaseConfig();
  const businessDate = formatBusinessDate(now, base?.timezone ?? process.env.TOAST_BUSINESS_TIME_ZONE);

  if (!base) {
    return emptySummary({
      configured: false,
      businessDate,
      locationName: null,
      error: "Add Toast API env values to enable live sales and labor.",
    });
  }

  try {
    const locations = await getToastLocations();
    const guid = restaurantGuid ?? (await getPrimaryGuid(locations));
    if (!guid) {
      return emptySummary({ configured: false, businessDate, locationName: null, error: "No Toast locations found." });
    }
    const locationName = locations.find((l) => l.guid === guid)?.name ?? null;
    const config = configForLocation(base, guid);
    const token = await getToastToken(config);
    const [orders, timeEntries, employees] = await Promise.all([
      toastGetAllOrders(config, token, businessDate),
      toastGet<unknown[]>(
        config,
        token,
        `/labor/v1/timeEntries?businessDate=${businessDate}&includeMissedBreaks=true`
      ),
      // The directory is group-wide; we use it ONLY as a GUID -> name lookup.
      // The staff list itself is built from time entries, which the restaurant
      // header already scopes to this store.
      toastGetAllEmployees(config, token).catch(() => []),
    ]);

    return buildSummary({
      configured: true,
      businessDate,
      locationName,
      orders,
      timeEntries: Array.isArray(timeEntries) ? timeEntries : [],
      employees: Array.isArray(employees) ? employees : [],
      error: null,
      now,
    });
  } catch (error) {
    return emptySummary({
      configured: true,
      businessDate,
      locationName: null,
      error: error instanceof Error ? error.message : "Toast data could not be loaded.",
    });
  }
}

// All stores' today summary for the multi-store sidebar. Fetched in parallel and
// cached briefly so navigation (the sidebar renders on every page) stays cheap.
const ALL_SUMMARIES_TTL_MS = 3 * 60 * 1000;
let allSummariesCache: { at: number; clientId: string; data: ToastStoreSummary[] } | null = null;

export function clearToastSummaryCache(): void {
  allSummariesCache = null;
}

export async function getAllToastOpsSummaries(now = new Date()): Promise<ToastStoreSummary[]> {
  const base = getToastBaseConfig();
  if (!base) return [];
  if (allSummariesCache && allSummariesCache.clientId === base.clientId && Date.now() - allSummariesCache.at < ALL_SUMMARIES_TTL_MS) {
    return allSummariesCache.data;
  }
  const locations = await getToastLocations();
  const data = await Promise.all(
    locations.map(async (loc) => ({ guid: loc.guid, name: loc.name, summary: await getToastOpsSummary(loc.guid, now) }))
  );
  allSummariesCache = { at: Date.now(), clientId: base.clientId, data };
  return data;
}

// --- Weekly sales (for the forecast engine) ---------------------------------

export interface ToastDaySales {
  /** Sum of check amounts per hour, index 0..23 (store-local). */
  hours: number[];
  total: number;
}

export interface ToastWeekSales {
  mondayYmd: string;
  /** index 0 = Monday … 6 = Sunday. */
  byWeekday: ToastDaySales[];
  total: number;
  orderCount: number;
}

const WEEK_SALES_TTL_MS = 30 * 60 * 1000;
const weekSalesCache = new Map<string, { at: number; data: ToastWeekSales }>();

// Aggregates one Mon–Sun week of Toast orders into per-weekday hourly
// check-amount totals (the "sales" convention used by labor_cost.py /
// sales_prediction.py). Heavy (paginated order fetch) — cached 30 min.
export async function getToastWeekSales(restaurantGuid: string, mondayYmd: string): Promise<ToastWeekSales | null> {
  const base = getToastBaseConfig();
  if (!base) return null;
  const zone = base.timezone;
  const monday = DateTime.fromISO(mondayYmd, { zone }).startOf("day");
  if (!monday.isValid) return null;

  const cacheKey = `${restaurantGuid}:${mondayYmd}`;
  const cached = weekSalesCache.get(cacheKey);
  if (cached && Date.now() - cached.at < WEEK_SALES_TTL_MS) return cached.data;

  const config = configForLocation(base, restaurantGuid);
  const token = await getToastToken(config);
  const orders = await toastGetOrdersRange(config, token, monday, monday.plus({ days: 7 }));

  const byWeekday: ToastDaySales[] = Array.from({ length: 7 }, () => ({ hours: new Array(24).fill(0), total: 0 }));
  let total = 0;
  for (const order of orders) {
    const o = asRecord(order);
    if (o.voided === true || o.deleted === true) continue;
    const opened = dateValue(o.openedDate ?? o.createdDate ?? o.modifiedDate);
    if (!opened) continue;
    const local = DateTime.fromJSDate(opened, { zone });
    const wd = local.weekday - 1; // luxon: 1=Mon … 7=Sun
    if (wd < 0 || wd > 6) continue;
    let amt = 0;
    for (const check of arrayValue(o.checks)) {
      const c = asRecord(check);
      if (c.voided === true || c.deleted === true) continue;
      amt += numberValue(c.amount);
    }
    if (amt <= 0) continue;
    byWeekday[wd].hours[local.hour] += amt;
    byWeekday[wd].total += amt;
    total += amt;
  }
  const result: ToastWeekSales = { mondayYmd, byWeekday, total, orderCount: orders.length };
  weekSalesCache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}

// --- 3-month per-item sales history -----------------------------------------

interface SalesHistoryIndex {
  /** Every business day in range, ascending — used to fill zero-sale days. */
  dates: string[];
  /** date -> normalized item key -> running totals. */
  byDate: Map<string, Map<string, { quantity: number; netSales: number }>>;
}

const HISTORY_CHUNK_DAYS = 30;
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000;

// Toast has no per-item daily endpoint, so we aggregate orders ourselves. That's
// expensive (potentially many pages over 90 days), so the computed index is
// cached in-memory and reused across item clicks within the TTL.
let historyCache: { at: number; signature: string; index: SalesHistoryIndex } | null = null;

export async function getToastItemHistory(
  itemName: string,
  restaurantGuid?: string,
  now = new Date(),
  days = 90
): Promise<ToastItemHistory> {
  const base = getToastBaseConfig();
  const empty = (error: string | null): ToastItemHistory => ({
    itemName,
    days,
    points: [],
    totalQuantity: 0,
    totalNetSales: 0,
    error,
  });

  if (!base) return empty("Add Toast API env values to enable sales history.");

  try {
    const locations = await getToastLocations();
    const guid = restaurantGuid ?? (await getPrimaryGuid(locations));
    if (!guid) return empty("No Toast locations found.");
    const config = configForLocation(base, guid);
    const index = await getSalesHistoryIndex(config, now, days);
    const key = normalizeItemKey(itemName);
    const points: ToastItemSalesPoint[] = index.dates.map((date) => {
      const record = index.byDate.get(date)?.get(key);
      return { date, quantity: record?.quantity ?? 0, netSales: record?.netSales ?? 0 };
    });

    return {
      itemName,
      days,
      points,
      totalQuantity: points.reduce((total, point) => total + point.quantity, 0),
      totalNetSales: points.reduce((total, point) => total + point.netSales, 0),
      error: null,
    };
  } catch (error) {
    return empty(error instanceof Error ? error.message : "Toast history could not be loaded.");
  }
}

async function getSalesHistoryIndex(config: ToastConfig, now: Date, days: number): Promise<SalesHistoryIndex> {
  const zone = config.timezone;
  const endDay = DateTime.fromJSDate(now, { zone }).startOf("day");
  const startDay = endDay.minus({ days: days - 1 });
  const signature = `${config.restaurantExternalId}:${startDay.toISODate()}:${endDay.toISODate()}`;

  if (historyCache && historyCache.signature === signature && Date.now() - historyCache.at < HISTORY_TTL_MS) {
    return historyCache.index;
  }

  const token = await getToastToken(config);
  const rangeEnd = endDay.plus({ days: 1 }); // exclusive

  // Fetch in <=30-day windows (Toast caps ordersBulk date ranges). Run them
  // sequentially rather than concurrently — bursting all windows at once is
  // what trips Toast's rate limiter (HTTP 429).
  const orders: unknown[] = [];
  for (let chunkStart = startDay; chunkStart < rangeEnd; chunkStart = chunkStart.plus({ days: HISTORY_CHUNK_DAYS })) {
    const chunkEnd = DateTime.min(chunkStart.plus({ days: HISTORY_CHUNK_DAYS }), rangeEnd) ?? rangeEnd;
    const chunk = await toastGetOrdersRange(config, token, chunkStart, chunkEnd);
    orders.push(...chunk);
  }

  const dates: string[] = [];
  for (let day = startDay; day <= endDay; day = day.plus({ days: 1 })) {
    const iso = day.toISODate();
    if (iso) dates.push(iso);
  }

  const byDate = new Map<string, Map<string, { quantity: number; netSales: number }>>();
  for (const order of orders) {
    const orderRecord = asRecord(order);
    if (orderRecord.voided === true || orderRecord.deleted === true) continue;
    const date = orderBusinessDate(orderRecord, zone);
    if (!date) continue;

    let bucket = byDate.get(date);
    if (!bucket) {
      bucket = new Map();
      byDate.set(date, bucket);
    }

    for (const check of arrayValue(orderRecord.checks)) {
      const checkRecord = asRecord(check);
      if (checkRecord.voided === true || checkRecord.deleted === true) continue;
      for (const selection of arrayValue(checkRecord.selections)) {
        const parsed = parseSelection(asRecord(selection));
        if (!parsed) continue;
        const record = bucket.get(parsed.key) ?? { quantity: 0, netSales: 0 };
        record.quantity += parsed.quantity;
        record.netSales += parsed.netSales;
        bucket.set(parsed.key, record);
      }
    }
  }

  const index: SalesHistoryIndex = { dates, byDate };
  historyCache = { at: Date.now(), signature, index };
  return index;
}

// Toast order objects carry a `businessDate` (yyyymmdd) that already accounts
// for the restaurant's close-out time; fall back to the opened timestamp.
function orderBusinessDate(order: ToastRecord, zone: string): string | null {
  const raw = order.businessDate;
  const digits = typeof raw === "number" ? String(raw) : stringValue(raw);
  if (digits && digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  const opened = dateValue(order.openedDate ?? order.createdDate ?? order.modifiedDate);
  if (opened) return DateTime.fromJSDate(opened, { zone }).toISODate();
  return null;
}

// --- Out-of-stock (86'd) menu items -----------------------------------------
//
// Accuracy note: GET /stock/v1/inventory returns *every* menu-item GUID the
// restaurant (and its shared menu group) has ever flagged OUT_OF_STOCK/QUANTITY
// — ~140 records, most of them stale/retail/other-location duplicates. There is
// no timestamp to filter "recent". The reliable signal for what is *currently*
// 86'd at THIS location is the intersection with the restaurant's live Menus v2:
// only GUIDs that appear in the published menu (its menu tree AND its item /
// modifier reference sections) are actually orderable here, so a 86'd GUID that
// is in Menus v2 is a real, current out-of-stock item. This reproduces exactly
// what the Toast POS "currently out of stock" view shows.

const STOCK_TTL_MS = 2 * 60 * 1000;
const MENU_TTL_MS = 6 * 60 * 60 * 1000;

const liveMenuCache = new Map<string, { at: number; byGuid: Map<string, string> }>();
const outOfStockCache = new Map<string, { at: number; data: ToastOutOfStock }>();

export function clearToastStockCache(): void {
  outOfStockCache.clear();
}

export async function getToastOutOfStock(restaurantGuid?: string, now = new Date()): Promise<ToastOutOfStock> {
  const base = getToastBaseConfig();
  const empty = (error: string | null, configured: boolean): ToastOutOfStock => ({
    configured,
    computedAt: now.toISOString(),
    items: [],
    totalTracked: 0,
    error,
  });

  if (!base) return empty("Add Toast API env values to enable stock status.", false);

  try {
    const locations = await getToastLocations();
    const guid = restaurantGuid ?? (await getPrimaryGuid(locations));
    if (!guid) return empty("No Toast locations found.", false);

    const cached = outOfStockCache.get(guid);
    if (cached && Date.now() - cached.at < STOCK_TTL_MS) return cached.data;

    const config = configForLocation(base, guid);
    const token = await getToastToken(config);
    const inventory = await toastGet<unknown[]>(config, token, "/stock/v1/inventory");
    const records = Array.isArray(inventory) ? inventory.map(asRecord) : [];
    const liveMenu = await getLiveMenuNames(config, token);

    const seen = new Set<string>();
    const items: ToastStockItem[] = [];
    let totalTracked = 0;

    for (const record of records) {
      const status = stringValue(record.status);
      const quantity = numberValue(record.quantity);
      const isOut = status === "OUT_OF_STOCK" || (status === "QUANTITY" && quantity <= 0);
      if (!isOut) continue;
      totalTracked++;

      // Only items present on this restaurant's live menu are currently 86'd
      // here; everything else is stale/other-location inventory cruft.
      const guid2 = stringValue(record.guid);
      const name = guid2 ? liveMenu.get(guid2) : undefined;
      if (!name) continue;

      const key = name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ guid: guid2!, name, status: "OUT_OF_STOCK", quantity: null });
    }

    items.sort((a, b) => a.name.localeCompare(b.name));
    const result: ToastOutOfStock = { configured: true, computedAt: now.toISOString(), items, totalTracked, error: null };
    outOfStockCache.set(guid, { at: Date.now(), data: result });
    return result;
  } catch (error) {
    return empty(error instanceof Error ? error.message : "Toast stock could not be loaded.", true);
  }
}

// Out-of-stock for every location, fetched in parallel. Used by the monitor's
// multi-location panel.
export async function getAllToastOutOfStock(now = new Date()): Promise<ToastStoreStock[]> {
  const base = getToastBaseConfig();
  if (!base) return [];
  const locations = await getToastLocations();
  return Promise.all(
    locations.map(async (loc) => ({ guid: loc.guid, name: loc.name, stock: await getToastOutOfStock(loc.guid, now) }))
  );
}

// guid -> display name for every entity on the restaurant's live Menus v2
// (menu items AND the item/modifier reference sections). Cached: menus change
// rarely, stock changes often.
async function getLiveMenuNames(config: ToastConfig, token: ToastToken): Promise<Map<string, string>> {
  const cached = liveMenuCache.get(config.restaurantExternalId);
  if (cached && Date.now() - cached.at < MENU_TTL_MS) return cached.byGuid;
  const menus = await toastGet<unknown>(config, token, "/menus/v2/menus");
  const byGuid = new Map<string, string>();
  collectMenuNames(menus, byGuid);
  liveMenuCache.set(config.restaurantExternalId, { at: Date.now(), byGuid });
  return byGuid;
}

function collectMenuNames(node: unknown, out: Map<string, string>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) collectMenuNames(child, out);
    return;
  }
  const record = node as ToastRecord;
  const guid = stringValue(record.guid);
  const name = stringValue(record.name);
  if (guid && name && !out.has(guid)) out.set(guid, name);
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") collectMenuNames(value, out);
  }
}

async function toastGetOrdersRange(
  config: ToastConfig,
  token: ToastToken,
  startUtc: DateTime,
  endUtc: DateTime
): Promise<unknown[]> {
  const startIso = toToastIso(startUtc);
  const endIso = toToastIso(endUtc);
  const all: unknown[] = [];

  for (let page = 1; page <= ORDERS_MAX_PAGES; page++) {
    const path = `/orders/v2/ordersBulk?startDate=${encodeURIComponent(startIso)}&endDate=${encodeURIComponent(
      endIso
    )}&page=${page}&pageSize=${ORDERS_PAGE_SIZE}`;
    const data = await toastGet<unknown[]>(config, token, path);
    const orders = Array.isArray(data) ? data : [];
    all.push(...orders);
    if (orders.length < ORDERS_PAGE_SIZE) break;
  }

  return all;
}

function toToastIso(dt: DateTime): string {
  return dt.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'+0000'");
}

// Account-level credentials (no restaurant). Per-location configs are derived
// from this by swapping in each restaurant GUID.
interface ToastBaseConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timezone: string;
}

function getToastBaseConfig(): ToastBaseConfig | null {
  const clientId = process.env.TOAST_CLIENT_ID;
  const clientSecret = process.env.TOAST_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    baseUrl: (process.env.TOAST_API_BASE_URL ?? DEFAULT_TOAST_BASE_URL).replace(/\/$/, ""),
    clientId,
    clientSecret,
    timezone: process.env.TOAST_BUSINESS_TIME_ZONE ?? "America/Los_Angeles",
  };
}

function configForLocation(base: ToastBaseConfig, restaurantGuid: string): ToastConfig {
  return { ...base, restaurantExternalId: restaurantGuid };
}

// All restaurants the All-Location credentials can access. The Toast header
// requires the restaurant GUID; the partner-configured "Location ID" (ref) is
// only a label here. Cached because the roster rarely changes.
const LOCATIONS_TTL_MS = 6 * 60 * 60 * 1000;
let locationsCache: { at: number; clientId: string; data: ToastLocation[] } | null = null;

export async function getToastLocations(): Promise<ToastLocation[]> {
  const base = getToastBaseConfig();
  if (!base) return [];
  if (locationsCache && locationsCache.clientId === base.clientId && Date.now() - locationsCache.at < LOCATIONS_TTL_MS) {
    return locationsCache.data;
  }
  const token = await getSharedToken(base);
  const response = await toastFetchBase(base, token, "/partners/v1/restaurants");
  if (!response.ok) throw new Error(`Toast request failed (${response.status}) for /partners/v1/restaurants.`);
  const data: unknown = await response.json();
  const list = Array.isArray(data) ? data : [];
  const locations: ToastLocation[] = list
    .map(asRecord)
    .filter((r) => r.deleted !== true)
    .flatMap((r) => {
      const guid = stringValue(r.restaurantGuid) ?? stringValue(r.guid);
      if (!guid) return [];
      const name = stringValue(r.restaurantName) ?? stringValue(r.locationName) ?? guid;
      return [{ guid, name, ref: stringValue(r.externalRestaurantRef) }];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  locationsCache = { at: Date.now(), clientId: base.clientId, data: locations };
  return locations;
}

// The location used by single-store callers (home dashboard, default history).
async function getPrimaryGuid(locations: ToastLocation[]): Promise<string | null> {
  if (!locations.length) return null;
  const bellevue = locations.find((l) => l.name.toLowerCase().includes("bellevue"));
  return (bellevue ?? locations[0]).guid;
}

function formatBusinessDate(date: Date, timezone = "America/Los_Angeles") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

// Auth is account-level (not per restaurant), so one login serves every
// location. Cache it so a 6-store bulk fetch doesn't log in 6 times.
const TOKEN_TTL_MS = 30 * 60 * 1000;
let tokenCache: { at: number; clientId: string; token: ToastToken } | null = null;

async function getSharedToken(base: { baseUrl: string; clientId: string; clientSecret: string }): Promise<ToastToken> {
  if (tokenCache && tokenCache.clientId === base.clientId && Date.now() - tokenCache.at < TOKEN_TTL_MS) {
    return tokenCache.token;
  }
  const response = await fetch(`${base.baseUrl}/authentication/v1/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: base.clientId,
      clientSecret: base.clientSecret,
      userAccessType: "TOAST_MACHINE_CLIENT",
    }),
  });

  if (!response.ok) {
    throw new Error(`Toast authentication failed (${response.status}).`);
  }

  const data = (await response.json()) as { token?: { accessToken?: string; tokenType?: string } };
  if (!data.token?.accessToken) {
    throw new Error("Toast authentication did not return an access token.");
  }

  const token: ToastToken = { accessToken: data.token.accessToken, tokenType: data.token.tokenType ?? "Bearer" };
  tokenCache = { at: Date.now(), clientId: base.clientId, token };
  return token;
}

async function getToastToken(config: ToastConfig): Promise<ToastToken> {
  return getSharedToken(config);
}

// Account-level GET (no restaurant header) — used for /partners/v1/restaurants.
async function toastFetchBase(
  base: { baseUrl: string },
  token: ToastToken,
  path: string
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${base.baseUrl}${path}`, {
      headers: { Authorization: `${token.tokenType} ${token.accessToken}` },
    });
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= TOAST_MAX_RETRIES) return response;
    const retryAfter = Number(response.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000);
    await sleep(waitMs);
  }
}

const TOAST_MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Toast rate-limits (HTTP 429). Fetching 3 months of orders is many paginated
// requests, so we retry on 429 (and transient 5xx) with exponential backoff,
// honoring the Retry-After header when present.
async function toastFetch(config: ToastConfig, token: ToastToken, path: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${config.baseUrl}${path}`, {
      headers: {
        Authorization: `${token.tokenType} ${token.accessToken}`,
        "Toast-Restaurant-External-ID": config.restaurantExternalId,
      },
    });

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= TOAST_MAX_RETRIES) return response;

    const retryAfter = Number(response.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * 2 ** attempt, 8000);
    await sleep(waitMs);
  }
}

async function toastGet<T>(config: ToastConfig, token: ToastToken, path: string): Promise<T> {
  const response = await toastFetch(config, token, path);

  if (!response.ok) {
    throw new Error(`Toast request failed (${response.status}) for ${path.split("?")[0]}.`);
  }

  return response.json() as Promise<T>;
}

// Toast's /orders/v2/ordersBulk returns a plain JSON array and paginates with
// `page` (1-indexed) + `pageSize` (max 100). It does NOT use a pageToken or
// pagination headers. Without walking every page we only get the first ~100
// orders of the day (the morning), dropping afternoon and dinner service.
const ORDERS_PAGE_SIZE = 100;
const ORDERS_MAX_PAGES = 200; // safety stop (~20k orders/day)

async function toastGetAllOrders(config: ToastConfig, token: ToastToken, businessDate: string): Promise<unknown[]> {
  const all: unknown[] = [];

  for (let page = 1; page <= ORDERS_MAX_PAGES; page++) {
    const path = `/orders/v2/ordersBulk?businessDate=${businessDate}&page=${page}&pageSize=${ORDERS_PAGE_SIZE}`;
    const data = await toastGet<unknown[]>(config, token, path);
    const orders = Array.isArray(data) ? data : [];
    all.push(...orders);
    // A short (or empty) page means we've reached the end.
    if (orders.length < ORDERS_PAGE_SIZE) break;
  }

  return all;
}

// The labor employee directory paginates via the Toast-Next-Page-Token header.
// Used purely to resolve employee GUIDs to display names.
async function toastGetAllEmployees(config: ToastConfig, token: ToastToken): Promise<unknown[]> {
  const all: unknown[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < ORDERS_MAX_PAGES; page++) {
    const path: string = pageToken
      ? `/labor/v1/employees?pageToken=${encodeURIComponent(pageToken)}`
      : "/labor/v1/employees";
    const response: Response = await toastFetch(config, token, path);

    if (!response.ok) {
      throw new Error(`Toast request failed (${response.status}) for /labor/v1/employees.`);
    }

    const data: unknown = await response.json();
    if (Array.isArray(data)) all.push(...data);

    pageToken = response.headers.get("Toast-Next-Page-Token");
    if (!pageToken) break;
  }

  return all;
}

function buildSummary({
  configured,
  businessDate,
  locationName,
  orders,
  timeEntries,
  employees,
  error,
  now,
}: {
  configured: boolean;
  businessDate: string;
  locationName: string | null;
  orders: unknown[];
  timeEntries: unknown[];
  employees: unknown[];
  error: string | null;
  now: Date;
}): ToastOpsSummary {
  const productMix = aggregateProductMix(orders);
  const netSales = buildNetSalesFromChecks(orders);
  const employeeNames = new Map<string, string>(
    employees.flatMap((employee) => {
      const record = asRecord(employee);
      const id = stringValue(record.guid) || stringValue(record.externalId);
      return id ? [[id, employeeName(record)] as const] : [];
    })
  );

  const labor = buildLabor(timeEntries, employeeNames, now);

  return {
    configured,
    businessDate,
    locationName,
    sales: {
      netSales,
      orderCount: orders.length,
      productMix,
    },
    labor,
    error,
  };
}

// Mirrors labor_cost.py's aggregate(): the staff list comes ONLY from time
// entries (already scoped to this restaurant by the header), grouped per
// employee. The directory is just a name source. This is why the working
// script never showed other-store staff.
function buildLabor(
  timeEntries: unknown[],
  employeeNames: Map<string, string>,
  now: Date
): ToastOpsSummary["labor"] {
  const byEmployee = new Map<string, ToastRecord[]>();
  for (const entry of timeEntries) {
    const record = asRecord(entry);
    const guid = referenceGuid(asRecord(record.employeeReference));
    if (!guid) continue;
    const list = byEmployee.get(guid) ?? [];
    list.push(record);
    byEmployee.set(guid, list);
  }

  const employees: ToastLaborEmployeeStatus[] = [];
  let laborCost = 0;
  for (const [guid, entries] of byEmployee) {
    const { row, cost } = employeeLaborRow(guid, entries, employeeNames, now);
    employees.push(row);
    laborCost += cost;
  }

  employees.sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name));

  return {
    activeCount: employees.filter((e) => e.status === "working").length,
    breakCount: employees.filter((e) => e.status === "break").length,
    clockedOutCount: employees.filter((e) => e.status === "clocked_out").length,
    laborHours: employees.reduce((total, e) => total + e.hours, 0),
    laborCost,
    employees,
  };
}

function employeeLaborRow(
  guid: string,
  entries: ToastRecord[],
  employeeNames: Map<string, string>,
  now: Date
): { row: ToastLaborEmployeeStatus; cost: number } {
  const sorted = [...entries].sort(
    (a, b) => (dateValue(a.inDate)?.getTime() ?? 0) - (dateValue(b.inDate)?.getTime() ?? 0)
  );
  const openEntry = sorted.find((entry) => dateValue(entry.inDate) && !dateValue(entry.outDate));

  let regularHours = 0;
  let overtimeHours = 0;
  let hours = 0;
  let breakMinutes = 0;
  let cost = 0;

  for (const entry of sorted) {
    const inDate = dateValue(entry.inDate);
    if (!inDate) continue;
    const outDate = dateValue(entry.outDate);
    const wage = numberValue(entry.hourlyWage);

    if (outDate) {
      const rh = numberValue(entry.regularHours);
      const oh = numberValue(entry.overtimeHours);
      const worked = rh + oh > 0 ? rh + oh : Math.max(0, (outDate.getTime() - inDate.getTime()) / 3_600_000);
      regularHours += rh;
      overtimeHours += oh;
      hours += worked;
      cost += wage * rh + wage * oh * OVERTIME_MULTIPLIER;
    } else {
      // Still on the clock: estimate elapsed time as regular cost.
      const elapsed = Math.max(0, (now.getTime() - inDate.getTime()) / 3_600_000);
      hours += elapsed;
      cost += wage * elapsed;
    }

    for (const item of arrayValue(entry.breaks)) {
      const br = asRecord(item);
      if (br.missed === true) continue;
      const bi = dateValue(br.inDate);
      const bo = dateValue(br.outDate);
      if (bi && bo) breakMinutes += (bo.getTime() - bi.getTime()) / 60_000;
    }
  }

  const currentBreak = openEntry
    ? arrayValue(openEntry.breaks)
        .map((item) => asRecord(item))
        .find((br) => dateValue(br.inDate) && !dateValue(br.outDate) && br.missed !== true && br.waived !== true)
    : undefined;

  const status: ToastLaborEmployeeStatus["status"] = openEntry ? (currentBreak ? "break" : "working") : "clocked_out";
  const lastEntry = sorted[sorted.length - 1];
  const jobReference = asRecord((openEntry ?? lastEntry)?.jobReference);
  const job =
    stringValue(jobReference.name) ||
    stringValue(jobReference.externalId) ||
    (status === "clocked_out" ? "Clocked out" : "Clocked in");

  const clockInDate = openEntry ? dateValue(openEntry.inDate) : dateValue(sorted[0]?.inDate);
  const clockOutDate = openEntry ? null : dateValue(lastEntry?.outDate);

  const row: ToastLaborEmployeeStatus = {
    id: guid,
    name: employeeNames.get(guid) ?? stringValue(asRecord(sorted[0]?.employeeReference).externalId) ?? "Unknown employee",
    job,
    status,
    clockIn: clockInDate?.toISOString() ?? null,
    clockOut: clockOutDate?.toISOString() ?? null,
    breakStart: currentBreak ? dateValue(currentBreak.inDate)?.toISOString() ?? null : null,
    hours,
    regularHours,
    overtimeHours,
    breakMinutes,
  };

  return { row, cost };
}

function buildNetSalesFromChecks(orders: unknown[]): number {
  let total = 0;
  for (const order of orders) {
    const orderRecord = asRecord(order);
    if (orderRecord.voided === true) continue;
    for (const check of arrayValue(orderRecord.checks)) {
      const checkRecord = asRecord(check);
      if (checkRecord.voided === true) continue;
      const subTotal = numberValue(checkRecord.subTotal);
      if (subTotal > 0) {
        total += subTotal;
      } else {
        total += Math.max(0, numberValue(checkRecord.totalAmount) - numberValue(checkRecord.taxAmount));
      }
    }
  }
  return total;
}

function aggregateProductMix(orders: unknown[]): ToastProductMixItem[] {
  const byItem = new Map<string, ToastProductMixItem>();

  for (const order of orders) {
    const orderRecord = asRecord(order);
    const checks = arrayValue(orderRecord.checks);
    for (const check of checks) {
      const checkRecord = asRecord(check);
      for (const selection of arrayValue(checkRecord.selections)) {
        addSelection(byItem, asRecord(selection));
      }
    }
  }

  return [...byItem.values()].sort((a, b) => b.netSales - a.netSales);
}

// Normalizes an item's display name into the grouping key shared by the product
// mix and the 3-month history, so a click on a mix row matches the same item.
export function normalizeItemKey(name: string): string {
  return name.trim().toLowerCase();
}

function parseSelection(
  selection: ToastRecord
): { key: string; name: string; quantity: number; netSales: number } | null {
  if (selection.voided === true || selection.deferred === true) return null;

  const itemReference = asRecord(selection.itemReference ?? selection.menuItemReference ?? selection.salesCategoryReference);
  const name =
    stringValue(selection.displayName) ||
    stringValue(selection.name) ||
    stringValue(itemReference.name) ||
    stringValue(itemReference.externalId) ||
    "Unknown item";
  const quantity = numberValue(selection.quantity) || 1;
  const netSales =
    numberValue(selection.receiptLinePrice) !== 0
      ? numberValue(selection.receiptLinePrice)
      : numberValue(selection.price) || numberValue(selection.preDiscountPrice) || numberValue(selection.selectionPrice);

  // Group by name, not GUID: the same item carries different GUIDs across menus,
  // day-parts, and modifier contexts, which would otherwise split one item into
  // many rows that all read identically.
  return { key: normalizeItemKey(name), name, quantity, netSales };
}

function addSelection(byItem: Map<string, ToastProductMixItem>, selection: ToastRecord) {
  const parsed = parseSelection(selection);
  if (!parsed) return;

  const current = byItem.get(parsed.key) ?? { id: parsed.key, name: parsed.name, quantity: 0, netSales: 0 };
  current.quantity += parsed.quantity;
  current.netSales += parsed.netSales;
  byItem.set(parsed.key, current);
}

function employeeName(record: ToastRecord) {
  const first = stringValue(record.firstName);
  const last = stringValue(record.lastName);
  return stringValue(record.name) || stringValue(record.chosenName) || [first, last].filter(Boolean).join(" ") || stringValue(record.guid) || "Unknown employee";
}

function emptySummary({
  configured,
  businessDate,
  locationName,
  error,
}: {
  configured: boolean;
  businessDate: string;
  locationName: string | null;
  error: string | null;
}): ToastOpsSummary {
  return {
    configured,
    businessDate,
    locationName,
    sales: { netSales: 0, orderCount: 0, productMix: [] },
    labor: { activeCount: 0, breakCount: 0, clockedOutCount: 0, laborHours: 0, laborCost: 0, employees: [] },
    error,
  };
}

function asRecord(value: unknown): ToastRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ToastRecord) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function dateValue(value: unknown): Date | null {
  const text = stringValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function referenceGuid(record: ToastRecord): string | null {
  return stringValue(record.guid) || stringValue(record.externalId);
}

function statusRank(status: ToastLaborEmployeeStatus["status"]) {
  if (status === "break") return 0;
  if (status === "working") return 1;
  return 2; // clocked_out
}
