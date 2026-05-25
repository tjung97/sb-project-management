"use client";

import { createContext, useContext, useState } from "react";

const IssuesToolbarContext = createContext<HTMLDivElement | null>(null);

export function IssuesToolbarRoot({ className }: { className?: string }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  return (
    <IssuesToolbarContext.Provider value={node}>
      <div ref={setNode} className={className} />
    </IssuesToolbarContext.Provider>
  );
}

export function useIssuesToolbarRoot() {
  return useContext(IssuesToolbarContext);
}
