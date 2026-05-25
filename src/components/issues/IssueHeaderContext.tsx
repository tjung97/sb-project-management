"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { IssuePriority, IssueStatus } from "@/src/types/firestore";

export type IssueHeaderState = {
  issueId: string;
  title: string;
  issueNumber: string;
  status: IssueStatus;
  priority: IssuePriority;
  priorityProminent: boolean;
  compact: boolean;
};

type IssueHeaderContextValue = {
  state: IssueHeaderState | null;
  registerIssue: (data: Omit<IssueHeaderState, "compact">) => void;
  setCompact: (compact: boolean) => void;
  clearIssue: () => void;
};

const IssueHeaderContext = createContext<IssueHeaderContextValue | null>(null);

export function IssueHeaderProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<IssueHeaderState | null>(null);

  const registerIssue = useCallback((data: Omit<IssueHeaderState, "compact">) => {
    setState((prev) => ({ ...data, compact: prev?.issueId === data.issueId ? prev.compact : false }));
  }, []);

  const setCompact = useCallback((compact: boolean) => {
    setState((prev) => (prev ? { ...prev, compact } : null));
  }, []);

  const clearIssue = useCallback(() => setState(null), []);

  const value = useMemo(
    () => ({ state, registerIssue, setCompact, clearIssue }),
    [state, registerIssue, setCompact, clearIssue]
  );

  return <IssueHeaderContext.Provider value={value}>{children}</IssueHeaderContext.Provider>;
}

export function useIssueHeader() {
  const ctx = useContext(IssueHeaderContext);
  if (!ctx) {
    throw new Error("useIssueHeader must be used within IssueHeaderProvider");
  }
  return ctx;
}
