function key(issueId: string) {
  return `issue-viewed:${issueId}`;
}

export function markIssueRead(issueId: string) {
  try {
    localStorage.setItem(key(issueId), Date.now().toString());
  } catch {}
}

export function getIssueViewedAt(issueId: string): number | null {
  try {
    const stored = localStorage.getItem(key(issueId));
    return stored ? Number(stored) : null;
  } catch {
    return null;
  }
}
