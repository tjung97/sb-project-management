"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

export function SlingRefreshButton({ computedAt }: { computedAt?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      await fetch("/api/sling/refresh", { method: "POST" });
    } catch {
      /* still refresh the view */
    } finally {
      setBusy(false);
      startTransition(() => router.refresh());
    }
  };

  const loading = busy || pending;

  return (
    <div className="flex items-center gap-3">
      {/* suppressHydrationWarning: relative time depends on Date.now(), so the
          server and client renders can straddle a minute boundary. */}
      {computedAt ? (
        <span suppressHydrationWarning className="text-[11px] text-muted-foreground">
          Updated {formatRelative(computedAt)}
        </span>
      ) : null}
      <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
        <RotateCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
        {loading ? "Refreshing" : "Refresh"}
      </Button>
    </div>
  );
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.round(diffMin / 60);
  return `${hours}h ago`;
}
