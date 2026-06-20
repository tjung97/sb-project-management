import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getToastItemHistory } from "@/src/lib/toast/api";

export const dynamic = "force-dynamic";
// Aggregating 3 months of orders can take a while on a cold cache.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return NextResponse.json({ error: "Missing item name." }, { status: 400 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(Math.trunc(daysParam), 180) : 90;
  const guid = request.nextUrl.searchParams.get("guid")?.trim() || undefined;

  const history = await getToastItemHistory(name, guid, new Date(), days);
  if (history.error) {
    return NextResponse.json(history, { status: 502 });
  }

  return NextResponse.json(history);
}
