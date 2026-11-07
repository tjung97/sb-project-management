import "server-only";

import { DateTime } from "luxon";
import { clearToastStockCache, getAllToastOutOfStock, type ToastStoreStock } from "@/src/lib/toast/api";
import { listSlingChats, postSlingMessage } from "@/src/lib/sling/api";
import {
  getOutOfStockAlertConfig,
  outOfStockAlertRef,
  parseOutOfStockAlertConfig,
  type OutOfStockAlertConfig,
} from "@/src/lib/ops/out-of-stock-alert-config";
import { adminDb } from "@/src/lib/firebase/admin";
import { buildMessages, type AlertStore, type PlannedMessage } from "@/src/lib/ops/out-of-stock-message";

export type { PlannedMessage };

// Daily out-of-stock alert: Toast 86'd items → Sling chats.
//
// The Firebase function `outOfStockAlert` hits /api/cron/out-of-stock every 15
// minutes. This runner decides whether it's time (settings live in Firestore,
// so the send time can change from the UI without a redeploy), claims the day
// so it only ever sends once, then posts:
//   • one combined message to each "all stores" chat
//   • each store's own list to that store's chats

const TZ = process.env.STORE_TIMEZONE ?? "America/Los_Angeles";
/** How long after the send time a late tick may still send (covers missed ticks). */
const SEND_WINDOW_MIN = 60;

export interface OutOfStockAlertResult {
  status: "sent" | "partial" | "failed" | "skipped" | "preview";
  reason: string | null;
  nowLocal: string;
  messages: PlannedMessage[];
  posted: number;
  errors: string[];
}

export function toAlertStores(stores: ToastStoreStock[]): AlertStore[] {
  return stores.map((s) => ({ guid: s.guid, name: s.name, items: s.stock.items.map((i) => i.name), error: Boolean(s.stock.error) }));
}

function isDue(config: OutOfStockAlertConfig, now: DateTime): string | null {
  if (!config.enabled) return "Alert is turned off.";
  if (!config.days.includes(now.weekday % 7)) return "Not a send day.";
  const [h, m] = config.sendTime.split(":").map(Number);
  const sendMin = h * 60 + m;
  const nowMin = now.hour * 60 + now.minute;
  if (nowMin < sendMin) return `Before send time (${config.sendTime}).`;
  if (nowMin >= sendMin + SEND_WINDOW_MIN) return `Send window for ${config.sendTime} has passed.`;
  if (config.lastSentDate === now.toISODate()) return "Already sent today.";
  return null;
}

/**
 * @param force    ignore the schedule (the "Send now" button)
 * @param preview  build the messages but don't send or record anything
 */
export async function runOutOfStockAlert(
  options: { force?: boolean; preview?: boolean; now?: Date } = {}
): Promise<OutOfStockAlertResult> {
  const now = DateTime.fromJSDate(options.now ?? new Date(), { zone: TZ });
  const today = now.toISODate()!;
  const base = { nowLocal: now.toFormat("yyyy-LL-dd HH:mm ZZZZ"), messages: [], posted: 0, errors: [] };
  const config = await getOutOfStockAlertConfig();

  if (!options.force && !options.preview) {
    const notDue = isDue(config, now);
    if (notDue) return { ...base, status: "skipped", reason: notDue };

    // Claim today atomically so overlapping/retried ticks can't double-send.
    const claimed = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(outOfStockAlertRef());
      const fresh = parseOutOfStockAlertConfig(snap.data());
      if (fresh.lastSentDate === today) return false;
      tx.set(outOfStockAlertRef(), { last_sent_date: today }, { merge: true });
      return true;
    });
    if (!claimed) return { ...base, status: "skipped", reason: "Already sent today." };
  }

  const record = async (fields: Record<string, unknown>) => {
    if (!options.preview) await outOfStockAlertRef().set({ last_run_at: now.toISO(), ...fields }, { merge: true });
  };

  try {
    clearToastStockCache(); // always read live stock for the alert
    const [stores, chats] = await Promise.all([
      getAllToastOutOfStock(now.toJSDate()),
      listSlingChats().catch(() => []),
    ]);
    const messages = buildMessages(config, toAlertStores(stores), new Map(chats.map((c) => [c.id, c.name])), now.toFormat("ccc, LLL d"));

    if (options.preview) {
      return { ...base, status: "preview", reason: messages.length ? null : "No chats selected (or nothing to send).", messages };
    }
    if (!messages.length) {
      await record({ last_result: "Nothing to send (no chats selected, or nothing 86'd).", last_error: null });
      return { ...base, status: "skipped", reason: "Nothing to send.", messages };
    }

    const errors: string[] = [];
    let posted = 0;
    for (const msg of messages) {
      try {
        await postSlingMessage(msg.chatId, msg.content);
        posted++;
      } catch (e) {
        errors.push(`${msg.chatName}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const status = errors.length === 0 ? "sent" : posted > 0 ? "partial" : "failed";
    await record({
      last_result: `${status === "sent" ? "Sent" : status === "partial" ? "Partly sent" : "Failed"}: ${posted}/${messages.length} message(s)`,
      last_error: errors.length ? errors.join(" | ").slice(0, 900) : null,
      // Nothing went out → release today's claim so the next tick retries.
      ...(posted === 0 && !options.force ? { last_sent_date: config.lastSentDate } : {}),
    });
    return { ...base, status, reason: null, messages, posted, errors };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await record({
      last_result: "Failed",
      last_error: message.slice(0, 900),
      ...(!options.force ? { last_sent_date: config.lastSentDate } : {}),
    });
    return { ...base, status: "failed", reason: message, errors: [message] };
  }
}
