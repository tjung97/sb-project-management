import "server-only";

import { adminDb } from "@/src/lib/firebase/admin";

// Labor-cost % targets (labor cost ÷ sales). A single default plus optional
// per-store overrides, editable from the Operations tab.

export interface LaborTargets {
  defaultPct: number;
  perStore: Record<string, number>; // store guid -> target %
}

export const DEFAULT_LABOR_TARGETS: LaborTargets = { defaultPct: 25, perStore: {} };

export async function getLaborTargets(): Promise<LaborTargets> {
  try {
    const snap = await adminDb.collection("ops_config").doc("labor_targets").get();
    if (!snap.exists) return DEFAULT_LABOR_TARGETS;
    const d = snap.data() ?? {};
    const defaultPct = typeof d.default_pct === "number" && d.default_pct > 0 ? d.default_pct : 25;
    const perStore: Record<string, number> = {};
    if (d.per_store && typeof d.per_store === "object") {
      for (const [guid, v] of Object.entries(d.per_store as Record<string, unknown>)) {
        if (typeof v === "number" && v > 0) perStore[guid] = v;
      }
    }
    return { defaultPct, perStore };
  } catch {
    return DEFAULT_LABOR_TARGETS;
  }
}

export function targetFor(targets: LaborTargets, guid: string): number {
  return targets.perStore[guid] ?? targets.defaultPct;
}
