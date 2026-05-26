"use client";

import { useEffect } from "react";
import { markIssueRead } from "@/src/lib/ops/issue-read-state";

export function IssueReadMarker({ issueId }: { issueId: string }) {
  useEffect(() => {
    markIssueRead(issueId);
  }, [issueId]);

  return null;
}
