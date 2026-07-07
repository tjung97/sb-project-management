import "server-only";

import { createHash } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/src/lib/firebase/admin";
import { getAllToastOutOfStock } from "@/src/lib/toast/api";

// Toast's stock API has no timestamp and no "who" — so we detect *newly* 86'd
// items by diffing each poll against a stored snapshot. The snapshot lives in
// Firestore (`stock_watch`) so detection survives restarts and works across the
// multiple ephemeral instances on Firebase App Hosting. Result: item + store +
// "detected N min ago" for anything that recently went out of stock.

const WATCH = "stock_watch";
const META = "stock_watch_meta";
const SYNC_GATE_MS = 75 * 1000; // don't re-diff more than ~once a poll
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface StockOutageEvent {
  id: string;
  itemName: string;
  locationName: string;
  outSinceMs: number;
}

function docId(guid: string, itemName: string): string {
  return `${guid}__${createHash("sha1").update(itemName.toLowerCase().trim()).digest("hex").slice(0, 16)}`;
}

/** Sync the snapshot (rate-limited) and return items that recently went out of stock. */
export async function getRecentStockOutages(now = new Date()): Promise<StockOutageEvent[]> {
  try {
    await syncIfDue(now);
    const cutoff = Timestamp.fromMillis(now.getTime() - RECENT_WINDOW_MS);
    const snap = await adminDb
      .collection(WATCH)
      .where("still_out", "==", true)
      .where("out_since", ">=", cutoff)
      .orderBy("out_since", "desc")
      .limit(12)
      .get();

    return snap.docs.flatMap((doc) => {
      const data = doc.data();
      const outSince = data.out_since as Timestamp | undefined;
      if (!outSince) return [];
      return [
        {
          id: doc.id,
          itemName: String(data.item_name ?? "Item"),
          locationName: String(data.location_name ?? "Store"),
          outSinceMs: outSince.toMillis(),
        },
      ];
    });
  } catch {
    // Never let a monitoring extra break the dashboard.
    return [];
  }
}

async function syncIfDue(now: Date): Promise<void> {
  const metaRef = adminDb.collection(META).doc("state");
  const meta = await metaRef.get();
  const lastMs = (meta.data()?.last_sync as Timestamp | undefined)?.toMillis() ?? 0;
  if (now.getTime() - lastMs < SYNC_GATE_MS) return;

  // On the very first sync every current outage looks "new" — backdate it so the
  // baseline doesn't flood the banner; only outages after this point are recent.
  const firstEver = !meta.exists || lastMs === 0;
  const newOutageTs = firstEver ? Timestamp.fromMillis(now.getTime() - RECENT_WINDOW_MS - 60_000) : Timestamp.fromDate(now);

  // Claim the sync slot first so parallel renders/instances don't double-run.
  await metaRef.set({ last_sync: Timestamp.fromDate(now) }, { merge: true });

  const stores = await getAllToastOutOfStock(now);
  if (!stores.some((s) => s.stock.configured)) return;

  const nowTs = Timestamp.fromDate(now);
  const batch = adminDb.batch();

  for (const store of stores) {
    if (!store.stock.configured || store.stock.error) continue;

    const currentIds = new Map<string, string>(); // docId -> itemName
    for (const item of store.stock.items) currentIds.set(docId(store.guid, item.name), item.name);

    // Existing tracked rows for this location.
    const existing = await adminDb.collection(WATCH).where("location_guid", "==", store.guid).get();
    const known = new Set<string>();
    for (const doc of existing.docs) {
      known.add(doc.id);
      const stillOut = currentIds.has(doc.id);
      if (stillOut) {
        // Was it previously marked back-in-stock? Then it's a fresh outage again.
        if (doc.data().still_out === false) {
          batch.set(doc.ref, { still_out: true, out_since: nowTs, last_seen: nowTs }, { merge: true });
        } else {
          batch.set(doc.ref, { last_seen: nowTs }, { merge: true });
        }
      } else if (doc.data().still_out !== false) {
        batch.set(doc.ref, { still_out: false, last_seen: nowTs }, { merge: true });
      }
    }

    // Brand-new outages.
    for (const [id, itemName] of currentIds) {
      if (known.has(id)) continue;
      batch.set(adminDb.collection(WATCH).doc(id), {
        location_guid: store.guid,
        location_name: store.name,
        item_name: itemName,
        still_out: true,
        out_since: newOutageTs,
        last_seen: nowTs,
        created_at: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
