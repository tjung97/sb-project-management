import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { detectNoShows, notifyNoShows, type NotifyResult } from "@/src/lib/ops/no-show";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Detects no-shows. LOGS by default (dry run); pass ?notify=1 to also send Slack.
// Trigger while logged in, or with ?key=<CRON_SECRET>. Knobs:
//   ?now=2026-07-06T07:35:00-07:00   pretend it's this instant
//   ?grace=30                         minutes past shift start before flagging
//   ?notify=1                         send Slack alerts (needs SLACK_WEBHOOK_URL)
//   ?force=1                          re-send even if already alerted today
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  const user = await getCurrentUser();
  const authorized = Boolean(user) || (secret && key === secret);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const graceParam = Number(request.nextUrl.searchParams.get("grace"));
  const graceMin = Number.isFinite(graceParam) && graceParam >= 0 ? Math.trunc(graceParam) : undefined;

  const nowParam = request.nextUrl.searchParams.get("now");
  const parsedNow = nowParam ? new Date(nowParam) : null;
  const now = parsedNow && !Number.isNaN(parsedNow.getTime()) ? parsedNow : undefined;

  const notify = request.nextUrl.searchParams.get("notify") === "1";
  const force = request.nextUrl.searchParams.get("force") === "1";

  const report = await detectNoShows({ now, graceMin });

  const lines = report.stores.flatMap((store) =>
    store.scheduled
      .filter((p) => p.status === "no_show")
      .map((p) => `  • ${store.slingStore}: ${p.person} (${p.role}) sched ${p.start}, ${p.overdueMin}m overdue${p.opening ? " [OPENING]" : ""}`)
  );
  console.log(
    `[no-show${notify ? "" : " dry-run"}] ${report.nowLocal} grace=${report.graceMin}m — ${report.totals.noShows} no-show(s), ` +
      `${report.totals.scheduled} scheduled, ${report.totals.unmatchedStores} unverified store(s)` +
      (lines.length ? `\n${lines.join("\n")}` : "")
  );

  let notified: NotifyResult | null = null;
  if (notify) notified = await notifyNoShows(report, { force });

  return NextResponse.json({ dryRun: !notify, notified, ...report });
}
