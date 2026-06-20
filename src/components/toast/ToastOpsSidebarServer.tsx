import { ToastOpsSidebar } from "@/src/components/toast/ToastOpsSidebar";
import { getAllToastOpsSummaries } from "@/src/lib/toast/api";

export async function ToastOpsSidebarServer() {
  const stores = await getAllToastOpsSummaries();
  return <ToastOpsSidebar stores={stores} />;
}
