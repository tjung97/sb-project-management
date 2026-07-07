"use client";

import { useCallback, useReducer, useSyncExternalStore } from "react";
import Link from "next/link";
import { PackageX, X } from "lucide-react";
import type { StockOutageEvent } from "@/src/lib/ops/stock-events";

const DISMISS_KEY = "stock-alert-dismissed-until";

function readDismissed(): number {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0);
  } catch {
    return 0;
  }
}

// Floating popup that appears when items were recently 86'd in Toast. Shows what
// and where and when; "who" isn't exposed by the Toast API. Dismissing hides
// events at/below the newest one until something newer comes in.
export function StockAlertBanner({ events }: { events: StockOutageEvent[] }) {
  const [, force] = useReducer((n: number) => n + 1, 0);
  const subscribe = useCallback((cb: () => void) => {
    window.addEventListener("storage", cb);
    return () => window.removeEventListener("storage", cb);
  }, []);
  // Server renders nothing (MAX = "dismissed"); the real value is read on the
  // client, so there's no hydration mismatch and no setState-in-effect.
  const dismissedUntil = useSyncExternalStore(subscribe, readDismissed, () => Number.MAX_SAFE_INTEGER);

  const newestMs = events[0]?.outSinceMs ?? 0;
  const visible = events.length > 0 && newestMs > dismissedUntil;

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(newestMs));
    } catch {
      /* ignore */
    }
    force();
  }, [newestMs]);

  if (!visible) return null;

  const shown = events.slice(0, 5);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(92vw,22rem)]">
      <div className="stock-pop pointer-events-auto overflow-hidden rounded-xl border border-destructive/40 bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-3 py-2">
          <span className="live-dot text-destructive">
            <PackageX className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-destructive">
            Recently out of stock{events.length > 1 ? ` · ${events.length}` : ""}
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="ml-auto rounded-md p-1 text-muted-foreground transition hover:bg-background/60 hover:text-foreground"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto">
          {shown.map((event, i) => (
            <li
              key={event.id}
              className="stock-pop-row flex items-start gap-2.5 px-3 py-2.5"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{event.itemName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{shortName(event.locationName)}</span> · {relative(event.outSinceMs)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
          <span className="text-[10px] text-muted-foreground">Toast doesn&apos;t report who 86&apos;d it</span>
          <Link href="/operations" className="text-xs font-medium text-info transition hover:underline">
            View all →
          </Link>
        </div>
      </div>
    </div>
  );
}

function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}

function relative(ms: number) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 2) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
