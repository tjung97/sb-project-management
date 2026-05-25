"use client";

import { signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "@/src/lib/firebase/client";
import { Button } from "@/src/components/ui/button";

export function SignOutButton() {
  const router = useRouter();

  async function onSignOut() {
    await signOut(auth);
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={onSignOut}>
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
