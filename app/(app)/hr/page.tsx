import { PageHeader } from "@/src/components/layout/PageHeader";
import { HrEmployeeDirectory } from "@/src/components/hr/HrEmployeeDirectory";
import { Card, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { listEmployees } from "@/src/lib/ops/hr-data";
import { serializeEmployee } from "@/src/lib/ops/hr-serialize";
import { listLocations } from "@/src/lib/ops/data";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>People</CardTitle>
          <CardDescription>HR records are limited to administrators.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [employees, locations] = await Promise.all([listEmployees(), listLocations()]);
  const locationNames = Object.fromEntries(locations.map((location) => [location.id, location.name]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="People"
        description="Employee records — compensation, feedback, hire dates, and confidential files."
      />

      <HrEmployeeDirectory employees={employees.map(serializeEmployee)} locationNames={locationNames} />
    </div>
  );
}
