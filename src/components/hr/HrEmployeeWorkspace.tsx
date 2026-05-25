"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, FileText, FolderOpen, MessageSquare, User } from "lucide-react";
import { AdminConfirmSubmit } from "@/src/components/admin/AdminConfirmSubmit";
import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { FormField, FormRow } from "@/src/components/ui/form-layout";
import { SelectField } from "@/src/components/ui/select-field";
import {
  addCompEntry,
  addEmployeeFeedback,
  deactivateEmployee,
  deleteCompEntry,
  deleteEmployeeDocument,
  deleteEmployeeFeedback,
  deleteEmployeeFolder,
  uploadEmployeeDocument,
  upsertEmployee,
  upsertEmployeeFolder,
} from "@/src/lib/ops/hr-actions";
import { formatDate, formatDateTime } from "@/src/lib/ops/format";
import type {
  EmployeeClient,
  EmployeeCompEntryClient,
  EmployeeDocumentClient,
  EmployeeFeedbackClient,
  EmployeeFolderClient,
} from "@/src/lib/ops/hr-serialize";
import { cn } from "@/src/lib/utils";

const TABS = [
  { id: "overview", label: "Overview", icon: User },
  { id: "compensation", label: "Compensation", icon: FileText },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "files", label: "Files", icon: FolderOpen },
] as const;

type TabId = (typeof TABS)[number]["id"];

function dateInputValue(ms: number | null) {
  if (!ms) return "";
  const date = new Date(ms);
  return date.toISOString().slice(0, 10);
}

function formatComp(entry: { pay_type: string; amount: number; currency: string; pay_frequency: string }) {
  const amount = new Intl.NumberFormat("en", { style: "currency", currency: entry.currency || "USD" }).format(entry.amount);
  const freq = entry.pay_frequency === "annual" ? "/yr" : entry.pay_frequency === "monthly" ? "/mo" : `/${entry.pay_frequency}`;
  return `${amount}${entry.pay_type === "hourly" ? "/hr" : freq}`;
}

