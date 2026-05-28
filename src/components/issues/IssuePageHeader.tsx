"use client";

import { useEffect, useMemo, useRef } from "react";
import { useIssueHeader } from "@/src/components/issues/IssueHeaderContext";
import type { IssueHeaderState } from "@/src/components/issues/IssueHeaderContext";

// Slightly longer than the CSS transition (350ms) so we remount after layout settles.
const COMPACT_TRANSITION_MS = 420;

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
  const remountRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registeredIssue = useMemo(
    () => ({
      issueId: issue.issueId,
      title: issue.title,
      issueNumber: issue.issueNumber,
      status: issue.status,
      priority: issue.priority,
      priorityProminent: issue.priorityProminent,
    }),
    [
      issue.issueId,
      issue.title,
      issue.issueNumber,
      issue.status,
      issue.priority,
      issue.priorityProminent,
    ]
  );

  useEffect(() => {
    registerIssue(registeredIssue);
    return () => clearIssue();
  }, [registeredIssue, registerIssue, clearIssue]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let observer: IntersectionObserver | null = null;

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

    const applyCompact = (next: boolean) => {
      if (compactRef.current === next) return;
      compactRef.current = next;
      setCompact(next);

      // Disconnect immediately so the sticky-header height change (grid-template-rows
      // transition, ~350ms) cannot shift page content and re-trigger the observer,
      // which would cause the header to oscillate up and down. Remount after the
      // transition fully settles so the fresh --app-header-height is used.
      observer?.disconnect();
      if (remountRef.current) clearTimeout(remountRef.current);
      remountRef.current = setTimeout(mountObserver, COMPACT_TRANSITION_MS);
    };

    mountObserver();
    window.addEventListener("resize", mountObserver);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", mountObserver);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (remountRef.current) clearTimeout(remountRef.current);
    };
  }, [setCompact]);

  return (
    <>
      <div ref={sentinelRef} className="issue-page-header-sentinel" aria-hidden />
      <header className="issue-page-header-static">{children}</header>
    </>
  );
}
