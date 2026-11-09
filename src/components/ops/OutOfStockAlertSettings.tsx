"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Eye, Loader2, PackageX, Send, X } from "lucide-react";
import {
  previewOutOfStockAlert,
  sendOutOfStockAlertNow,
  updateOutOfStockAlertConfig,
} from "@/src/lib/ops/out-of-stock-alert-actions";
import { cn } from "@/src/lib/utils";
import type { OutOfStockAlertConfig } from "@/src/lib/ops/out-of-stock-alert-config";
import type { OutOfStockAlertResult } from "@/src/lib/ops/out-of-stock-alert";
import {
  DEFAULT_OOS_HEADER,
  DEFAULT_OOS_TITLE,
  IGNORE_ALL_KEY,
  OOS_PLACEHOLDERS,
  applyIgnores,
  buildMessages,
  itemKey,
  formatAllStoresMessage,
  type AlertStore,
} from "@/src/lib/ops/out-of-stock-message";

interface Chat {
  id: string;
  name: string;
}
type Store = AlertStore;

function todayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ALL_KEY = "__all__";

function label(name: string) {
  return name.replace(/^seoul bowl\s+/i, "").trim() || name;
}

function formatTime(hm: string) {
  const [h, m] = hm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function daysSummary(days: number[]) {
  if (days.length === 7) return "daily";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "weekdays";
  if (!days.length) return "no days";
  return [...days]
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(", ");
}

// Operations-tab settings for the daily Toast out-of-stock → Sling alert. Admin-only.
export function OutOfStockAlertSettings({
  config,
  stores,
  chats,
  chatsError,
}: {
  config: OutOfStockAlertConfig;
  stores: Store[];
  chats: Chat[];
  chatsError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [running, startRun] = useTransition();
  const [runResult, setRunResult] = useState<OutOfStockAlertResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(config.enabled);
  const [days, setDays] = useState<number[]>(config.days);
  const [sendWhenEmpty, setSendWhenEmpty] = useState(config.sendWhenEmpty);
  const [titleText, setTitleText] = useState(config.titleTemplate);
  const [header, setHeader] = useState(config.headerTemplate);
  const [footer, setFooter] = useState(config.footerTemplate);
  const [ignored, setIgnored] = useState<Record<string, string[]>>(config.ignoredItems);

  const toggleIgnored = (key: string, item: string) => {
    setIgnored((cur) => {
      const list = cur[key] ?? [];
      const has = list.some((x) => itemKey(x) === itemKey(item));
      return {
        ...cur,
        [key]: has ? list.filter((x) => itemKey(x) !== itemKey(item)) : [...list, item],
      };
    });
    touch();
  };
  const [routes, setRoutes] = useState<Record<string, string[]>>(() => ({
    [ALL_KEY]: config.allStoresChats,
    ...Object.fromEntries(stores.map((s) => [s.guid, config.storeChats[s.guid] ?? []])),
  }));

  const sortedStores = useMemo(() => [...stores].sort((a, b) => label(a.name).localeCompare(label(b.name))), [stores]);
  const chatCount = new Set(Object.values(routes).flat()).size;

  // Live preview: same formatter the cron uses, fed with the stock on this page.
  const preview = useMemo(() => {
    const date = todayLabel();
    const routing = {
      allStoresChats: routes[ALL_KEY] ?? [],
      storeChats: Object.fromEntries(Object.entries(routes).filter(([k]) => k !== ALL_KEY)),
      sendWhenEmpty,
      titleTemplate: titleText,
      headerTemplate: header,
      footerTemplate: footer,
      ignoredItems: ignored,
    };
    const planned = buildMessages(routing, stores, new Map(chats.map((c) => [c.id, c.name])), date);
    if (planned.length) return planned;
    // No chats picked yet: still show what the combined message looks like.
    return [
      {
        chatId: "example",
        chatName: "Example (no chats picked)",
        scope: "all" as const,
        content: formatAllStoresMessage(applyIgnores(stores, ignored), routing, date),
      },
    ];
  }, [routes, sendWhenEmpty, titleText, header, footer, ignored, stores, chats]);

  const touch = () => {
    setDirty(true);
    setSaved(false);
  };
  const setRoute = (key: string, ids: string[]) => {
    setRoutes((r) => ({ ...r, [key]: ids }));
    touch();
  };

  function onSubmit(formData: FormData) {
    setSaveError(null);
    startSave(async () => {
      try {
        await updateOutOfStockAlertConfig(formData);
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function run(kind: "preview" | "send") {
    if (kind === "send" && !window.confirm("Send the out-of-stock alert to the saved Sling chats right now?")) return;
    setRunError(null);
    setRunResult(null);
    startRun(async () => {
      try {
        setRunResult(kind === "preview" ? await previewOutOfStockAlert() : await sendOutOfStockAlertNow());
      } catch (e) {
        setRunError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <PackageX className={cn("h-4 w-4", enabled ? "text-info" : "text-muted-foreground")} />
        <span className="text-sm font-semibold">Out-of-stock alerts → Sling</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            config.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {config.enabled ? "On" : "Off"}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatTime(config.sendTime)} {daysSummary(config.days)} ·{" "}
          {new Set([...config.allStoresChats, ...Object.values(config.storeChats).flat()]).size} chat(s)
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <form action={onSubmit} onChange={touch} className="space-y-5 border-t border-border/70 px-4 py-4">
          {/* enabled */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={config.enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-medium">Send the daily out-of-stock alert to Sling</span>
          </label>

          {/* time + days */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground" htmlFor="oos_send_time">
                Send at
              </label>
              <input
                id="oos_send_time"
                name="send_time"
                type="time"
                step={900}
                defaultValue={config.sendTime}
                className="h-8 rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60"
              />
              <span className="text-[11px] text-muted-foreground">Pacific · checked every 15 min</span>
            </div>
            <div className="flex items-center gap-1">
              {DAY_LABELS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <label
                    key={d}
                    className={cn(
                      "cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition",
                      on ? "border-info/50 bg-info/10 text-info" : "border-border/80 text-muted-foreground",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="days"
                      value={i}
                      checked={on}
                      onChange={(e) => setDays((cur) => (e.target.checked ? [...cur, i] : cur.filter((x) => x !== i)))}
                      className="sr-only"
                    />
                    {d}
                  </label>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="send_when_empty"
              checked={sendWhenEmpty}
              onChange={(e) => setSendWhenEmpty(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>Still send when nothing is out of stock</span>
          </label>

          {/* items left out of the alert */}
          <IgnoreSection stores={sortedStores} ignored={ignored} onToggle={toggleIgnored} />

          {/* message template + live preview */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Message</p>
                <p className="text-[11px] text-muted-foreground">
                  Each store&apos;s items are listed one per line. You can change the top and bottom lines.
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Title (shown in bold)</span>
                <input
                  name="title_template"
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder={DEFAULT_OOS_TITLE}
                  className="h-8 w-full rounded-lg border border-border/80 bg-background px-2 text-sm font-semibold outline-none focus:border-info/60"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Header</span>
                <input
                  name="header_template"
                  value={header}
                  onChange={(e) => setHeader(e.target.value)}
                  placeholder={DEFAULT_OOS_HEADER}
                  className="h-8 w-full rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Footer (optional)</span>
                <textarea
                  name="footer_template"
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  rows={2}
                  placeholder="e.g. Please update us when restocked"
                  className="w-full rounded-lg border border-border/80 bg-background px-2 py-1.5 text-sm outline-none focus:border-info/60"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {OOS_PLACEHOLDERS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    title={p.hint}
                    onClick={() => {
                      setHeader((h) => `${h}${h.endsWith(" ") || !h ? "" : " "}${p.key}`);
                      touch();
                    }}
                    className="rounded-md border border-border/80 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    {p.key}
                  </button>
                ))}
                <span className="text-[11px] text-muted-foreground">tap to add to header · hover for meaning</span>
              </div>
              {titleText !== DEFAULT_OOS_TITLE || header !== DEFAULT_OOS_HEADER || footer ? (
                <button
                  type="button"
                  onClick={() => {
                    setTitleText(DEFAULT_OOS_TITLE);
                    setHeader(DEFAULT_OOS_HEADER);
                    setFooter("");
                    touch();
                  }}
                  className="text-[11px] text-info hover:underline"
                >
                  Reset to default
                </button>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Live preview</p>
              <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-border/70 bg-muted/30 p-3">
                {preview.map((m, i) => (
                  <div key={`${m.chatId}-${i}`} className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      → <span className="font-medium text-foreground">{m.chatName}</span>
                      {m.storeName ? ` (${m.storeName} only)` : " (all stores)"}
                    </p>
                    <pre className="whitespace-pre-wrap rounded-md bg-background p-2 font-sans text-xs">{m.content}</pre>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Uses the stock on this page. The real message re-checks Toast when it sends.
              </p>
            </div>
          </div>

          {/* routing */}
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Where each store&apos;s 86&apos;d items go</p>
              <p className="text-[11px] text-muted-foreground">
                Pick one or more Sling chats per row. Rows with no chats are skipped.
              </p>
            </div>
            {chatsError ? (
              <p className="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
                Couldn&apos;t load Sling chats: {chatsError}
              </p>
            ) : null}
            <div className="divide-y divide-border/60 rounded-lg border border-border/70">
              <RouteRow
                title="All stores"
                hint="one combined message"
                fieldName="all_stores_chats"
                valueFor={(id) => id}
                selected={routes[ALL_KEY] ?? []}
                chats={chats}
                onChange={(ids) => setRoute(ALL_KEY, ids)}
              />
              {sortedStores.map((s) => (
                <RouteRow
                  key={s.guid}
                  title={label(s.name)}
                  hint="only this store"
                  fieldName="store_chats"
                  valueFor={(id) => `${s.guid}|${id}`}
                  selected={routes[s.guid] ?? []}
                  chats={chats}
                  onChange={(ids) => setRoute(s.guid, ids)}
                />
              ))}
            </div>
          </div>

          {/* status */}
          {config.lastRunAt ? (
            <p className="text-[11px] text-muted-foreground">
              Last run {new Date(config.lastRunAt).toLocaleString()} · {config.lastResult}
              {config.lastError ? <span className="block text-destructive">{config.lastError}</span> : null}
            </p>
          ) : null}

          {/* actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save settings
            </button>
            <button
              type="button"
              onClick={() => run("preview")}
              disabled={running || dirty}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
            <button
              type="button"
              onClick={() => run("send")}
              disabled={running || dirty || chatCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send now
            </button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : dirty ? (
              <span className="text-xs text-muted-foreground">Save first to preview or send.</span>
            ) : null}
          </div>

          {saveError ? <p className="text-xs text-destructive">Couldn&apos;t save: {saveError}</p> : null}
          {runError ? <p className="text-xs text-destructive">{runError}</p> : null}
          {runResult ? <RunResult result={runResult} /> : null}
        </form>
      ) : null}
    </div>
  );
}

function IgnoreSection({
  stores,
  ignored,
  onToggle,
}: {
  stores: Store[];
  ignored: Record<string, string[]>;
  onToggle: (key: string, item: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const has = (key: string, item: string) => (ignored[key] ?? []).some((x) => itemKey(x) === itemKey(item));
  const union = (a: string[], b: string[]) => {
    const seen = new Set(a.map(itemKey));
    return [...a, ...b.filter((x) => !seen.has(itemKey(x)) && seen.add(itemKey(x)))];
  };
  const allItems = union(
    ignored[IGNORE_ALL_KEY] ?? [],
    stores.flatMap((s) => s.items ?? []),
  ).sort((a, b) => a.localeCompare(b));

  const chip = (key: string, item: string, opts: { lockedByAll?: boolean } = {}) => {
    const off = opts.lockedByAll || has(key, item);
    return (
      <button
        key={`${key}-${item}`}
        type="button"
        disabled={opts.lockedByAll}
        title={
          opts.lockedByAll
            ? "Ignored at all stores — turn it back on in the All stores row"
            : off
              ? "Ignored — tap to alert again"
              : "Tap to leave out of the alert"
        }
        onClick={() => onToggle(key, item)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition",
          off
            ? "border-border/80 bg-muted text-muted-foreground line-through"
            : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
          opts.lockedByAll && "cursor-not-allowed opacity-60",
        )}
      >
        {item}
        {off && !opts.lockedByAll ? <span className="no-underline text-[10px] font-normal">· ignored</span> : null}
      </button>
    );
  };

  const ignoredCount = Object.values(ignored).reduce((n, l) => n + l.length, 0);

  return (
    <div className="rounded-lg border border-border/70">
      {/* Hidden inputs stay mounted while collapsed so Save keeps the list. */}
      {Object.entries(ignored).flatMap(([key, list]) =>
        list.map((item) => <input key={`${key}|${item}`} type="hidden" name="ignored_items" value={`${key}|${item}`} />),
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-sm font-medium">Items to leave out of the alert</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            ignoredCount ? "bg-info/10 text-info" : "bg-muted text-muted-foreground",
          )}
        >
          {ignoredCount ? `${ignoredCount} ignored` : "none"}
        </span>
        <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-border/70 px-3 py-3">
          <p className="text-[11px] text-muted-foreground">
            Tap an item to ignore it (e.g. something a store doesn&apos;t carry). Tap again to alert on it again. Only affects the
            Sling message — Toast isn&apos;t changed.
          </p>
          <div className="divide-y divide-border/60 rounded-lg border border-border/70">
            <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start">
              <div className="w-40 shrink-0">
                <p className="text-sm font-medium">All stores</p>
                <p className="text-[11px] text-muted-foreground">ignore everywhere</p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {allItems.length ? (
                  allItems.map((i) => chip(IGNORE_ALL_KEY, i))
                ) : (
                  <span className="text-xs text-muted-foreground">Nothing out of stock</span>
                )}
              </div>
            </div>
            {stores.map((s) => {
              const items = union(s.items ?? [], ignored[s.guid] ?? []);
              return (
                <div key={s.guid} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-start">
                  <div className="w-40 shrink-0">
                    <p className="text-sm font-medium">{label(s.name)}</p>
                    <p className="text-[11px] text-muted-foreground">only this store</p>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {items.length ? (
                      items.map((i) =>
                        chip(s.guid, i, {
                          lockedByAll: has(IGNORE_ALL_KEY, i) && !has(s.guid, i),
                        }),
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">{s.error ? "Couldn't read Toast" : "All in stock"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RouteRow({
  title,
  hint,
  fieldName,
  valueFor,
  selected,
  chats,
  onChange,
}: {
  title: string;
  hint: string;
  fieldName: string;
  valueFor: (chatId: string) => string;
  selected: string[];
  chats: Chat[];
  onChange: (ids: string[]) => void;
}) {
  const nameOf = (id: string) => chats.find((c) => c.id === id)?.name ?? `Chat #${id}`;
  const available = chats.filter((c) => !selected.includes(c.id));
  const teams = available.filter((c) => /\bteam\b/i.test(c.name));
  const others = available.filter((c) => !/\bteam\b/i.test(c.name));

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-info/10 py-0.5 pl-2.5 pr-1 text-xs text-info">
            {nameOf(id)}
            <input type="hidden" name={fieldName} value={valueFor(id)} />
            <button
              type="button"
              aria-label={`Remove ${nameOf(id)}`}
              onClick={() => onChange(selected.filter((x) => x !== id))}
              className="rounded-full p-0.5 hover:bg-info/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {available.length ? (
          <select
            value=""
            onChange={(e) => e.target.value && onChange([...selected, e.target.value])}
            className="h-7 max-w-[14rem] rounded-lg border border-dashed border-border/80 bg-background px-2 text-xs text-muted-foreground outline-none focus:border-info/60"
          >
            <option value="">+ Add chat…</option>
            {teams.length ? (
              <optgroup label="Store team chats">
                {teams.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {others.length ? (
              <optgroup label="Other chats">
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        ) : null}
        {!selected.length && !available.length ? <span className="text-xs text-muted-foreground">No chats available</span> : null}
      </div>
    </div>
  );
}

function RunResult({ result }: { result: OutOfStockAlertResult }) {
  const heading =
    result.status === "preview"
      ? `Preview — ${result.messages.length} message(s)`
      : result.status === "sent"
        ? `Sent ${result.posted} message(s)`
        : result.status === "partial"
          ? `Sent ${result.posted} of ${result.messages.length}`
          : result.status === "failed"
            ? "Failed"
            : "Nothing sent";
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
      <p
        className={cn("text-xs font-medium", result.status === "failed" || result.status === "partial" ? "text-destructive" : "")}
      >
        {heading}
        {result.reason ? <span className="font-normal text-muted-foreground"> · {result.reason}</span> : null}
      </p>
      {result.errors.map((e) => (
        <p key={e} className="text-xs text-destructive">
          {e}
        </p>
      ))}
      {result.messages.map((m, i) => (
        <div key={`${m.chatId}-${i}`} className="space-y-1">
          <p className="text-[11px] text-muted-foreground">
            → <span className="font-medium text-foreground">{m.chatName}</span>
            {m.storeName ? ` (${m.storeName} only)` : " (all stores)"}
          </p>
          <pre className="whitespace-pre-wrap rounded-md bg-background p-2 font-sans text-xs">{m.content}</pre>
        </div>
      ))}
    </div>
  );
}