export function HrEmployeeWorkspace({
  employee,
  compEntries,
  feedback,
  folders,
  documents,
  locations,
  employees,
  userProfiles,
  tab,
  folderId,
}: {
  employee: EmployeeClient;
  compEntries: EmployeeCompEntryClient[];
  feedback: EmployeeFeedbackClient[];
  folders: EmployeeFolderClient[];
  documents: EmployeeDocumentClient[];
  locations: Array<{ id: string; name: string }>;
  employees: Array<{ id: string; name: string }>;
  userProfiles: Array<{ uid: string; display_name: string; email: string | null }>;
  tab: TabId;
  folderId: string | null;
}) {
  const displayName = employee.preferred_name || employee.legal_name;
  const activeFolder = folderId ?? null;
  const folderDocuments = useMemo(
    () => documents.filter((doc) => (activeFolder ? doc.folder_id === activeFolder : doc.folder_id == null)),
    [documents, activeFolder]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/hr" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            People
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[employee.job_title, employee.department].filter(Boolean).join(" · ") || "Employee record"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={employee.employment_status === "active" ? "default" : "muted"}>
            {employee.employment_status.replace("_", " ")}
          </Badge>
          {employee.current_comp ? (
            <span className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs font-medium">
              {formatComp(employee.current_comp)}
            </span>
          ) : null}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={`/hr/${employee.id}?tab=${item.id}`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-t-md border border-transparent px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-border border-b-background bg-card text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {tab === "overview" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Employment details, contact info, and internal notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertEmployee} className="space-y-4">
              <input type="hidden" name="id" value={employee.id} />
              <FormRow>
                <FormField label="Legal name">
                  <Input name="legal_name" defaultValue={employee.legal_name} required />
                </FormField>
                <FormField label="Preferred name">
                  <Input name="preferred_name" defaultValue={employee.preferred_name ?? ""} />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Employee #">
                  <Input name="employee_number" defaultValue={employee.employee_number ?? ""} />
                </FormField>
                <FormField label="Status">
                  <SelectField
                    name="employment_status"
                    placeholder="Status"
                    defaultValue={employee.employment_status}
                    options={[
                      { value: "active", label: "Active" },
                      { value: "on_leave", label: "On leave" },
                      { value: "terminated", label: "Terminated" },
                    ]}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Email">
                  <Input name="email" type="email" defaultValue={employee.email ?? ""} />
                </FormField>
                <FormField label="Phone">
                  <Input name="phone" defaultValue={employee.phone ?? ""} />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Job title">
                  <Input name="job_title" defaultValue={employee.job_title ?? ""} />
                </FormField>
                <FormField label="Department">
                  <Input name="department" defaultValue={employee.department ?? ""} />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Primary location">
                  <SelectField
                    name="location"
                    defaultValue={employee.location_id ?? ""}
                    placeholder="None"
                    options={[{ value: "", label: "None" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]}
                  />
                </FormField>
                <FormField label="Manager">
                  <SelectField
                    name="manager_employee_id"
                    defaultValue={employee.manager_employee_id ?? ""}
                    placeholder="None"
                    options={[
                      { value: "", label: "None" },
                      ...employees.filter((e) => e.id !== employee.id).map((e) => ({ value: e.id, label: e.name })),
                    ]}
                  />
                </FormField>
              </FormRow>
              <FormRow>
                <FormField label="Hire date">
                  <Input name="hire_date" type="date" defaultValue={dateInputValue(employee.hire_date)} />
                </FormField>
                <FormField label="Termination date">
                  <Input name="termination_date" type="date" defaultValue={dateInputValue(employee.termination_date)} />
                </FormField>
              </FormRow>
              <FormField label="Linked app user">
                <SelectField
                  name="uid"
                  defaultValue={employee.uid ?? ""}
                  placeholder="No login linked"
                  options={[
                    { value: "", label: "No login linked" },
                    ...userProfiles.map((profile) => ({
                      value: profile.uid,
                      label: `${profile.display_name}${profile.email ? ` (${profile.email})` : ""}`,
                    })),
                  ]}
                />
              </FormField>
              <FormField label="Internal notes">
                <textarea
                  name="notes"
                  defaultValue={employee.notes}
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  Save profile
                </Button>
                {employee.employment_status !== "terminated" ? (
                  <AdminConfirmSubmit
                    action={deactivateEmployee}
                    confirmMessage={`Mark ${displayName} as terminated?`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <input type="hidden" name="employee_id" value={employee.id} />
                    Mark terminated
                  </AdminConfirmSubmit>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {tab === "compensation" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compensation history</CardTitle>
              <CardDescription>Track pay changes with effective dates.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {compEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No compensation entries yet.</p>
              ) : (
                compEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{formatComp(entry)}</p>
                      <p className="text-xs text-muted-foreground">
                        Effective {formatDate(entry.effective_date)}
                        {entry.job_title ? ` · ${entry.job_title}` : ""}
                      </p>
                      {entry.notes ? <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p> : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {entry.created_by_name} · {formatDateTime(entry.created_at)}
                      </p>
                    </div>
                    <AdminConfirmSubmit
                      action={deleteCompEntry}
                      confirmMessage="Delete this compensation entry?"
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 text-xs")}
                    >
                      <input type="hidden" name="employee_id" value={employee.id} />
                      <input type="hidden" name="entry_id" value={entry.id} />
                      Remove
                    </AdminConfirmSubmit>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add comp entry</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addCompEntry} className="space-y-3">
                <input type="hidden" name="employee_id" value={employee.id} />
                <FormField label="Pay type">
                  <SelectField
                    name="pay_type"
                    placeholder="Pay type"
                    defaultValue="salary"
                    options={[
                      { value: "salary", label: "Salary" },
                      { value: "hourly", label: "Hourly" },
                    ]}
                  />
                </FormField>
                <FormField label="Amount">
                  <Input name="amount" type="number" step="0.01" min="0" required />
                </FormField>
                <FormField label="Currency">
                  <Input name="currency" defaultValue="USD" />
                </FormField>
                <FormField label="Frequency">
                  <SelectField
                    name="pay_frequency"
                    placeholder="Frequency"
                    defaultValue="annual"
                    options={[
                      { value: "annual", label: "Annual" },
                      { value: "monthly", label: "Monthly" },
                      { value: "biweekly", label: "Biweekly" },
                      { value: "weekly", label: "Weekly" },
                    ]}
                  />
                </FormField>
                <FormField label="Effective date">
                  <Input name="effective_date" type="date" required />
                </FormField>
                <FormField label="Title at time">
                  <Input name="job_title" defaultValue={employee.job_title ?? ""} />
                </FormField>
                <FormField label="Notes">
                  <textarea name="notes" rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </FormField>
                <Button type="submit" size="sm" className="w-full">
                  Add entry
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "feedback" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feedback & reviews</CardTitle>
              <CardDescription>Performance notes, check-ins, and recognition.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback recorded yet.</p>
              ) : (
                feedback.map((item) => (
                  <article key={item.id} className="rounded-md border border-border px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.type.replace("_", " ")}
                          {item.rating != null ? ` · ${item.rating}/5` : ""} · {item.author_name} ·{" "}
                          {formatDateTime(item.created_at)}
                        </p>
                      </div>
                      <AdminConfirmSubmit
                        action={deleteEmployeeFeedback}
                        confirmMessage="Delete this feedback entry?"
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 text-xs")}
                      >
                        <input type="hidden" name="employee_id" value={employee.id} />
                        <input type="hidden" name="feedback_id" value={item.id} />
                        Delete
                      </AdminConfirmSubmit>
                    </div>
                    {item.body ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">{item.body}</p> : null}
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={addEmployeeFeedback} className="space-y-3">
                <input type="hidden" name="employee_id" value={employee.id} />
                <FormField label="Type">
                  <SelectField
                    name="feedback_type"
                    placeholder="Type"
                    defaultValue="check_in"
                    options={[
                      { value: "review", label: "Review" },
                      { value: "check_in", label: "Check-in" },
                      { value: "recognition", label: "Recognition" },
                      { value: "concern", label: "Concern" },
                      { value: "other", label: "Other" },
                    ]}
                  />
                </FormField>
                <FormField label="Title">
                  <Input name="title" required />
                </FormField>
                <FormField label="Rating (1–5)">
                  <Input name="rating" type="number" min="1" max="5" />
                </FormField>
                <FormField label="Notes">
                  <textarea name="body" rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </FormField>
                <Button type="submit" size="sm" className="w-full">
                  Save feedback
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "files" ? (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Folders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <Link
                href={`/hr/${employee.id}?tab=files`}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-sm transition",
                  !activeFolder ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                Unfiled
              </Link>
              {folders.map((folder) => (
                <div key={folder.id} className="group flex items-center gap-1">
                  <Link
                    href={`/hr/${employee.id}?tab=files&folder=${folder.id}`}
                    className={cn(
                      "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm transition",
                      activeFolder === folder.id
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/50"
                    )}
                  >
                    {folder.name}
                  </Link>
                  <AdminConfirmSubmit
                    action={deleteEmployeeFolder}
                    confirmMessage={`Delete folder "${folder.name}"?`}
                    className="rounded px-1 text-[10px] text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  >
                    <input type="hidden" name="employee_id" value={employee.id} />
                    <input type="hidden" name="folder_id" value={folder.id} />
                    ×
                  </AdminConfirmSubmit>
                </div>
              ))}
              <form action={upsertEmployeeFolder} className="mt-3 flex gap-1 border-t border-border pt-3">
                <input type="hidden" name="employee_id" value={employee.id} />
                <Input name="name" placeholder="New folder" className="h-8 text-xs" required />
                <Button type="submit" size="sm" variant="secondary" className="h-8 shrink-0 px-2 text-xs">
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {activeFolder ? folders.find((f) => f.id === activeFolder)?.name ?? "Folder" : "Unfiled documents"}
              </CardTitle>
              <CardDescription>Contracts, reviews, IDs, and other HR documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={uploadEmployeeDocument} className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 sm:flex-row sm:items-end">
                <input type="hidden" name="employee_id" value={employee.id} />
                {activeFolder ? <input type="hidden" name="folder_id" value={activeFolder} /> : null}
                <FormField label="Display name" className="flex-1">
                  <Input name="name" placeholder="Optional label" className="h-8 text-sm" />
                </FormField>
                <FormField label="File" className="flex-1">
                  <Input name="file" type="file" required className="h-8 text-sm file:mr-2 file:text-xs" />
                </FormField>
                <Button type="submit" size="sm" className="shrink-0">
                  Upload
                </Button>
              </form>

              {folderDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files in this folder.</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {folderDocuments.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <a
                          href={doc.download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-medium text-primary hover:underline"
                        >
                          {doc.name}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_name} · {(doc.size_bytes / 1024).toFixed(1)} KB · {doc.uploaded_by_name} ·{" "}
                          {formatDateTime(doc.uploaded_at)}
                        </p>
                      </div>
                      <AdminConfirmSubmit
                        action={deleteEmployeeDocument}
                        confirmMessage={`Delete "${doc.name}"?`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 text-xs")}
                      >
                        <input type="hidden" name="employee_id" value={employee.id} />
                        <input type="hidden" name="document_id" value={doc.id} />
                        Delete
                      </AdminConfirmSubmit>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
