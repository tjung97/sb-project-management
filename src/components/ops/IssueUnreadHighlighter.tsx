"use client";

import { useEffect } from "react";
import { getIssueViewedAt } from "@/src/lib/ops/issue-read-state";

export function IssueUnreadHighlighter() {
  useEffect(() => {
    const rows = document.querySelectorAll<HTMLElement>("[data-issue-id]");
    rows.forEach((el) => {
      const id = el.dataset.issueId!;
      const updatedAt = Number(el.dataset.updatedAt);
      const viewedAt = getIssueViewedAt(id);
      const isUnread = viewedAt === null || updatedAt > viewedAt;
      el.classList.toggle("issue-unread", isUnread);
    });
  }, []);

  return null;
}
