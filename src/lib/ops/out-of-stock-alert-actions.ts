"use server";

import { FieldValue } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { requireAdminRole } from "@/src/lib/ops/authz";
import { outOfStockAlertRef } from "@/src/lib/ops/out-of-stock-alert-config";
import { runOutOfStockAlert, type OutOfStockAlertResult } from "@/src/lib/ops/out-of-stock-alert";

async function adminOrThrow() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");
  requireAdminRole(user);
  return user;
}

export async function updateOutOfStockAlertConfig(formData: FormData) {
  const user = await adminOrThrow();

  const sendTime = String(formData.get("send_time") ?? "");
  const days = formData.getAll("days").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const allStoresChats = [...new Set(formData.getAll("all_stores_chats").map(String).filter(Boolean))];

  // Each store pick arrives as "<toastGuid>|<slingChatId>".
  const storeChats: Record<string, string[]> = {};
  for (const pair of formData.getAll("store_chats").map(String)) {
    const [guid, chatId] = pair.split("|");
    if (!guid || !chatId) continue;
    const list = (storeChats[guid] ??= []);
    if (!list.includes(chatId)) list.push(chatId);
  }

  // Each ignored item arrives as "<toastGuid or all_stores>|<item name>".
  const ignoredItems: Record<string, string[]> = {};
  for (const pair of formData.getAll("ignored_items").map(String)) {
    const cut = pair.indexOf("|");
    const key = pair.slice(0, cut);
    const item = pair.slice(cut + 1).trim().slice(0, 200);
    if (cut < 1 || !item) continue;
    const list = (ignoredItems[key] ??= []);
    if (!list.includes(item)) list.push(item);
  }

  await outOfStockAlertRef().set(
    {
      enabled: formData.get("enabled") === "on",
      send_time: /^\d{2}:\d{2}$/.test(sendTime) ? sendTime : "07:00",
      days,
      all_stores_chats: allStoresChats,
      // Replace (not merge) the map so removed stores are cleared.
      store_chats: storeChats,
      ignored_items: ignoredItems,
      send_when_empty: formData.get("send_when_empty") === "on",
      title_template: String(formData.get("title_template") ?? "").slice(0, 120),
      header_template: String(formData.get("header_template") ?? "").slice(0, 300),
      footer_template: String(formData.get("footer_template") ?? "").slice(0, 500),
      updated_at: FieldValue.serverTimestamp(),
      updated_by_uid: user.uid,
    },
    { mergeFields: ["enabled", "send_time", "days", "all_stores_chats", "store_chats", "send_when_empty", "title_template", "header_template", "footer_template", "ignored_items", "updated_at", "updated_by_uid"] }
  );
  revalidatePath("/operations");
}

/** Build the messages from the saved settings without sending. */
export async function previewOutOfStockAlert(): Promise<OutOfStockAlertResult> {
  await adminOrThrow();
  return runOutOfStockAlert({ preview: true });
}

/** Send to the saved chats right now, ignoring the schedule. */
export async function sendOutOfStockAlertNow(): Promise<OutOfStockAlertResult> {
  await adminOrThrow();
  const result = await runOutOfStockAlert({ force: true });
  revalidatePath("/operations");
  return result;
}
