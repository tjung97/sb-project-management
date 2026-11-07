import "server-only";

import { adminDb } from "@/src/lib/firebase/admin";
import { DEFAULT_OOS_FOOTER, DEFAULT_OOS_HEADER } from "@/src/lib/ops/out-of-stock-message";

// Firestore-backed settings for the daily Toast out-of-stock → Sling alert,
// edited from the Operations tab. Off until an admin turns it on and picks chats.

export interface OutOfStockAlertConfig {
  enabled: boolean;
  /** Store-local send time, "HH:MM" (24h). */
  sendTime: string;
  /** Days to send, 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Sling chat IDs that get ONE combined message for every store. */
  allStoresChats: string[];
  /** Toast restaurant GUID → Sling chat IDs that get only that store's list. */
  storeChats: Record<string, string[]>;
  /** Also send when nothing is 86'd ("✅ nothing out of stock"). */
  sendWhenEmpty: boolean;
  /** First line(s) of each message; supports {date} {count} {stores} {store}. */
  headerTemplate: string;
  /** Optional closing line(s), same fill-ins. Empty = none. */
  footerTemplate: string;
  /** Store GUID (or "all_stores") → item names left out of the alert. */
  ignoredItems: Record<string, string[]>;
  // Status, written by the runner.
  lastSentDate: string | null;
  lastRunAt: string | null;
  lastResult: string | null;
  lastError: string | null;
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_OUT_OF_STOCK_ALERT_CONFIG: OutOfStockAlertConfig = {
  enabled: false,
  sendTime: "07:00",
  days: ALL_DAYS,
  allStoresChats: [],
  storeChats: {},
  sendWhenEmpty: true,
  headerTemplate: DEFAULT_OOS_HEADER,
  footerTemplate: DEFAULT_OOS_FOOTER,
  ignoredItems: {},
  lastSentDate: null,
  lastRunAt: null,
  lastResult: null,
  lastError: null,
};

export const OUT_OF_STOCK_ALERT_DOC = { collection: "ops_config", doc: "out_of_stock_alert" } as const;

export function outOfStockAlertRef() {
  return adminDb.collection(OUT_OF_STOCK_ALERT_DOC.collection).doc(OUT_OF_STOCK_ALERT_DOC.doc);
}

const ids = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))] : [];
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

export function parseOutOfStockAlertConfig(d: Record<string, unknown> | undefined): OutOfStockAlertConfig {
  if (!d) return DEFAULT_OUT_OF_STOCK_ALERT_CONFIG;
  const storeChats: Record<string, string[]> = {};
  if (d.store_chats && typeof d.store_chats === "object") {
    for (const [guid, list] of Object.entries(d.store_chats as Record<string, unknown>)) {
      const clean = ids(list);
      if (clean.length) storeChats[guid] = clean;
    }
  }
  const days = Array.isArray(d.days)
    ? d.days.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : ALL_DAYS;
  const ignoredItems: Record<string, string[]> = {};
  if (d.ignored_items && typeof d.ignored_items === "object") {
    for (const [key, list] of Object.entries(d.ignored_items as Record<string, unknown>)) {
      const clean = ids(list);
      if (clean.length) ignoredItems[key] = clean;
    }
  }
  return {
    enabled: d.enabled === true,
    sendTime: typeof d.send_time === "string" && /^\d{2}:\d{2}$/.test(d.send_time) ? d.send_time : "07:00",
    days,
    allStoresChats: ids(d.all_stores_chats),
    storeChats,
    sendWhenEmpty: d.send_when_empty !== false,
    headerTemplate: typeof d.header_template === "string" ? d.header_template : DEFAULT_OOS_HEADER,
    footerTemplate: typeof d.footer_template === "string" ? d.footer_template : DEFAULT_OOS_FOOTER,
    ignoredItems,
    lastSentDate: strOrNull(d.last_sent_date),
    lastRunAt: strOrNull(d.last_run_at),
    lastResult: strOrNull(d.last_result),
    lastError: strOrNull(d.last_error),
  };
}

export async function getOutOfStockAlertConfig(): Promise<OutOfStockAlertConfig> {
  try {
    const snap = await outOfStockAlertRef().get();
    return parseOutOfStockAlertConfig(snap.exists ? snap.data() : undefined);
  } catch {
    return DEFAULT_OUT_OF_STOCK_ALERT_CONFIG;
  }
}
