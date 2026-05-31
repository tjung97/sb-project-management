"use client";

import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, ReceiptText, X } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardListBody, CardListHeader } from "@/src/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { cn } from "@/src/lib/utils";
import { useToastPanel } from "@/src/components/toast/ToastPanelContext";
import type { ToastOpsSummary, ToastLaborEmployeeStatus } from "@/src/lib/toast/api";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function ToastOpsSidebar({ summary }: { summary: ToastOpsSummary }) {
  const pathname = usePathname();
  const { open, hydrated, toggle } = useToastPanel();
  const routeCollapsed = hydrated && pathname.startsWith("/issues/");
  const topMix = summary.sales.productMix.slice(0, 5);
  const visibleEmployees = summary.labor.employees.slice(0, 6);

  return (
    <aside
      className={cn(
        "toast-panel liquid-side-panel",
        hydrated && !open && "toast-panel--closed",
        routeCollapsed && "toast-panel--route-collapsed"
      )}
      aria-label="Toast operations"
    >
      <Card className="border-0 bg-transparent shadow-none">
        <CardListHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ReceiptText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">Toast today</h2>
                <p className="text-[11px] text-muted-foreground">{formatBusinessDate(summary.businessDate)}</p>
              </div>
            </div>
            <Badge variant={summary.error ? "warning" : "success"} className="shrink-0">
              {summary.error ? "Setup" : "Live"}
            </Badge>
            <button
              type="button"
              onClick={toggle}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Close Toast panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {summary.error ? <p className="text-xs leading-relaxed text-muted-foreground">{summary.error}</p> : null}
        </CardListHeader>

        <CardContent className="space-y-3">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="w-full rounded-md border border-border/80 bg-background p-3 text-left transition hover:border-foreground/20 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Sales
                  </span>
                  <span className="text-[11px] text-muted-foreground">{summary.sales.orderCount} orders</span>
                </div>
                <p className="mt-2 text-2xl font-semibold leading-none">{compactMoney.format(summary.sales.netSales)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Press for product mix</p>
              </button>
            </DialogTrigger>
            <ProductMixDialog summary={summary} />
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="w-full rounded-md border border-border/80 bg-background p-3 text-left transition hover:border-foreground/20 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <BriefcaseBusiness className="h-3.5 w-3.5" />
                    Labor
                  </span>
                  <span className="text-[11px] text-muted-foreground">{summary.labor.laborHours.toFixed(1)} hrs</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <LaborCount label="Working" value={summary.labor.activeCount} tone="working" />
                  <LaborCount label="Break" value={summary.labor.breakCount} tone="break" />
                  <LaborCount label="Off" value={summary.labor.offCount} tone="off" />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">Press for team status</p>
              </button>
            </DialogTrigger>
            <LaborDialog summary={summary} />
          </Dialog>
        </CardContent>

        <CardListBody>
          <div className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Top items</p>
              <span className="text-[11px] text-muted-foreground">{topMix.length || 0}</span>
            </div>
            <div className="space-y-2">
              {topMix.length ? (
                topMix.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{item.quantity.toFixed(0)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No item sales yet.</p>
              )}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">Team now</p>
              <span className="text-[11px] text-muted-foreground">{summary.labor.employees.length}</span>
            </div>
            <div className="space-y-2">
              {visibleEmployees.length ? (
                visibleEmployees.map((employee) => <EmployeeStatusRow key={employee.id} employee={employee} compact />)
              ) : (
                <p className="text-xs text-muted-foreground">No labor entries yet.</p>
              )}
            </div>
          </div>
        </CardListBody>
      </Card>
    </aside>
  );
}

function ProductMixDialog({ summary }: { summary: ToastOpsSummary }) {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Product mix</DialogTitle>
        <DialogDescription>
          {formatBusinessDate(summary.businessDate)} sales by item from Toast orders.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-border/80">
        {summary.sales.productMix.length ? (
          summary.sales.productMix.map((item) => (
            <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] gap-3 border-b border-border/80 px-3 py-2 text-sm last:border-b-0">
              <span className="min-w-0 truncate">{item.name}</span>
              <span className="text-right tabular-nums text-muted-foreground">{item.quantity.toFixed(0)}</span>
              <span className="text-right tabular-nums">{money.format(item.netSales)}</span>
            </div>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No product mix data is available yet.</p>
        )}
      </div>
    </DialogContent>
  );
}

function LaborDialog({ summary }: { summary: ToastOpsSummary }) {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Labor now</DialogTitle>
        <DialogDescription>
          Clocked in, on break, and off-shift team status for {formatBusinessDate(summary.businessDate)}.
        </DialogDescription>
      </DialogHeader>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Metric label="Working" value={String(summary.labor.activeCount)} />
        <Metric label="Break" value={String(summary.labor.breakCount)} />
        <Metric label="Labor cost" value={money.format(summary.labor.laborCost)} />
      </div>
      <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-border/80">
        {summary.labor.employees.length ? (
          summary.labor.employees.map((employee) => (
            <div key={employee.id} className="border-b border-border/80 px-3 py-2 last:border-b-0">
              <EmployeeStatusRow employee={employee} />
            </div>
          ))
        ) : (
          <p className="p-4 text-sm text-muted-foreground">No labor data is available yet.</p>
        )}
      </div>
    </DialogContent>
  );
}

function LaborCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: ToastLaborEmployeeStatus["status"];
}) {
  return (
    <div className="rounded-md bg-muted/60 px-2 py-2">
      <p className={cn("text-lg font-semibold leading-none", tone === "break" && "text-warning-foreground", tone === "working" && "text-success")}>{value}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EmployeeStatusRow({ employee, compact = false }: { employee: ToastLaborEmployeeStatus; compact?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot status={employee.status} />
          <p className={cn("min-w-0 truncate font-medium", compact ? "max-w-36" : "max-w-72")}>{employee.name}</p>
        </div>
        {!compact ? (
          <p className="mt-1 truncate text-muted-foreground">
            {employee.job}
            {employee.clockIn ? ` - in ${formatTime(employee.clockIn)}` : ""}
            {employee.breakStart ? ` - break ${formatTime(employee.breakStart)}` : ""}
          </p>
        ) : null}
      </div>
      <Badge variant={employee.status === "working" ? "success" : employee.status === "break" ? "warning" : "muted"} className="shrink-0">
        {employee.status === "working" ? "Working" : employee.status === "break" ? "Break" : "Off"}
      </Badge>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/80 bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function StatusDot({ status }: { status: ToastLaborEmployeeStatus["status"] }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        status === "working" && "bg-success",
        status === "break" && "bg-warning",
        status === "off" && "bg-muted-foreground/40"
      )}
    />
  );
}

function formatBusinessDate(value: string) {
  if (value.length !== 8) return value;
  return `${value.slice(4, 6)}/${value.slice(6, 8)}/${value.slice(0, 4)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
