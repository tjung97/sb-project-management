"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronRight, Clock, ImageIcon, MessageSquare, TriangleAlert } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { cn } from "@/src/lib/utils";
import type { ChecklistSlot, SlingMessageView, SlotStatus, StoreMonitor, StoreOverall } from "@/src/lib/sling/api";

// Store | Status | Checklist | Coverage | Schedule | Last | chevron
const COLS = "minmax(150px,1.6fr) 92px 168px minmax(104px,1fr) minmax(128px,1.1fr) 64px 28px";
const STALE_MS = 8 * 60 * 60 * 1000;

const SEVERITY: Record<StoreOverall, number> = { alert: 0, attention: 1, ok: 2 };

export function SlingMonitorBoard({ stores }: { stores: StoreMonitor[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...stores].sort((a, b) => SEVERITY[a.overall] - SEVERITY[b.overall] || a.name.localeCompare(b.name));

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-[840px]">
          {/* Header */}
          <div
            className="grid items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-[11px] font-medium text-muted-foreground"
            style={{ gridTemplateColumns: COLS }}
          >
            <span>Store</span>
            <span>Status</span>
            <span>Checklist today</span>
            <span>Coverage</span>
            <span>Schedule T / N</span>
            <span>Last post</span>
            <span />
          </div>

          {/* Rows */}
          {sorted.map((store) => (
            <StoreRow
              key={store.sourceId}
              store={store}
              open={openId === store.sourceId}
              onToggle={() => setOpenId((id) => (id === store.sourceId ? null : store.sourceId))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StoreRow({ store, open, onToggle }: { store: StoreMonitor; open: boolean; onToggle: () => void }) {
  const meta = OVERALL_META[store.overall];
  const stale = isStale(store.lastPostAt);
  const gapLabel = store.schedule.coverageGaps[0]
    ? `${store.schedule.coverageGaps[0].weekday} ${store.schedule.coverageGaps[0].ranges[0]}`
    : null;
  const gapTitle = store.schedule.coverageGaps.map((g) => `${g.weekday} ${g.ranges.join(", ")}`).join(" · ");

  return (
    <div className={cn("border-b border-border/60 last:border-b-0", open && "bg-accent/20")}>
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-accent/30"
        style={{ gridTemplateColumns: COLS }}
      >
        {/* Store */}
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
          <span className="truncate text-sm font-semibold">{store.name}</span>
        </div>

        {/* Status */}
        <div>
          <Badge variant={meta.badge} className="gap-1">
            {store.overall === "alert" ? <AlertTriangle className="h-3 w-3" /> : null}
            {meta.label}
          </Badge>
        </div>

        {/* Checklist */}
        <div className="flex items-center gap-1">
          {store.checklist.map((slot) => (
            <ChecklistDot key={slot.key} slot={slot} />
          ))}
        </div>

        {/* Coverage */}
        <div className="text-xs">
          {gapLabel ? (
            <span className="inline-flex items-center gap-1 font-medium text-destructive" title={gapTitle}>
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{gapLabel}</span>
            </span>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </div>

        {/* Schedule */}
        <div className="flex items-center gap-2 text-xs">
          <span className="tabular-nums">
            <span className="font-medium">{store.schedule.thisWeekPublished}</span>
            <span className="text-muted-foreground"> / {store.schedule.nextWeekPublished}</span>
          </span>
          <ScheduleBadge state={store.schedule.state} />
        </div>

        {/* Last post — Date.now()-relative, so server/client renders can differ
            by a minute tick; suppress the hydration diff on this element. */}
        <div
          suppressHydrationWarning
          className={cn("text-xs tabular-nums", stale ? "font-medium text-destructive" : "text-muted-foreground")}
        >
          {store.lastPostAt ? relative(store.lastPostAt) : "none"}
        </div>

        {/* Chevron */}
        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>

      {open ? <StoreDetail store={store} /> : null}
    </div>
  );
}

function StoreDetail({ store }: { store: StoreMonitor }) {
  return (
    <div className="grid gap-4 border-t border-border/60 bg-background/40 px-4 py-3 lg:grid-cols-[minmax(0,320px)_1fr]">
      {/* Left: checklist + coverage detail */}
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Checklist detail</p>
          <ul className="space-y-1">
            {store.checklist.map((slot) => (
              <li key={slot.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded-sm", SLOT_TONE[slot.status].box)}>
                    {slot.status === "done" ? (
                      <Check className="h-2.5 w-2.5" />
                    ) : slot.status === "missed" ? (
                      <AlertTriangle className="h-2.5 w-2.5" />
                    ) : (
                      <Clock className="h-2.5 w-2.5" />
                    )}
                  </span>
                  {slot.label}
                  {slot.photo ? <ImageIcon className="h-3 w-3 text-muted-foreground/60" /> : null}
                </span>
                <span className="text-muted-foreground">
                  {slot.at ? relative(slot.at) : SLOT_WORD[slot.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {store.schedule.coverageGaps.length ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            <p className="mb-1 flex items-center gap-1 font-medium">
              <TriangleAlert className="h-3.5 w-3.5" /> Uncovered store hours
            </p>
            <ul className="space-y-0.5">
              {store.schedule.coverageGaps.map((gap) => (
                <li key={gap.weekday}>
                  {gap.weekday}: {gap.ranges.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Right: recent activity */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <MessageSquare className="h-3 w-3" /> Recent activity
        </p>
        {store.lastMessages.length ? (
          <ul className="space-y-2">
            {store.lastMessages.slice(0, 5).map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No messages synced yet.</p>
        )}
      </div>
    </div>
  );
}

function ChecklistDot({ slot }: { slot: ChecklistSlot }) {
  const tone = SLOT_TONE[slot.status];
  return (
    <span
      // title embeds a Date.now()-relative time — suppress the hydration diff.
      suppressHydrationWarning
      className={cn("flex h-5 w-5 items-center justify-center rounded-md border", tone.box)}
      title={`${slot.label}: ${SLOT_WORD[slot.status]}${slot.at ? ` (${relative(slot.at)})` : ""}`}
    >
      {slot.status === "done" ? (
        <Check className="h-3 w-3" />
      ) : slot.status === "missed" ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <Clock className="h-2.5 w-2.5" />
      )}
    </span>
  );
}

function MessageRow({ message }: { message: SlingMessageView }) {
  return (
    <li className="flex gap-2 text-xs">
      <Avatar name={message.author} url={message.avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium">{message.author ?? "Unknown"}</span>
          {message.createdAt ? <span className="shrink-0 text-[10px] text-muted-foreground">{relative(message.createdAt)}</span> : null}
        </div>
        {message.content ? <p className="line-clamp-2 text-muted-foreground">{message.content}</p> : null}
        {message.images.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.images.slice(0, 6).map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Store post" className="h-12 w-12 rounded-md border border-border/70 object-cover" loading="lazy" />
              </a>
            ))}
            {message.images.length > 6 ? (
              <span className="flex h-12 w-12 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-[10px] text-muted-foreground">
                +{message.images.length - 6}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Avatar({ name, url }: { name: string | null; url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? ""} className="h-6 w-6 shrink-0 rounded-full object-cover" loading="lazy" />;
  }
  const initials = (name ?? "?")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
      {initials}
    </span>
  );
}

function ScheduleBadge({ state }: { state: StoreMonitor["schedule"]["state"] }) {
  const map = {
    posted: { label: "Posted", variant: "success" as const },
    partial: { label: "Partial", variant: "warning" as const },
    missing: { label: "Not posted", variant: "destructive" as const },
    unknown: { label: "No match", variant: "muted" as const },
  };
  const m = map[state];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

const OVERALL_META: Record<StoreOverall, { label: string; dot: string; badge: "success" | "warning" | "destructive" }> = {
  ok: { label: "On track", dot: "bg-success", badge: "success" },
  attention: { label: "Attention", dot: "bg-warning", badge: "warning" },
  alert: { label: "Alert", dot: "bg-destructive", badge: "destructive" },
};

const SLOT_TONE: Record<SlotStatus, { box: string }> = {
  done: { box: "border-success/30 bg-success/10 text-success" },
  due: { box: "border-warning/40 bg-warning/10 text-warning-foreground" },
  upcoming: { box: "border-border bg-muted/40 text-muted-foreground" },
  missed: { box: "border-destructive/40 bg-destructive/10 text-destructive" },
};

const SLOT_WORD: Record<SlotStatus, string> = {
  done: "done",
  due: "due now",
  upcoming: "upcoming",
  missed: "missed",
};

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  const then = new Date(iso).getTime();
  return Number.isNaN(then) || Date.now() - then > STALE_MS;
}

function relative(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.round((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
