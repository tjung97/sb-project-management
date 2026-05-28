import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bell,
  Database,
  MapPin,
  RefreshCw,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { AdminConfirmSubmit } from "@/src/components/admin/AdminConfirmSubmit";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { SidebarListPicker } from "@/src/components/ops/SidebarListPicker";
import { RoleBadge } from "@/src/components/ops/RoleBadge";
import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { FormField, FormRow } from "@/src/components/ui/form-layout";
import { SelectField } from "@/src/components/ui/select-field";
import {
  createTestNotification,
  deactivateUserProfile,
  deleteLabel,
  deleteLocation,
  deleteRecurringTemplate,
  dismissNotificationEvent,
  retryNotificationEvent,
  upsertLabel,
  upsertLocation,
  upsertRecurringTemplate,
  upsertUserProfile,
} from "@/src/lib/ops/actions";
import type { PilotFeedbackItem } from "@/src/lib/ops/data";
import { formatDate, formatDateTime } from "@/src/lib/ops/format";
import { profileStoreIds } from "@/src/lib/ops/user-stores";
import type { AdminDashboard } from "@/src/lib/ops/admin-health";
import { ISSUE_TEMPLATES } from "@/src/lib/ops/templates";
import type { LabelWithId, LocationKind, LocationWithId, UserProfile } from "@/src/types/firestore";
import { cn } from "@/src/lib/utils";

type EditState = {
  locationId?: string;
  labelId?: string;
  userUid?: string;
  recurringId?: string;
};

