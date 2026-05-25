import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { FormField, FormRow } from "@/src/components/ui/form-layout";
import { SelectField } from "@/src/components/ui/select-field";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { listLocations } from "@/src/lib/ops/data";
import { upsertEmployee } from "@/src/lib/ops/hr-actions";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New employee</CardTitle>
          <CardDescription>Admin access required.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const locations = await listLocations();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        People
      </Link>
      <PageHeader title="New employee" description="Creates a profile with default document folders." />

      <Card>
        <CardContent className="pt-6">
          <form action={upsertEmployee} className="space-y-4">
            <FormRow>
              <FormField label="Legal name">
                <Input name="legal_name" required />
              </FormField>
              <FormField label="Preferred name">
                <Input name="preferred_name" />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Employee #">
                <Input name="employee_number" />
              </FormField>
              <FormField label="Hire date">
                <Input name="hire_date" type="date" />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Job title">
                <Input name="job_title" />
              </FormField>
              <FormField label="Department">
                <Input name="department" />
              </FormField>
            </FormRow>
            <FormField label="Primary location">
              <SelectField
                name="location"
                placeholder="Location"
                options={[{ value: "", label: "None" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
              />
            </FormField>
            <FormRow>
              <FormField label="Email">
                <Input name="email" type="email" />
              </FormField>
              <FormField label="Phone">
                <Input name="phone" />
              </FormField>
            </FormRow>
            <Button type="submit" size="sm">
              Create employee
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
