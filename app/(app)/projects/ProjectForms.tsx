import { Button } from "@/src/components/ui/button";
import {
  FormActions,
  FormField,
  FormRow,
  FormSection,
  FormShell,
} from "@/src/components/ui/form-layout";
import { LocationPickerField } from "@/src/components/ops/LocationPickerField";
import { Input } from "@/src/components/ui/input";
import { SelectField } from "@/src/components/ui/select-field";
import { createProject, createProjectFromTemplate, updateProject } from "@/src/lib/ops/actions";
import { PROJECT_TEMPLATES } from "@/src/lib/ops/project-templates";
import type { LocationWithId, ProjectWithId, UserProfile } from "@/src/types/firestore";

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

function ownerOptions(users: UserProfile[]) {
  return [{ value: "", label: "No owner yet" }, ...users.map((user) => ({ value: user.uid, label: user.display_name }))];
}

export function CreateProjectForm({ locations, users }: { locations: LocationWithId[]; users: UserProfile[] }) {
  return (
    <form action={createProject}>
      <FormShell>
        <FormSection title="Basics" description="Name the initiative and what success looks like.">
          <FormField label="Project title" htmlFor="create-title">
            <Input id="create-title" name="title" placeholder="Q2 store opening, warehouse cleanup…" required />
          </FormField>
          <FormField label="Description" htmlFor="create-description">
            <textarea id="create-description" name="description" className="form-textarea min-h-24" placeholder="Scope, goals, and key outcomes" required />
          </FormField>
        </FormSection>

        <FormSection title="Ownership & schedule">
          <FormRow>
            <FormField label="Owner">
              <SelectField name="owner_uid" defaultValue="" placeholder="Select owner" ariaLabel="Owner" options={ownerOptions(users)} />
            </FormField>
            <FormField label="Due date" htmlFor="create-due">
              <Input id="create-due" name="due_at" type="date" />
            </FormField>
          </FormRow>
        </FormSection>

        <FormSection title="Next decision" description="Keep the current action visible on the project page.">
          <FormField label="Next step" htmlFor="create-next-step">
            <Input id="create-next-step" name="next_step" placeholder="Get vendor quote approved" />
          </FormField>
          <FormField label="Blocked reason" htmlFor="create-blocked-reason">
            <textarea id="create-blocked-reason" name="blocked_reason" className="form-textarea min-h-20" placeholder="Only fill this when the project is paused or blocked" />
          </FormField>
        </FormSection>

        <FormSection title="Scope">
          <LocationPickerField locations={locations} />
        </FormSection>

        <FormActions>
          <Button type="submit">Create project</Button>
        </FormActions>
      </FormShell>
    </form>
  );
}

export function CreateProjectFromTemplateForm({ locations, users }: { locations: LocationWithId[]; users: UserProfile[] }) {
  return (
    <form action={createProjectFromTemplate}>
      <FormShell>
        <FormSection title="Playbook setup" description="Start from a template with pre-built issues and checklists.">
          <FormField label="Project title" htmlFor="template-title">
            <Input id="template-title" name="title" placeholder="Capitol Hill launch…" required />
          </FormField>
          <FormField label="Playbook">
            <SelectField
              name="template_id"
              ariaLabel="Playbook"
              defaultValue="new-store-launch"
              placeholder="Choose playbook"
              options={PROJECT_TEMPLATES.map((template) => ({ value: template.id, label: template.name }))}
            />
          </FormField>
        </FormSection>

        <FormSection title="Ownership">
          <FormField label="Owner">
            <SelectField name="owner_uid" defaultValue="" placeholder="Select owner" ariaLabel="Owner" options={ownerOptions(users)} />
          </FormField>
          <LocationPickerField locations={locations} />
        </FormSection>

        <FormActions>
          <Button type="submit">Create playbook project</Button>
        </FormActions>
      </FormShell>
    </form>
  );
}

export function EditProjectForm({ project, locations, users }: { project: ProjectWithId; locations: LocationWithId[]; users: UserProfile[] }) {
  const action = updateProject.bind(null, project.id);

  return (
    <form action={action}>
      <FormShell>
        <FormSection title="Basics" description="Title and summary shown on the project board.">
          <FormField label="Project title" htmlFor="edit-title">
            <Input id="edit-title" name="title" defaultValue={project.title} required />
          </FormField>
          <FormField label="Description" htmlFor="edit-description">
            <textarea id="edit-description" name="description" className="form-textarea min-h-28" defaultValue={project.description} required />
          </FormField>
        </FormSection>

        <FormSection title="Status & ownership">
          <FormRow>
            <FormField label="Status">
              <SelectField
                name="status"
                defaultValue={project.status}
                placeholder="Status"
                ariaLabel="Status"
                options={PROJECT_STATUS_OPTIONS}
              />
            </FormField>
            <FormField label="Owner">
              <SelectField
                name="owner_uid"
                defaultValue={project.owner_uid ?? ""}
                placeholder="Select owner"
                ariaLabel="Owner"
                options={[{ value: "", label: "No owner" }, ...users.map((user) => ({ value: user.uid, label: user.display_name }))]}
              />
            </FormField>
          </FormRow>
          <FormField label="Due date" htmlFor="edit-due" hint="Target completion for the overall initiative.">
            <Input
              id="edit-due"
              name="due_at"
              type="date"
              defaultValue={project.due_at ? project.due_at.toDate().toISOString().slice(0, 10) : ""}
            />
          </FormField>
        </FormSection>

        <FormSection title="Next decision" description="The current decision or action that keeps this project moving.">
          <FormField label="Next step" htmlFor="edit-next-step">
            <Input id="edit-next-step" name="next_step" defaultValue={project.next_step ?? ""} placeholder="Confirm install date with vendor" />
          </FormField>
          <FormField label="Blocked reason" htmlFor="edit-blocked-reason">
            <textarea
              id="edit-blocked-reason"
              name="blocked_reason"
              className="form-textarea min-h-20"
              defaultValue={project.blocked_reason ?? ""}
              placeholder="What decision, vendor, or dependency is holding this up?"
            />
          </FormField>
        </FormSection>

        <FormSection title="Scope">
          <LocationPickerField locations={locations} defaultCheckedIds={project.location_ids} />
        </FormSection>

        <FormActions>
          <Button type="submit">Save changes</Button>
        </FormActions>
      </FormShell>
    </form>
  );
}
