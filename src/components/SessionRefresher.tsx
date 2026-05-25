"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { auth } from "@/src/lib/firebase/client";

export function SessionRefresher() {
  useEffect(() => {
    return onIdTokenChanged(auth, async (user) => {
      if (!user) return;
      const token = await user.getIdToken();
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    });
  }, []);

  return null;
}
