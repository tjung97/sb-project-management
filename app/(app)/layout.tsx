import { redirect } from "next/navigation";
import { AppShell } from "@/src/components/AppShell";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
