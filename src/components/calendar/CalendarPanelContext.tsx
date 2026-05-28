"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface CalendarPanelContextValue {
  open: boolean;
  toggle: () => void;
}

const CalendarPanelContext = createContext<CalendarPanelContextValue>({
  open: true,
  toggle: () => {},
});

export function CalendarPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("calendar-panel-open");
    if (stored !== null) setOpen(stored !== "false");
    setHydrated(true);
  }, []);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem("calendar-panel-open", String(next));
      return next;
    });
  };

  if (!hydrated) return <CalendarPanelContext.Provider value={{ open: true, toggle }}>{children}</CalendarPanelContext.Provider>;
  return <CalendarPanelContext.Provider value={{ open, toggle }}>{children}</CalendarPanelContext.Provider>;
}

export function useCalendarPanel() {
  return useContext(CalendarPanelContext);
}
