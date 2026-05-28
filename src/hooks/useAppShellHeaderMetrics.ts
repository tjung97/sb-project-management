"use client";

import { useEffect } from "react";

export function useAppShellHeaderMetrics(
  headerRef: React.RefObject<HTMLElement | null>,
  dependencyKey = ""
) {
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const sync = () => {
      const height = el.offsetHeight;
      document.documentElement.style.setProperty("--app-header-height", `${height}px`);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("resize", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [headerRef, dependencyKey]);
}
