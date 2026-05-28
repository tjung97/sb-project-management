import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listLabels, listLocations, listProjects, listUserProfiles } from "@/src/lib/ops/data";
import { getIssueTemplate } from "@/src/lib/ops/templates";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { CreateIssueForm } from "../IssueForms";

export const dynamic = "force-dynamic";

export default async function NewIssuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const templateId = typeof params.template === "string" ? params.template : Array.isArray(params.template) ? params.template[0] : undefined;
  const parentIssueId = typeof params.parent === "string" ? params.parent : Array.isArray(params.parent) ? params.parent[0] : undefined;
  const projectId = typeof params.project === "string" ? params.project : Array.isArray(params.project) ? params.project[0] : undefined;
  const mobile = params.mobile === "1";
  const template = templateId ? getIssueTemplate(templateId) : null;

  const [projects, locations, labels, users] = await Promise.all([
    listProjects(),
    listLocations(),
    listLabels(),
    listUserProfiles(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/issues" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Issues
        </Link>
      </div>
      <PageHeader
        title={mobile ? "Quick issue" : "New issue"}
        description={mobile ? "Fast store-manager flow: title, photo/link, owner, and due date." : "Fill in the title and description, then set details on the right."}
      />
      <CreateIssueForm
        projects={projects}
        locations={locations}
        labels={labels}
        users={users}
        template={template}
        parentIssueId={parentIssueId}
        defaultProjectId={projectId}
        mobile={mobile}
      />
    </div>
  );
}
