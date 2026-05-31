import { ToastOpsSidebar } from "@/src/components/toast/ToastOpsSidebar";
import { getToastOpsSummary } from "@/src/lib/toast/api";

export async function ToastOpsSidebarServer() {
  const summary = await getToastOpsSummary();
  return <ToastOpsSidebar summary={summary} />;
}
