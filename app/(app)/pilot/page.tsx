import { CheckCircle2, ClipboardList, MessageSquare, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { SelectField } from "@/src/components/ui/select-field";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { submitPilotFeedback } from "@/src/lib/ops/actions";

export const dynamic = "force-dynamic";

const scenarios = [
  "Store repair with photo/link",
  "HQ assignment and due date",
  "Warehouse supply follow-up",
  "Checklist completion",
  "Project board move",
  "Weekly report export",
];

export default async function PilotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const submitted = params.submitted === "1";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pilot"
        description="Checklist and feedback for the first real-user pilot (HQ, store, warehouse)."
      />

      {submitted ? (
        <Card className="border-success/40 bg-success/10">
          <CardContent className="flex items-center gap-2 p-4 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Feedback submitted.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Pilot scenarios</CardTitle>
            <CardDescription>Run these before adding another feature wave.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {scenarios.map((scenario) => (
              <div key={scenario} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                {scenario}
              </div>
            ))}
            <div className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              Target: store manager can create and update an issue from phone in under one minute.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <CardTitle>Feedback capture</CardTitle>
            </div>
            <CardDescription>Capture friction while it is fresh.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={submitPilotFeedback} className="space-y-3">
              <SelectField
                name="scenario"
                defaultValue={scenarios[0]}
                placeholder="Pilot scenario"
                options={scenarios.map((scenario) => ({ value: scenario, label: scenario }))}
              />
              <SelectField
                name="rating"
                defaultValue="3"
                placeholder="Rating"
                options={[
                  { value: "5", label: "5 - Very smooth" },
                  { value: "4", label: "4 - Good" },
                  { value: "3", label: "3 - Usable" },
                  { value: "2", label: "2 - Friction" },
                  { value: "1", label: "1 - Blocked" },
                ]}
              />
              <textarea name="worked_well" className="form-textarea" placeholder="What worked well?" />
              <textarea name="friction" className="form-textarea" placeholder="What was confusing or slow?" />
              <textarea name="still_used_outside_tool" className="form-textarea" placeholder="What did you still track outside the app?" />
              <Button type="submit" className="w-full">
                <Smartphone className="h-4 w-4" />
                Submit pilot feedback
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
