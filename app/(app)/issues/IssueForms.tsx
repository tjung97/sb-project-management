import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { SelectField } from "@/src/components/ui/select-field";
import { IssueTemplatePicker } from "@/src/components/ops/IssueTemplatePicker";
import { MarkdownComposer } from "@/src/components/ops/MarkdownComposer";
import { SidebarListPicker } from "@/src/components/ops/SidebarListPicker";
import { SidebarPeoplePicker } from "@/src/components/ops/SidebarPeoplePicker";
import { buildMentionUsers } from "@/src/lib/ops/mentions";
import { serializeUserProfile } from "@/src/lib/ops/serialize";
import { createIssue } from "@/src/lib/ops/actions";
import { ISSUE_KINDS, ISSUE_PRIORITIES } from "@/src/lib/ops/constants";
import type { IssueTemplateDefinition } from "@/src/lib/ops/templates";
import type { LabelWithId, LocationWithId, ProjectWithId, UserProfile } from "@/src/types/firestore";

function dueInputFromDays(days: number | null) {
  if (days == null) return "";
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function CreateIssueForm({
  projects,
  locations,
  labels,
  users,
  template,
  parentIssueId,
  mobile = false,
}: {
  projects: ProjectWithId[];
  locations: LocationWithId[];
  labels: LabelWithId[];
  users: UserProfile[];
  template?: IssueTemplateDefinition | null;
  parentIssueId?: string | null;
  mobile?: boolean;
}) {
  const defaultTitle = template?.title ?? "";
  const defaultDescription = template?.body ?? "";
  const defaultKind = template?.kind ?? "task";
  const defaultPriority = template?.priority ?? "normal";
  const defaultLocation = template?.location_id ?? "";
  const defaultLabels = new Set(template?.label_ids ?? []);
  const defaultDue = dueInputFromDays(template?.due_days ?? null);
  const mentionUsers = buildMentionUsers(
    users.filter((user) => user.active).map((user) => ({
      uid: user.uid,
      display_name: user.display_name,
      email: user.email,
    }))
  );

  return (
    <div className="space-y-6">
      <IssueTemplatePicker />
      <form action={createIssue} className="space-y-6">
        {template ? <input type="hidden" name="template_id" value={template.id} /> : null}
        {parentIssueId ? <input type="hidden" name="parent_issue_id" value={parentIssueId} /> : null}
        {parentIssueId ? (
          <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            Creating a sub-issue linked to the parent work item.
          </p>
        ) : null}

        <section className="space-y-3">
          <label className="form-label" htmlFor="title">
            Add a title
          </label>
          <Input id="title" name="title" className="h-12 text-base" placeholder="Fix broken prep sink..." defaultValue={defaultTitle} required />
        </section>

        <section className="space-y-2">
          <label className="form-label" htmlFor="description">
            Description
          </label>
          <MarkdownComposer
            name="description"
            defaultValue={defaultDescription}
            placeholder="Describe the work in Markdown… Type @ to tag someone."
            minHeight={mobile ? "min-h-32" : "min-h-48"}
            mentionUsers={mentionUsers}
            required
          />
        </section>

        {mobile ? (
          <section className="rounded-lg border border-border bg-secondary/30 p-4">
            <label className="form-label" htmlFor="attachment_url">Photo or file link</label>
            <Input id="attachment_url" name="attachment_url" placeholder="Paste photo/file URL after upload" />
            <p className="mt-2 text-xs text-muted-foreground">For camera-first work, attach the photo in the first comment after creation.</p>
          </section>
        ) : null}

        <section className="grid gap-4 rounded-lg border border-border bg-secondary/30 p-4 sm:grid-cols-2">
          <div>
            <label className="form-label" htmlFor="kind">
              Type
            </label>
            <SelectField name="kind" defaultValue={defaultKind} placeholder="Type" options={ISSUE_KINDS} ariaLabel="Issue type" />
          </div>
          <div>
            <label className="form-label" htmlFor="priority">
              Priority
            </label>
            <SelectField name="priority" defaultValue={defaultPriority} placeholder="Priority" options={ISSUE_PRIORITIES} ariaLabel="Issue priority" />
          </div>
          <div>
            <label className="form-label" htmlFor="location_id">
              Location
            </label>
            <SelectField
              name="location_id"
              defaultValue={defaultLocation}
              placeholder="Location"
              options={[{ value: "", label: "No location" }, ...locations.map((location) => ({ value: location.id, label: location.name }))]}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="project_id">
              Project
            </label>
            <SelectField
              name="project_id"
              defaultValue=""
              placeholder="Project"
              options={[{ value: "", label: "No project" }, ...projects.map((project) => ({ value: project.id, label: project.title }))]}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="due_at">
              Due date
            </label>
            <Input id="due_at" name="due_at" type="date" defaultValue={defaultDue} />
          </div>
        </section>

        <section className={mobile ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
          <SidebarPeoplePicker
            name="assignee_uids"
            users={users.map(serializeUserProfile)}
            selected={[]}
            fieldLabel="Assignees"
            dialogTitle="Set assignees"
            display="embedded"
          />
          <SidebarListPicker
            name="label_ids"
            mode="multiple"
            display="embedded"
            fieldLabel="Labels"
            dialogTitle="Apply labels"
            filterPlaceholder="Filter labels"
            options={labels.map((label) => ({ value: label.id, label: label.name }))}
            selected={Array.from(defaultLabels)}
          />
        </section>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {template ? `Using template: ${template.name}` : "Create the issue, then discuss updates in the timeline."}
          </p>
          <Button type="submit" className="bg-success text-success-foreground hover:bg-success/90">
            Create issue
          </Button>
        </div>
      </form>
    </div>
  );
}
