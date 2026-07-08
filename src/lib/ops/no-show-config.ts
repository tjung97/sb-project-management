import "server-only";

import { adminDb } from "@/src/lib/firebase/admin";

// Firestore-backed no-show alert settings, editable from the Operations tab.
// Defaults make it live out of the box: enabled, all stores, 30-min grace, using
// the SLACK_WEBHOOK_URL env value.

export interface NoShowConfig {
  enabled: boolean;
  graceMinutes: number;
  /** null/empty => fall back to the SLACK_WEBHOOK_URL env value. */
  webhookUrl: string | null;
  /** "all" alerts every store; otherwise the list of Sling store names to alert. */
  storeScope: "all" | string[];
  /** lowercased role names to never alert on (e.g. "owner"). */
  excludeRoles: string[];
}

export const DEFAULT_NO_SHOW_CONFIG: NoShowConfig = {
  enabled: true,
  graceMinutes: 30,
  webhookUrl: null,
  storeScope: "all",
  excludeRoles: [],
};

const CONFIG_DOC = { collection: "ops_config", doc: "no_show" } as const;

export async function getNoShowConfig(): Promise<NoShowConfig> {
  try {
    const snap = await adminDb.collection(CONFIG_DOC.collection).doc(CONFIG_DOC.doc).get();
    if (!snap.exists) return DEFAULT_NO_SHOW_CONFIG;
    const d = snap.data() ?? {};
    return {
      enabled: d.enabled !== false,
      graceMinutes: typeof d.grace_minutes === "number" && d.grace_minutes >= 0 ? Math.trunc(d.grace_minutes) : 30,
      webhookUrl: typeof d.webhook_url === "string" && d.webhook_url.trim() ? d.webhook_url.trim() : null,
      storeScope:
        d.store_scope === "all" || !Array.isArray(d.store_scope) ? "all" : (d.store_scope as unknown[]).map((s) => String(s)),
      excludeRoles: Array.isArray(d.exclude_roles) ? (d.exclude_roles as unknown[]).map((r) => String(r).toLowerCase().trim()).filter(Boolean) : [],
    };
  } catch {
    return DEFAULT_NO_SHOW_CONFIG;
  }
}
