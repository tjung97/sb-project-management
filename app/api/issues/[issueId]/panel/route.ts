import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getIssue, listIssueComments } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

// Lightweight issue snapshot for the issue-map side panel: core fields plus the
// discussion thread, serialized for the client.
export async function GET(_request: Request, { params }: { params: Promise<{ issueId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { issueId } = await params;
  const issue = await getIssue(issueId);
  if (!issue) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const comments = await listIssueComments(issueId);

  return NextResponse.json({
    issue: {
      id: issue.id,
      number: issue.issue_number ?? null,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      kind: issue.kind,
      checklistTotal: issue.checklist_total,
      checklistDone: issue.checklist_done,
      dueMs: issue.due_at ? issue.due_at.toMillis() : null,
    },
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      authorName: comment.author_name,
      createdMs: comment.created_at ? comment.created_at.toMillis() : null,
      attachments: (comment.attachments ?? []).map((a) => ({ name: a.name, url: a.url, kind: a.kind })),
    })),
  });
}
