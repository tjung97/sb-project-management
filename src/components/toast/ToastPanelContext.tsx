"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface ToastPanelContextValue {
  open: boolean;
  hydrated: boolean;
  toggle: () => void;
  close: () => void;
}

const ToastPanelContext = createContext<ToastPanelContextValue>({
  open: true,
  hydrated: false,
  toggle: () => {},
  close: () => {},
});

export function ToastPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOpen(localStorage.getItem("toast-panel-open") !== "false");
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggle = useCallback(() => {
    setOpen((value) => {
      const next = !value;
      localStorage.setItem("toast-panel-open", String(next));
      return next;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    localStorage.setItem("toast-panel-open", "false");
  }, []);

  return <ToastPanelContext.Provider value={{ open, hydrated, toggle, close }}>{children}</ToastPanelContext.Provider>;
}

export function useToastPanel() {
  return useContext(ToastPanelContext);
}
