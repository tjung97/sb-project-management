"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function RouteScrollReset() {
  const pathname = usePathname();
  const firstPathname = useRef(pathname);

  useLayoutEffect(() => {
    const isInitialRender = pathname === firstPathname.current;

    if (!isInitialRender) {
      scrollMainToTop("smooth");
    }

    const frame = requestAnimationFrame(() => scrollMainToTop("smooth"));
    const timer = window.setTimeout(() => scrollMainToTop("smooth"), 120);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}

function scrollMainToTop(behavior: ScrollBehavior) {
  const main = document.querySelector<HTMLElement>("[data-app-main-scroll]");
  main?.scrollTo({ top: 0, left: 0, behavior });
  window.scrollTo({ top: 0, left: 0, behavior });
}
