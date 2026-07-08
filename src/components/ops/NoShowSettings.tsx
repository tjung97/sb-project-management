"use client";

import { useState, useTransition } from "react";
import { BellRing, Check, ChevronDown, Loader2 } from "lucide-react";
import { updateNoShowConfig } from "@/src/lib/ops/actions";
import { cn } from "@/src/lib/utils";
import type { NoShowConfig } from "@/src/lib/ops/no-show-config";

// Operations-tab settings for the no-show → Slack alerts. Admin-only.
export function NoShowSettings({ config, storeNames }: { config: NoShowConfig; storeNames: string[] }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [enabled, setEnabled] = useState(config.enabled);
  const [scopeAll, setScopeAll] = useState(config.storeScope === "all");
  const selectedStores = new Set(config.storeScope === "all" ? [] : config.storeScope);

  function onSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      await updateNoShowConfig(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <BellRing className={cn("h-4 w-4", enabled ? "text-info" : "text-muted-foreground")} />
        <span className="text-sm font-semibold">No-show alerts</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          )}
        >
          {enabled ? "On" : "Off"}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {config.graceMinutes}m grace · {config.storeScope === "all" ? "all stores" : `${config.storeScope.length} store(s)`}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <form action={onSubmit} className="space-y-4 border-t border-border/70 px-4 py-4">
          {/* enabled */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={config.enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-medium">Post no-show alerts to Slack</span>
          </label>

          {/* grace */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground" htmlFor="grace_minutes">
              Grace period
            </label>
            <input
              id="grace_minutes"
              name="grace_minutes"
              type="number"
              min={0}
              max={180}
              defaultValue={config.graceMinutes}
              className="h-8 w-20 rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60"
            />
            <span className="text-sm text-muted-foreground">minutes after shift start</span>
          </div>

          {/* webhook */}
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground" htmlFor="webhook_url">
              Slack webhook <span className="text-[11px]">(leave blank to use the server default)</span>
            </label>
            <input
              id="webhook_url"
              name="webhook_url"
              type="text"
              defaultValue={config.webhookUrl ?? ""}
              placeholder="https://hooks.slack.com/services/…"
              className="h-8 w-full rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60"
            />
          </div>

          {/* store scope */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="store_scope_all"
                defaultChecked={config.storeScope === "all"}
                onChange={(e) => setScopeAll(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="font-medium">Alert for all stores</span>
            </label>
            {!scopeAll ? (
              <div className="grid grid-cols-2 gap-1.5 pl-6 sm:grid-cols-3">
                {storeNames.map((name) => (
                  <label key={name} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      name="store_scope"
                      value={name}
                      defaultChecked={selectedStores.has(name)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    <span className="truncate">{name}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {/* exclude roles */}
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground" htmlFor="exclude_roles">
              Never alert these roles <span className="text-[11px]">(comma-separated, e.g. Owner, General Manager)</span>
            </label>
            <input
              id="exclude_roles"
              name="exclude_roles"
              type="text"
              defaultValue={config.excludeRoles.join(", ")}
              placeholder="Owner, General Manager"
              className="h-8 w-full rounded-lg border border-border/80 bg-background px-2 text-sm outline-none focus:border-info/60"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save settings
            </button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-xs text-success">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
