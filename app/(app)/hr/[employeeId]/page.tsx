import { notFound } from "next/navigation";
import { HrEmployeeWorkspace } from "@/src/components/hr/HrEmployeeWorkspace";
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { getEmployeeBundle, listEmployees } from "@/src/lib/ops/hr-data";
import {
  serializeCompEntry,
  serializeDocument,
  serializeEmployee,
  serializeFeedback,
} from "@/src/lib/ops/hr-serialize";
import { listLocations, listUserProfiles } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

const TABS = ["overview", "compensation", "feedback", "files"] as const;

export default async function HrEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee record</CardTitle>
          <CardDescription>Admin access required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { employeeId } = await params;
  const rawParams = await searchParams;
  const tabParam = one(rawParams.tab);
  const tab = TABS.includes(tabParam as (typeof TABS)[number]) ? (tabParam as (typeof TABS)[number]) : "overview";
  const folderId = one(rawParams.folder) || null;

  const [bundle, locations, allEmployees, userProfiles] = await Promise.all([
    getEmployeeBundle(employeeId),
    listLocations(),
    listEmployees(),
    listUserProfiles(),
  ]);

  if (!bundle) notFound();

  const employeeOptions = allEmployees.map((item) => ({
    id: item.id,
    name: item.preferred_name || item.legal_name,
  }));

  return (
    <HrEmployeeWorkspace
      employee={serializeEmployee(bundle.employee)}
      compEntries={bundle.compEntries.map(serializeCompEntry)}
      feedback={bundle.feedback.map(serializeFeedback)}
      folders={bundle.folders}
      documents={bundle.documents.map(serializeDocument)}
      locations={locations.map((location) => ({ id: location.id, name: location.name }))}
      employees={employeeOptions}
      userProfiles={userProfiles.map((profile) => ({
        uid: profile.uid,
        display_name: profile.display_name,
        email: profile.email,
      }))}
      tab={tab}
      folderId={folderId}
    />
  );
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
