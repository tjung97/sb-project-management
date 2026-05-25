import { NextResponse } from "next/server";
import { listAllIssuesForExport, listLocations, listProjects, listUserProfiles } from "@/src/lib/ops/data";
import { issuesToCsvRows, toCsv } from "@/src/lib/ops/export";
import type { IssueFilters } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters: IssueFilters = {
    status: (url.searchParams.get("status") as IssueFilters["status"]) ?? "all",
    assignee: url.searchParams.get("assignee") ?? undefined,
    unassigned: url.searchParams.get("unassigned") === "1",
    location: url.searchParams.get("location") ?? undefined,
    project: url.searchParams.get("project") ?? undefined,
    priority: (url.searchParams.get("priority") as IssueFilters["priority"]) ?? undefined,
    due: (url.searchParams.get("due") as IssueFilters["due"]) ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  };
  const [issues, users, locations, projects] = await Promise.all([
    listAllIssuesForExport(filters),
    listUserProfiles(),
    listLocations(),
    listProjects(),
  ]);
  const csv = toCsv(issuesToCsvRows({ issues, users, locations, projects }));
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="seoul-bowl-issues.csv"`,
    },
  });
}
