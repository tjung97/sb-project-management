import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { IssueSummaryList } from "@/src/components/ops/IssueSummaryList";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { listIssues } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

export default async function WarehousePage() {
  const user = await getCurrentUser();
  const issues = await listIssues({ status: "openish" });
  const warehouse = issues.filter((issue) => {
    const isWarehouseIssue = issue.kind === "warehouse" || issue.location_id === "warehouse";
    if (!isWarehouseIssue) return false;
    if (user?.role === "admin") return true;
    return Boolean(user?.storeIds.includes("warehouse"));
  });
  const blocked = warehouse.filter((issue) => issue.status === "blocked");
  const vendor = warehouse.filter((issue) => issue.label_ids.includes("vendor"));

  return (
    <div className="space-y-6">
      <PageHeader title="Warehouse" description="Supply, prep, and fulfillment queue.">
        <LocationKindBadge kind="warehouse" />
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-3">
        <DashboardCard title="Warehouse queue" description={`${warehouse.length} open warehouse items`} issues={warehouse} />
        <DashboardCard title="Blocked supplies" description="Waiting on vendor, delivery, or decision" issues={blocked} />
        <DashboardCard title="Vendor follow-ups" description="Outside party follow-up needed" issues={vendor} />
      </div>
    </div>
  );
}

function DashboardCard({ title, description, issues }: { title: string; description: string; issues: Awaited<ReturnType<typeof listIssues>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <IssueSummaryList issues={issues.slice(0, 8)} />
      </CardContent>
    </Card>
  );
}