export function AdminConsole({
  dashboard,
  locations,
  labels,
  users,
  pilotFeedback,
  edit,
}: {
  dashboard: AdminDashboard;
  locations: LocationWithId[];
  labels: LabelWithId[];
  users: UserProfile[];
  pilotFeedback: PilotFeedbackItem[];
  edit: EditState;
}) {
  const { health, stats } = dashboard;
  const editLocation = edit.locationId ? locations.find((location) => location.id === edit.locationId) : null;
  const editLabel = edit.labelId ? labels.find((label) => label.id === edit.labelId) : null;
  const editUser = edit.userUid ? users.find((user) => user.uid === edit.userUid) : null;
  const editRecurring = edit.recurringId ? health.recurringTemplates.find((template) => template.id === edit.recurringId) : null;

  const envOk = health.env.filter((item) => item.scope === "public").every((item) => item.configured);
  const serverOk = health.env.filter((item) => item.scope === "server").every((item) => item.configured);

  return (
    <div className="space-y-8 scroll-mt-28">
      <section id="overview" className="scroll-mt-32 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Open issues" value={stats.issuesOpen} hint={`${stats.issues} total tracked`} />
          <StatTile label="Blocked" value={stats.issuesBlocked} hint={`${stats.issuesUrgent} urgent open`} variant={stats.issuesBlocked > 0 ? "warn" : "default"} />
          <StatTile label="Locations" value={stats.locationsActive} hint={`${stats.locations} configured`} />
          <StatTile label="Team" value={stats.usersActive} hint={`${stats.users} profiles`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Setup checklist</CardTitle>
              <CardDescription>Production readiness before rolling out to stores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <CheckRow label="Public Firebase env" ok={envOk} />
              <CheckRow label="Server integrations" ok={serverOk} />
              <CheckRow label="Locations configured" ok={stats.locationsActive > 0} />
              <CheckRow label="Labels configured" ok={stats.labels > 0} />
              <CheckRow label="User profiles complete" ok={health.setupGaps.length === 0} />
              <CheckRow label="No failed notification events" ok={health.failedNotifications.length === 0} />
              {health.setupGaps.length > 0 ? (
                <p className="rounded-md bg-secondary p-2 text-xs text-muted-foreground">
                  Needs review: {health.setupGaps.map((profile) => profile.display_name).join(", ")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permissions matrix</CardTitle>
              <CardDescription>Role behavior across UI, actions, and Firestore rules.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto text-xs">
              <table className="w-full min-w-[420px] text-left">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="pb-2">Capability</th>
                    <th className="pb-2">Admin</th>
                    <th className="pb-2">Manager</th>
                    <th className="pb-2">Member</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["Create issues", "Yes", "Yes", "Yes"],
                    ["Edit location issues", "Yes", "Yes", "Yes"],
                    ["Create projects", "Yes", "No", "No"],
                    ["Admin console", "Yes", "No", "No"],
                    ["Delete / deactivate records", "Yes", "No", "No"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, index) => (
                        <td key={`${row[0]}-${index}`} className="py-2 pr-3">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="system" className="scroll-mt-32 space-y-4">
        <SectionHeading icon={Database} title="System health" description="Environment, API, and integration status." />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Environment & services</CardTitle>
              <CardDescription>
                Project <span className="font-mono text-foreground">{health.firebaseProjectId ?? "—"}</span> · checked{" "}
                {formatDateTime(dashboard.checkedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill ok={health.apiHealthOk} label="Public config" />
                <StatusPill ok={serverOk} label="Server secrets" />
                <StatusPill ok={health.failedNotifications.length === 0} label="Notifications" />
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Variable</th>
                      <th className="px-3 py-2">Scope</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {health.env.map((item) => (
                      <tr key={item.key}>
                        <td className="px-3 py-2 font-mono text-xs">{item.key}</td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">{item.scope}</td>
                        <td className="px-3 py-2">
                          <Badge variant={item.configured ? "default" : "destructive"}>
                            {item.configured ? "Set" : "Missing"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link href="/api/health" className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  Open /api/health
                </Link>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{stats.notificationInboxUnread} unread inbox items</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datastore snapshot</CardTitle>
              <CardDescription>Counts from Firestore (capped sample for issues).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <MetricRow label="Projects" value={stats.projects} />
              <MetricRow label="Issues (sample)" value={stats.issues} />
              <MetricRow label="Labels" value={stats.labels} />
              <MetricRow label="Pending events" value={health.pendingNotifications.length} />
              <MetricRow label="Failed events" value={health.failedNotifications.length} />
              <MetricRow label="Recurring jobs" value={health.recurringTemplates.length} />
            </CardContent>
          </Card>
        </div>

        {pilotFeedback.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent pilot feedback</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {pilotFeedback.slice(0, 6).map((feedback) => (
                <div key={feedback.id} className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                  <p className="font-medium">
                    {String(feedback.scenario ?? "Feedback")} · {String(feedback.rating ?? "-")}/5
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{String(feedback.friction ?? "No friction noted.")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section id="locations" className="scroll-mt-32">
        <ResourceSection
          icon={MapPin}
          title="Locations"
          description="Stores, HQ, warehouse, and global contexts. Deactivate instead of delete when issues exist."
          clearHref="/admin#locations"
          editing={Boolean(editLocation)}
          form={
            <form action={upsertLocation} className="space-y-4">
              <FormRow>
                <FormField label="ID (slug)" htmlFor="location-id" hint="Cannot change after create.">
                  <Input id="location-id" name="id" defaultValue={editLocation?.id ?? ""} placeholder="capitol-hill" required readOnly={Boolean(editLocation)} />
                </FormField>
                <FormField label="Display name" htmlFor="location-name">
                  <Input id="location-name" name="name" defaultValue={editLocation?.name ?? ""} placeholder="Capitol Hill" required />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Code" htmlFor="location-code">
                  <Input id="location-code" name="code" defaultValue={editLocation?.code ?? ""} placeholder="CH" required />
                </FormField>
                <FormField label="Kind" htmlFor="location-kind">
                  <SelectField name="kind" placeholder="Location kind" defaultValue={editLocation?.kind ?? "store"} options={locationKindOptions} />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Sort order" htmlFor="location-sort">
                  <Input id="location-sort" name="sort_order" type="number" defaultValue={String(editLocation?.sort_order ?? 100)} />
                </FormField>
                <FormField label="Status" htmlFor="location-active">
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input id="location-active" name="active" type="checkbox" defaultChecked={editLocation?.active !== false} />
                    Active
                  </label>
                </FormField>
              </FormRow>
              <Button type="submit">{editLocation ? "Update location" : "Add location"}</Button>
            </form>
          }
          table={
            <AdminTable
              headers={["Name", "ID", "Kind", "Status", "Actions"]}
              rows={locations.map((location) => [
                <span key="name" className="font-medium">
                  {location.name}
                </span>,
                <span key="id" className="font-mono text-xs text-muted-foreground">
                  {location.id}
                </span>,
                <LocationKindBadge key="kind" kind={location.kind} />,
                <Badge key="status" variant={location.active !== false ? "default" : "muted"}>
                  {location.active !== false ? "Active" : "Inactive"}
                </Badge>,
                <div key="actions" className="flex flex-wrap gap-1">
                  <Link href={`/admin?editLocation=${location.id}#locations`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    Edit
                  </Link>
                  <AdminConfirmSubmit action={deleteLocation} confirmMessage={`Deactivate “${location.name}”?`} className="inline">
                    <input type="hidden" name="id" value={location.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Deactivate
                    </Button>
                  </AdminConfirmSubmit>
                  <AdminConfirmSubmit
                    action={deleteLocation}
                    confirmMessage={`Permanently delete “${location.name}”? Only works if no issues reference it.`}
                    className="inline"
                  >
                    <input type="hidden" name="id" value={location.id} />
                    <input type="hidden" name="hard_delete" value="true" />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AdminConfirmSubmit>
                </div>,
              ])}
            />
          }
        />
      </section>

      <section id="labels" className="scroll-mt-32">
        <ResourceSection
          icon={Tag}
          title="Labels"
          description="Tags for filtering and scanning issues in the queue."
          editing={Boolean(editLabel)}
          clearHref="/admin#labels"
          form={
            <form action={upsertLabel} className="space-y-4">
              <FormRow>
                <FormField label="ID (slug)" htmlFor="label-id">
                  <Input id="label-id" name="id" defaultValue={editLabel?.id ?? ""} placeholder="vendor" required readOnly={Boolean(editLabel)} />
                </FormField>
                <FormField label="Name" htmlFor="label-name">
                  <Input id="label-name" name="name" defaultValue={editLabel?.name ?? ""} required />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Color" htmlFor="label-color">
                  <SelectField name="color" placeholder="Color" defaultValue={editLabel?.color ?? "gray"} options={labelColorOptions} />
                </FormField>
                <FormField label="Description" htmlFor="label-desc">
                  <Input id="label-desc" name="description" defaultValue={editLabel?.description ?? ""} />
                </FormField>
              </FormRow>
              <Button type="submit">{editLabel ? "Update label" : "Add label"}</Button>
            </form>
          }
          table={
            <AdminTable
              headers={["Name", "ID", "Color", "Actions"]}
              rows={labels.map((label) => [
                <span key="name" className="font-medium">
                  {label.name}
                </span>,
                <span key="id" className="font-mono text-xs text-muted-foreground">
                  {label.id}
                </span>,
                <Badge key="color" variant="muted">
                  {label.color}
                </Badge>,
                <div key="actions" className="flex flex-wrap gap-1">
                  <Link href={`/admin?editLabel=${label.id}#labels`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    Edit
                  </Link>
                  <AdminConfirmSubmit action={deleteLabel} confirmMessage={`Delete label “${label.name}”?`} className="inline">
                    <input type="hidden" name="id" value={label.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AdminConfirmSubmit>
                </div>,
              ])}
            />
          }
        />
      </section>

      <section id="users" className="scroll-mt-32">
        <ResourceSection
          icon={Users}
          title="Users"
          description="Profiles, roles, store assignment, and notification defaults."
          editing={Boolean(editUser)}
          clearHref="/admin#users"
          form={
            <form action={upsertUserProfile} className="space-y-4">
              <FormRow>
                <FormField
                  label="Firebase UID"
                  htmlFor="user-uid"
                  hint="Must match an existing Firebase Auth user. Find it in Firebase Console → Authentication."
                >
                  <Input id="user-uid" name="uid" defaultValue={editUser?.uid ?? ""} required readOnly={Boolean(editUser)} />
                </FormField>
                <FormField label="Display name" htmlFor="user-name">
                  <Input id="user-name" name="display_name" defaultValue={editUser?.display_name ?? ""} required />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Email" htmlFor="user-email">
                  <Input id="user-email" name="email" type="email" defaultValue={editUser?.email ?? ""} />
                </FormField>
                <FormField label="Role" htmlFor="user-role">
                  <SelectField
                    name="role"
                    placeholder="Role"
                    defaultValue={editUser?.role ?? "member"}
                    options={[
                      { value: "member", label: "Member" },
                      { value: "manager", label: "Manager" },
                      { value: "admin", label: "Admin" },
                    ]}
                  />
                </FormField>
              </FormRow>
              <FormField label="Stores / locations" hint="Managers and members can access issues at these locations.">
                <SidebarListPicker
                  name="store_ids"
                  mode="multiple"
                  selected={editUser ? profileStoreIds(editUser) : []}
                  options={locations
                    .filter((location) => location.active !== false)
                    .map((location) => ({ value: location.id, label: location.name, description: location.kind }))}
                  fieldLabel="Assigned locations"
                  dialogTitle="Select locations"
                  filterPlaceholder="Filter locations…"
                  noneLabel="No locations assigned"
                  display="embedded"
                />
              </FormField>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input name="active" type="checkbox" defaultChecked={editUser?.active !== false} /> Active
                </label>
                <label className="flex items-center gap-2">
                  <input name="notification_email" type="checkbox" defaultChecked={editUser?.notification_email !== false} /> Email
                </label>
                <label className="flex items-center gap-2">
                  <input name="notification_slack" type="checkbox" defaultChecked={editUser?.notification_slack === true} /> Slack
                </label>
              </div>
              <Button type="submit">{editUser ? "Update user" : "Save profile"}</Button>
            </form>
          }
          table={
            <AdminTable
              headers={["Name", "Role", "Locations", "Status", "Actions"]}
              rows={users.map((profile) => {
                const assigned = profileStoreIds(profile)
                  .map((id) => locations.find((location) => location.id === id))
                  .filter(Boolean);
                return [
                  <div key="name">
                    <p className="font-medium">{profile.display_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{profile.uid}</p>
                  </div>,
                  <RoleBadge key="role" role={profile.role} />,
                  assigned.length > 0 ? (
                    <span key="store" className="flex flex-wrap gap-1">
                      {assigned.map((store) => (
                        <LocationKindBadge key={store!.id} kind={store!.kind} name={store!.name} />
                      ))}
                    </span>
                  ) : (
                    <span key="store" className="text-xs text-muted-foreground">
                      —
                    </span>
                  ),
                  <Badge key="status" variant={profile.active !== false ? "default" : "muted"}>
                    {profile.active !== false ? "Active" : "Inactive"}
                  </Badge>,
                  <div key="actions" className="flex flex-wrap gap-1">
                    <Link href={`/admin?editUser=${profile.uid}#users`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                      Edit
                    </Link>
                    {profile.active !== false ? (
                      <AdminConfirmSubmit action={deactivateUserProfile} confirmMessage={`Deactivate ${profile.display_name}?`} className="inline">
                        <input type="hidden" name="uid" value={profile.uid} />
                        <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          Deactivate
                        </Button>
                      </AdminConfirmSubmit>
                    ) : null}
                  </div>,
                ];
              })}
            />
          }
        />
      </section>

      <section id="automation" className="scroll-mt-32">
        <ResourceSection
          icon={Activity}
          title="Recurring automation"
          description="Scheduled issue generation from templates."
          editing={Boolean(editRecurring)}
          clearHref="/admin#automation"
          form={
            <form action={upsertRecurringTemplate} className="space-y-4">
              {editRecurring ? <input type="hidden" name="id" value={editRecurring.id} /> : null}
              <FormField label="Name" htmlFor="recurring-name">
                <Input id="recurring-name" name="name" defaultValue={editRecurring?.name ?? ""} required />
              </FormField>
              <FormRow>
                <FormField label="Issue template" htmlFor="recurring-template">
                  <SelectField
                    name="template_id"
                    placeholder="Template"
                    defaultValue={editRecurring?.template_id ?? "weekly-inventory"}
                    options={ISSUE_TEMPLATES.map((template) => ({ value: template.id, label: template.name }))}
                  />
                </FormField>
                <FormField label="Cadence" htmlFor="recurring-cadence">
                  <SelectField
                    name="cadence"
                    placeholder="Cadence"
                    defaultValue={editRecurring?.cadence ?? "weekly"}
                    options={[
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                    ]}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Default location" htmlFor="recurring-location">
                  <SelectField
                    name="default_location_id"
                    placeholder="Location"
                    defaultValue={editRecurring?.default_location_id ?? ""}
                    options={[
                      { value: "", label: "Template default" },
                      ...locations.map((location) => ({ value: location.id, label: location.name })),
                    ]}
                  />
                </FormField>
                <FormField label="Next run" htmlFor="recurring-next">
                  <Input
                    id="recurring-next"
                    name="next_run_at"
                    type="date"
                    required
                    defaultValue={editRecurring?.next_run_at ? dateInput(editRecurring.next_run_at) : ""}
                  />
                </FormField>
                <FormField label="Due in days" htmlFor="recurring-due-days">
                  <Input
                    id="recurring-due-days"
                    name="due_days"
                    type="number"
                    min="1"
                    defaultValue={String(editRecurring?.due_days ?? 7)}
                  />
                </FormField>
              </FormRow>
              <label className="flex items-center gap-2 text-sm">
                <input name="active" type="checkbox" defaultChecked={editRecurring?.active !== false} /> Active
              </label>
              <Button type="submit">{editRecurring ? "Update schedule" : "Add schedule"}</Button>
            </form>
          }
          table={
            <AdminTable
              headers={["Name", "Cadence", "Next run", "Status", "Actions"]}
              rows={health.recurringTemplates.map((template) => [
                <span key="name" className="font-medium">
                  {template.name}
                </span>,
                <span key="cadence" className="capitalize">
                  {template.cadence}
                </span>,
                <span key="next">{formatDate(template.next_run_at)}</span>,
                <Badge key="status" variant={template.active ? "default" : "muted"}>
                  {template.active ? "Active" : "Paused"}
                </Badge>,
                <div key="actions" className="flex flex-wrap gap-1">
                  <Link href={`/admin?editRecurring=${template.id}#automation`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
                    Edit
                  </Link>
                  <AdminConfirmSubmit action={deleteRecurringTemplate} confirmMessage={`Delete “${template.name}”?`} className="inline">
                    <input type="hidden" name="id" value={template.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AdminConfirmSubmit>
                </div>,
              ])}
            />
          }
        />
      </section>

      <section id="notifications" className="scroll-mt-32 space-y-6">
        <SectionHeading icon={Bell} title="Notifications" description="Test routing and repair failed delivery events." />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Send test notification</CardTitle>
              <CardDescription>Creates inbox + outbound event for debugging email and Slack.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createTestNotification} className="space-y-3">
                <SelectField
                  name="recipient_uid"
                  placeholder="Recipient"
                  defaultValue={users.find((u) => u.active !== false)?.uid ?? ""}
                  options={users.filter((u) => u.active !== false).map((profile) => ({ value: profile.uid, label: profile.display_name }))}
                />
                <SelectField
                  name="channel"
                  placeholder="Channel"
                  defaultValue="email"
                  options={[
                    { value: "email", label: "Email only" },
                    { value: "slack", label: "Slack only" },
                    { value: "both", label: "Email + Slack" },
                  ]}
                />
                <Input name="issue_id" placeholder="Optional issue ID for deep link" />
                <Input name="subject" defaultValue="Seoul Bowl Ops test notification" />
                <textarea name="body" className="form-textarea min-h-24" defaultValue="Testing notification routing from Admin." />
                <Button type="submit" className="w-full">
                  Send test
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Failed events
              </CardTitle>
              <CardDescription>Retry or dismiss stuck notification pipeline events.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-80 space-y-2 overflow-auto">
              {health.failedNotifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failed events.</p>
              ) : (
                health.failedNotifications.map((event) => (
                  <div key={event.id} className="rounded-lg border border-border p-3 text-sm">
                    <p className="font-medium">{String(event.subject ?? "Notification")}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                    <div className="mt-2 flex gap-1">
                      <AdminConfirmSubmit action={retryNotificationEvent} confirmMessage="Re-queue this event?" className="inline">
                        <input type="hidden" name="id" value={event.id} />
                        <Button type="submit" size="sm" variant="outline">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Retry
                        </Button>
                      </AdminConfirmSubmit>
                      <AdminConfirmSubmit action={dismissNotificationEvent} confirmMessage="Dismiss this failure?" className="inline">
                        <input type="hidden" name="id" value={event.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Dismiss
                        </Button>
                      </AdminConfirmSubmit>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {health.pendingNotifications.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {health.pendingNotifications.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
                  <span>{String(event.subject ?? event.id)}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="h-5 w-5 text-muted-foreground" />
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ResourceSection({
  icon: Icon,
  title,
  description,
  form,
  table,
  editing,
  clearHref,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  form: ReactNode;
  table: ReactNode;
  editing?: boolean;
  clearHref?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading icon={Icon} title={title} description={description} />
        {editing && clearHref ? (
          <Link href={clearHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Cancel edit
          </Link>
        ) : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,340px)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{editing ? "Edit" : "Add"}</CardTitle>
          </CardHeader>
          <CardContent>{form}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configured</CardTitle>
            <CardDescription>Click edit or use row actions to manage records.</CardDescription>
          </CardHeader>
          <CardContent>{table}</CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing configured yet.</p>;
  }
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            {headers.map((header) => (
              <th key={header} className="pb-2 pr-4 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((cells, index) => (
            <tr key={index}>
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-3 pr-4 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  variant = "default",
}: {
  label: string;
  value: number;
  hint: string;
  variant?: "default" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border px-4 py-3",
        variant === "warn" && value > 0 ? "border-warning/40 bg-warning/5" : "bg-card shadow-card"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-secondary/50 px-3 py-2">
      <span>{label}</span>
      <span className={cn("text-xs font-semibold", ok ? "text-success" : "text-destructive")}>{ok ? "OK" : "Needs work"}</span>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
      )}
    >
      {label}
    </span>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

const locationKindOptions: { value: LocationKind; label: string }[] = [
  { value: "store", label: "Store" },
  { value: "warehouse", label: "Warehouse" },
  { value: "hq", label: "HQ" },
  { value: "office", label: "Office" },
  { value: "global", label: "Global" },
];

const labelColorOptions = [
  { value: "gray", label: "Gray" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
];

function dateInput(value: { toDate: () => Date }) {
  return value.toDate().toISOString().slice(0, 10);
}
