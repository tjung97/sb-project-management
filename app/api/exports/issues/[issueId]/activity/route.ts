import { NextResponse } from "next/server";
import { listIssueActivity } from "@/src/lib/ops/data";
import { activityToCsvRows, toCsv } from "@/src/lib/ops/export";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const events = await listIssueActivity(issueId);
  const csv = toCsv(activityToCsvRows(events));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="issue-${issueId}-activity.csv"`,
    },
  });
}
