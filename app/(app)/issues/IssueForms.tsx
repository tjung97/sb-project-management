import type { ReactNode } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { SelectField } from "@/src/components/ui/select-field";
import { IssueAttachmentFields } from "@/src/components/ops/IssueAttachmentFields";
import { IssueTemplatePicker } from "@/src/components/ops/IssueTemplatePicker";
import { MarkdownComposer } from "@/src/components/ops/MarkdownComposer";
import { DueDatePicker } from "@/src/components/ops/DueDatePicker";
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
  defaultProjectId,
  mobile = false,
}: {
  projects: ProjectWithId[];
  locations: LocationWithId[];
  labels: LabelWithId[];
  users: UserProfile[];
  template?: IssueTemplateDefinition | null;
  parentIssueId?: string | null;
  defaultProjectId?: string | null;
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
    <div className="space-y-5">
      <IssueTemplatePicker />

      <form action={createIssue}>
        {template ? <input type="hidden" name="template_id" value={template.id} /> : null}
        {parentIssueId ? <input type="hidden" name="parent_issue_id" value={parentIssueId} /> : null}

        {parentIssueId ? (
          <p className="mb-5 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            Creating a sub-issue linked to the parent work item.
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          {/* ── Left: title + description + attachments ── */}
          <div className="space-y-5">
            <section className="space-y-2">
              <label className="form-label" htmlFor="title">
                Title
              </label>
              <Input
                id="title"
                name="title"
                className="h-12 text-base"
                placeholder={mobile ? "What needs doing?" : "Fix broken prep sink…"}
                defaultValue={defaultTitle}
                required
              />
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

            <IssueAttachmentFields
              idPrefix="new-issue-attachment"
              title={mobile ? "Store photo or evidence" : "Evidence"}
              description={mobile ? "Photo, file, or vendor link" : "Quote, invoice, photo, or vendor thread"}
              mobile={mobile}
            />
          </div>

          {/* ── Right: metadata sidebar ── */}
          <aside className="rounded-lg border border-border bg-card shadow-card">
            <div className="border-b border-border/80 px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Details</p>
            </div>

            <div className="divide-y divide-border/80 px-4">
              <MetaRow label="Type">
                <SelectField
                  name="kind"
                  defaultValue={defaultKind}
                  placeholder="Type"
                  className="h-8 border-input/60 bg-transparent text-sm shadow-none"
                  options={ISSUE_KINDS.map((opt) => ({ value: opt.value, label: opt.label }))}
                />
              </MetaRow>

              <MetaRow label="Priority">
                <SelectField
                  name="priority"
                  defaultValue={defaultPriority}
                  placeholder="Priority"
                  className="h-8 border-input/60 bg-transparent text-sm shadow-none"
                  options={ISSUE_PRIORITIES.map((opt) => ({ value: opt.value, label: opt.label }))}
                />
              </MetaRow>

              <MetaRow label="Location">
                <SelectField
                  name="location_id"
                  defaultValue={defaultLocation}
                  placeholder="No location"
                  className="h-8 border-input/60 bg-transparent text-sm shadow-none"
                  options={[
                    { value: "", label: "No location" },
                    ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
                  ]}
                />
              </MetaRow>

              <MetaRow label="Project">
                <SelectField
                  name="project_id"
                  defaultValue={defaultProjectId ?? ""}
                  placeholder="No project"
                  className="h-8 border-input/60 bg-transparent text-sm shadow-none"
                  options={[
                    { value: "", label: "No project" },
                    ...projects.map((proj) => ({ value: proj.id, label: proj.title })),
                  ]}
                />
              </MetaRow>

              <MetaRow label="Due date">
                <DueDatePicker name="due_at" defaultValue={defaultDue} />
              </MetaRow>

              <div className="py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assignees</p>
                <SidebarPeoplePicker
                  name="assignee_uids"
                  users={users.map(serializeUserProfile)}
                  selected={[]}
                  fieldLabel="Assignees"
                  dialogTitle="Set assignees"
                  display="embedded"
                />
              </div>

              <div className="py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Labels</p>
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
              </div>
            </div>

            <div className="border-t border-border/80 px-4 py-3">
              <Button type="submit" className="w-full bg-success text-success-foreground hover:bg-success/90">
                Create issue
              </Button>
              {template ? (
                <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
                  Using template: {template.name}
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
