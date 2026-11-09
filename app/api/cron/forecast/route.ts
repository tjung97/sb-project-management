import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getToastLocations } from "@/src/lib/toast/api";
import { computeAndSaveStoreForecast } from "@/src/lib/toast/forecast";

export const dynamic = "force-dynamic";
// A single store's forecast fetches ~6 weeks of orders; keep headroom.
export const maxDuration = 300;

// Computes + caches the sales forecast. Heavy, so it runs on a schedule (weekly)
// and the dashboard reads the cached Firestore result. Usage:
//   ?list=1            -> just the store list (for the scheduler to fan out)
//   ?store=<guid>      -> compute one store (how the scheduler calls it)
//   (no param)         -> compute every store sequentially (manual; slow)
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  const user = await getCurrentUser();
  if (!(user || (secret && key === secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locations = await getToastLocations();
  if (request.nextUrl.searchParams.get("list") === "1") {
    return NextResponse.json({ stores: locations.map((l) => ({ guid: l.guid, name: l.name })) });
  }

  const storeParam = request.nextUrl.searchParams.get("store");
  const targets = storeParam ? locations.filter((l) => l.guid === storeParam) : locations;
  if (!targets.length) {
    return NextResponse.json({ error: "No matching store." }, { status: 404 });
  }

  const results = [];
  for (const loc of targets) {
    try {
      const f = await computeAndSaveStoreForecast(loc.guid, loc.name);
      results.push({
        store: loc.name,
        thisWeek: f.thisWeek.total,
        nextWeek: f.nextWeek.total,
        lastYear: f.lastYearThisWeek.total,
      });
    } catch (error) {
      results.push({ store: loc.name, error: error instanceof Error ? error.message : "failed" });
    }
  }

  return NextResponse.json({ computed: results.length, results });
}
