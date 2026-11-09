import { Suspense } from "react";
import { getRecentStockOutages } from "@/src/lib/ops/stock-events";
import { SalesDashboardServer } from "@/src/components/home/SalesDashboardServer";
import { StockAlertBanner } from "@/src/components/home/StockAlertBanner";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stockOutages = await getRecentStockOutages().catch(() => []);

  return (
    <>
      <Suspense fallback={<DashboardSkeleton />}>
        <SalesDashboardServer />
      </Suspense>
      <StockAlertBanner events={stockOutages} />
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-28 animate-pulse rounded-2xl border border-border/70 bg-card" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-border/80 bg-card" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border/80 bg-card" />
    </div>
  );
}
