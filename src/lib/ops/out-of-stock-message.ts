// Message layout for the daily out-of-stock → Sling alert. Pure functions, no
// server imports, so the Operations panel can render a live preview with the
// exact same code the cron runner uses to send.

export const DEFAULT_OOS_HEADER = "🚫 Out of stock — {date}";
export const DEFAULT_OOS_FOOTER = "";

/** Fill-ins admins can use in the header/footer. */
export const OOS_PLACEHOLDERS = [
  { key: "{date}", hint: "Fri, Nov 6" },
  { key: "{count}", hint: "number of items" },
  { key: "{stores}", hint: "number of stores" },
  { key: "{store}", hint: "store name (or “All stores”)" },
] as const;

export interface AlertStore {
  guid: string;
  name: string;
  items: string[];
  error: boolean;
}

export interface AlertRouting {
  allStoresChats: string[];
  storeChats: Record<string, string[]>;
  sendWhenEmpty: boolean;
  headerTemplate: string;
  footerTemplate: string;
  /** Items left out of the alert: store GUID (or IGNORE_ALL_KEY) → item names. */
  ignoredItems: Record<string, string[]>;
}

/** Key in ignoredItems for items ignored at every store. */
export const IGNORE_ALL_KEY = "__all__";

/** Name used to match ignored items: case/spacing-insensitive. */
export function itemKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isIgnored(ignored: Record<string, string[]>, storeGuid: string, item: string): boolean {
  const k = itemKey(item);
  return [...(ignored[IGNORE_ALL_KEY] ?? []), ...(ignored[storeGuid] ?? [])].some((x) => itemKey(x) === k);
}

/** Drop ignored items from each store's list. */
export function applyIgnores(stores: AlertStore[], ignored: Record<string, string[]>): AlertStore[] {
  return sortStores(stores).map((s) => ({ ...s, items: s.items.filter((i) => !isIgnored(ignored, s.guid, i)) }));
}

export interface PlannedMessage {
  chatId: string;
  chatName: string;
  scope: "all" | "store";
  storeName?: string;
  content: string;
}

export function storeLabel(name: string): string {
  return name.replace(/^seoul bowl\s+/i, "").trim() || name;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function fill(template: string, vars: { date: string; count: number; stores: number; store: string }): string {
  return template
    .replaceAll("{date}", vars.date)
    .replaceAll("{count}", String(vars.count))
    .replaceAll("{stores}", String(vars.stores))
    .replaceAll("{store}", vars.store)
    .trim();
}

function storeSection(s: AlertStore): string {
  const label = storeLabel(s.name);
  if (s.error) return `${label} — ⚠️ couldn't read Toast`;
  if (!s.items.length) return `${label} — ✅ all in stock`;
  return [`${label} (${s.items.length})`, ...s.items.map((i) => `• ${i}`)].join("\n");
}

function compose(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p && p.trim()).join("\n\n");
}

/** One combined message covering every store. */
export function formatAllStoresMessage(stores: AlertStore[], routing: Pick<AlertRouting, "headerTemplate" | "footerTemplate">, date: string): string {
  const sorted = sortStores(stores);
  const count = sorted.reduce((n, s) => n + s.items.length, 0);
  const vars = { date, count, stores: sorted.length, store: "All stores" };
  const header = fill(routing.headerTemplate, vars);
  const summary = `${plural(count, "item")} across ${plural(sorted.length, "store")}`;
  return compose([[header, summary].filter(Boolean).join("\n"), ...sorted.map(storeSection), fill(routing.footerTemplate, vars)]);
}

/** One store's own list. */
export function formatStoreMessage(store: AlertStore, routing: Pick<AlertRouting, "headerTemplate" | "footerTemplate">, date: string): string {
  [store] = sortStores([store]);
  const vars = { date, count: store.items.length, stores: 1, store: storeLabel(store.name) };
  return compose([fill(routing.headerTemplate, vars), storeSection(store), fill(routing.footerTemplate, vars)]);
}

function sortStores(stores: AlertStore[]): AlertStore[] {
  return stores
    .map((s) => ({ ...s, items: Array.isArray(s.items) ? s.items : [], error: Boolean(s.error) }))
    .sort((a, b) => storeLabel(a.name).localeCompare(storeLabel(b.name)));
}

export function buildMessages(routing: AlertRouting, stores: AlertStore[], chatNames: Map<string, string>, date: string): PlannedMessage[] {
  const sorted = applyIgnores(stores, routing.ignoredItems ?? {});
  const total = sorted.reduce((n, s) => n + s.items.length, 0);
  const name = (id: string) => chatNames.get(id) ?? `Chat ${id}`;
  const out: PlannedMessage[] = [];

  if (routing.allStoresChats.length && (total > 0 || routing.sendWhenEmpty)) {
    const content = formatAllStoresMessage(sorted, routing, date);
    for (const chatId of routing.allStoresChats) out.push({ chatId, chatName: name(chatId), scope: "all", content });
  }

  for (const store of sorted) {
    const chats = routing.storeChats[store.guid] ?? [];
    if (!chats.length) continue;
    if (!store.items.length && !store.error && !routing.sendWhenEmpty) continue;
    const content = formatStoreMessage(store, routing, date);
    for (const chatId of chats) {
      out.push({ chatId, chatName: name(chatId), scope: "store", storeName: storeLabel(store.name), content });
    }
  }
  return out;
}
