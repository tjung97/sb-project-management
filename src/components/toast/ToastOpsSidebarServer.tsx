import { ToastOpsSidebar } from "@/src/components/toast/ToastOpsSidebar";
import { getAllToastOpsSummaries } from "@/src/lib/toast/api";
import type { ToastStoreSummary } from "@/src/lib/toast/api";

export async function ToastOpsSidebarServer() {
  let stores: ToastStoreSummary[] = [];

  try {
    stores = await getAllToastOpsSummaries();
  } catch (error) {
    // Toast auth/network failures must not take down authenticated pages
    // (AppShell mounts this on every route). Show empty sidebar instead.
    console.error(
      "[ToastOpsSidebarServer]",
      error instanceof Error ? error.message : "Failed to load Toast summaries"
    );
  }

  return <ToastOpsSidebar stores={stores} />;
}
