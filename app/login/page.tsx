import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { LoginPage } from "./LoginPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (user) redirect("/issues");

  return <LoginPage />;
}
