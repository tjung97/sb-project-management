"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { buttonVariants } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import type { EmployeeClient } from "@/src/lib/ops/hr-serialize";
import { formatDate } from "@/src/lib/ops/format";
import { cn } from "@/src/lib/utils";

const STATUS_LABEL: Record<EmployeeClient["employment_status"], string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
};

export function HrEmployeeDirectory({
  employees,
  locationNames,
}: {
  employees: EmployeeClient[];
  locationNames: Record<string, string>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((employee) => {
      const haystack = [
        employee.legal_name,
        employee.preferred_name,
        employee.email,
        employee.employee_number,
        employee.job_title,
        employee.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, role, #…"
            className="h-9 bg-background pl-8 text-sm"
            aria-label="Search employees"
          />
        </div>
        <Link href="/hr/new" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="h-3.5 w-3.5" />
          New employee
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.7fr] gap-2 border-b border-border bg-secondary/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Name</span>
          <span>Role</span>
          <span>Location</span>
          <span>Hire date</span>
          <span>Status</span>
        </div>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {employees.length === 0 ? "No employee records yet. Add your first team member." : "No matches for this search."}
          </p>
        ) : (
          filtered.map((employee) => (
            <Link
              key={employee.id}
              href={`/hr/${employee.id}`}
              className="grid grid-cols-[1.4fr_1fr_1fr_0.8fr_0.7fr] gap-2 border-b border-border px-4 py-3 text-sm transition last:border-b-0 hover:bg-accent/40"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">
                  {employee.preferred_name || employee.legal_name}
                </span>
                {employee.preferred_name ? (
                  <span className="block truncate text-xs text-muted-foreground">{employee.legal_name}</span>
                ) : null}
                {employee.employee_number ? (
                  <span className="font-mono text-[11px] text-muted-foreground">#{employee.employee_number}</span>
                ) : null}
              </span>
              <span className="min-w-0 truncate text-muted-foreground">{employee.job_title ?? "—"}</span>
              <span className="min-w-0 truncate text-muted-foreground">
                {employee.location_id ? locationNames[employee.location_id] ?? employee.location_id : "—"}
              </span>
              <span className="text-muted-foreground">
                {employee.hire_date ? formatDate(employee.hire_date) : "—"}
              </span>
              <span>
                <Badge
                  variant={
                    employee.employment_status === "active"
                      ? "default"
                      : employee.employment_status === "on_leave"
                        ? "warning"
                        : "outline"
                  }
                  className="text-[10px]"
                >
                  {STATUS_LABEL[employee.employment_status]}
                </Badge>
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
