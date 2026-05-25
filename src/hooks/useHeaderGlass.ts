"use client";

import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 18;

export function useHeaderGlass() {
  const [glass, setGlass] = useState(false);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      setGlass(window.scrollY > SCROLL_THRESHOLD);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return glass;
}
