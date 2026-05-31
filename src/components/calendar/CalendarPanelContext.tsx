"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface CalendarPanelContextValue {
  open: boolean;
  hydrated: boolean;
  toggle: () => void;
  close: () => void;
}

const CalendarPanelContext = createContext<CalendarPanelContextValue>({
  open: true,
  hydrated: false,
  toggle: () => {},
  close: () => {},
});

export function CalendarPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(localStorage.getItem("calendar-panel-open") !== "false");
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem("calendar-panel-open", String(next));
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    localStorage.setItem("calendar-panel-open", "false");
  }, []);

  return <CalendarPanelContext.Provider value={{ open, hydrated, toggle, close }}>{children}</CalendarPanelContext.Provider>;
}

export function useCalendarPanel() {
  return useContext(CalendarPanelContext);
}
