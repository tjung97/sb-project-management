"use client";

import { useEffect, useRef } from "react";
import { useIssueHeader } from "@/src/components/issues/IssueHeaderContext";
import type { IssueHeaderState } from "@/src/components/issues/IssueHeaderContext";

function headerRootMargin() {
  const height = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-header-height")) || 116;
  return `-${height}px 0px 0px 0px`;
}

export function IssuePageHeader({
  issue,
  children,
}: {
  issue: Omit<IssueHeaderState, "compact">;
  children: React.ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { registerIssue, setCompact, clearIssue } = useIssueHeader();
  const compactRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    registerIssue(issue);
    return () => clearIssue();
  }, [
    issue.issueId,
    issue.title,
    issue.issueNumber,
    issue.status,
    issue.priority,
    issue.priorityProminent,
    registerIssue,
    clearIssue,
  ]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let observer: IntersectionObserver | null = null;

    const applyCompact = (next: boolean) => {
      if (compactRef.current === next) return;
      compactRef.current = next;
      setCompact(next);
    };

    const mountObserver = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(([entry]) => {
        const next = !entry.isIntersecting;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => applyCompact(next), 50);
      }, {
        threshold: 0,
        rootMargin: headerRootMargin(),
      });
      observer.observe(sentinel);
    };

    mountObserver();
    window.addEventListener("resize", mountObserver);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", mountObserver);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [setCompact]);

  return (
    <>
      <div ref={sentinelRef} className="issue-page-header-sentinel" aria-hidden />
      <header className="issue-page-header-static">{children}</header>
    </>
  );
}
