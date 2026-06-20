import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { clearSlingCache } from "@/src/lib/sling/api";
import { clearToastStockCache, clearToastSummaryCache } from "@/src/lib/toast/api";

export const dynamic = "force-dynamic";

// Busts the in-memory Sling snapshot + Toast stock caches so the next render of
// the operations page fetches fresh data. The client follows this with
// router.refresh().
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  clearSlingCache();
  clearToastStockCache();
  clearToastSummaryCache();
  return NextResponse.json({ ok: true });
}
