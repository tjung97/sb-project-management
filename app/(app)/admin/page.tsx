import { AdminConsole } from "@/src/components/admin/AdminConsole";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { AdminSectionNav } from "@/src/components/admin/AdminSectionNav";
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getAdminDashboard, listAllUserProfiles } from "@/src/lib/ops/admin-health";
import { listLabels, listLocations, listPilotFeedback } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  if (user?.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admin access required</CardTitle>
          <CardDescription>Ask an admin to update locations, labels, users, and system configuration.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [dashboard, locations, labels, users, pilotFeedback] = await Promise.all([
    getAdminDashboard(),
    listLocations(),
    listLabels(),
    listAllUserProfiles(),
    listPilotFeedback(),
  ]);

  if (!dashboard) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load admin console</CardTitle>
          <CardDescription>Refresh the page or check your admin session.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const edit = {
    locationId: one(params.editLocation),
    labelId: one(params.editLabel),
    userUid: one(params.editUser),
    recurringId: one(params.editRecurring),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Locations, labels, users, automation, and system health. Deactivate instead of delete when records are still referenced."
      />

      {one(params.claims) === "auth_missing" ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Profile saved in Firestore, but no Firebase Authentication account exists for that UID yet. Create the user in
          Firebase Auth (or use their real sign-in UID), then save again to sync role and store access.
        </div>
      ) : null}

      <AdminSectionNav />

      <AdminConsole
        dashboard={dashboard}
        locations={locations}
        labels={labels}
        users={users}
        pilotFeedback={pilotFeedback}
        edit={edit}
      />
    </div>
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
