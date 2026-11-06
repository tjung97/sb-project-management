import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { runOutOfStockAlert } from "@/src/lib/ops/out-of-stock-alert";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily out-of-stock → Sling alert. Hit every 15 min by the `outOfStockAlert`
// Firebase function; sends only when the Operations-tab settings say it's time.
// Auth: ?key=<CRON_SECRET>, or a logged-in admin.
//   ?preview=1   build the messages without sending
//   ?force=1     send now, ignoring the schedule
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const secret = process.env.CRON_SECRET;
  const viaKey = Boolean(secret) && params.get("key") === secret;
  if (!viaKey) {
    const user = await getCurrentUser();
    if (user?.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runOutOfStockAlert({
    preview: params.get("preview") === "1",
    force: params.get("force") === "1",
  });
  console.log(
    `[out-of-stock] ${result.nowLocal} ${result.status}${result.reason ? ` — ${result.reason}` : ""} ` +
      `(${result.posted}/${result.messages.length} posted)${result.errors.length ? ` errors: ${result.errors.join(" | ")}` : ""}`
  );
  return NextResponse.json(result);
}
