import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { listIssues, listProjects } from "@/src/lib/ops/data";
import type { CommandPaletteSearchIssue, CommandPaletteSearchProject } from "@/src/lib/ops/command-palette";

export const dynamic = "force-dynamic";

function filterProjects(projects: Awaited<ReturnType<typeof listProjects>>, q: string): CommandPaletteSearchProject[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];

  return projects
    .filter((project) => project.title.toLowerCase().includes(needle))
    .slice(0, 8)
    .map((project) => ({ id: project.id, title: project.title }));
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ issues: [], projects: [] });
  }

  const [issues, projects] = await Promise.all([
    listIssues({ q, status: "all" }, 12),
    listProjects(),
  ]);

  const issueResults: CommandPaletteSearchIssue[] = issues.map((issue) => ({
    id: issue.id,
    title: issue.title,
    issue_number: issue.issue_number ?? null,
    status: issue.status,
  }));

  const projectResults = filterProjects(projects, q);

  return NextResponse.json({ issues: issueResults, projects: projectResults });
}
