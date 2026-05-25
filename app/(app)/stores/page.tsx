import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { IssueSummaryList } from "@/src/components/ops/IssueSummaryList";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { listIssues, listLocations } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const user = await getCurrentUser();
  const [locations, issues] = await Promise.all([listLocations(), listIssues({ status: "openish" })]);
  let stores = locations.filter((location) => location.kind === "store");

  if (user && user.role !== "admin" && user.storeIds.length > 0) {
    const allowed = new Set(user.storeIds);
    stores = stores.filter((store) => allowed.has(store.id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores"
        description={
          user && user.role !== "admin" && user.storeIds.length > 0
            ? `Open work for your assigned store${user.storeIds.length === 1 ? "" : "s"}.`
            : "Open work grouped by store location."
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {stores.map((store) => {
          const storeIssues = issues.filter(
            (issue) => issue.location_id === store.id || issue.kind === "store_work"
          );
          const scoped = user?.role === "admin" ? storeIssues.filter((i) => i.location_id === store.id) : storeIssues;
          const blocked = scoped.filter((issue) => issue.status === "blocked").length;
          return (
            <Card key={store.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{store.name}</CardTitle>
                  <LocationKindBadge kind="store" />
                </div>
                <CardDescription>
                  {scoped.length} open issues · {blocked} blocked
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <IssueSummaryList issues={scoped.slice(0, 6)} empty="No open store issues." />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
