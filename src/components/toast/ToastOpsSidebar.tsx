"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight, ReceiptText, X } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardListHeader } from "@/src/components/ui/card";
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
import { ItemSalesChart } from "@/src/components/toast/ItemSalesChart";
import type { ToastOpsSummary, ToastStoreSummary, ToastLaborEmployeeStatus } from "@/src/lib/toast/api";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ToastOpsSidebar({ stores }: { stores: ToastStoreSummary[] }) {
  const pathname = usePathname();
  const { open, hydrated, toggle } = useToastPanel();
  const routeCollapsed = hydrated && (pathname.startsWith("/issues/") || pathname.startsWith("/operations"));

  const configured = stores.some((s) => s.summary.configured);
  const setupError = stores.find((s) => s.summary.error)?.summary.error ?? null;
  const businessDate = stores[0]?.summary.businessDate ?? "";
  const ranked = [...stores].sort((a, b) => b.summary.sales.netSales - a.summary.sales.netSales);

  const totalSales = stores.reduce((sum, s) => sum + s.summary.sales.netSales, 0);
  const totalOrders = stores.reduce((sum, s) => sum + s.summary.sales.orderCount, 0);
  const totalWorking = stores.reduce((sum, s) => sum + s.summary.labor.activeCount, 0);

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
                <p className="text-[11px] text-muted-foreground">{formatBusinessDate(businessDate)}</p>
              </div>
            </div>
            <Badge variant={!configured ? "warning" : "success"} className="shrink-0">
              {!configured ? "Setup" : "Live"}
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
        </CardListHeader>

        <CardContent className="space-y-2">
          {!configured ? (
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              {setupError ?? "Add Toast API env values to enable live sales."}
            </p>
          ) : (
            <>
              {/* Combined total */}
              <div className="rounded-md border border-border/80 bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">All stores</span>
                  <span className="text-[11px] text-muted-foreground">
                    {totalOrders} orders · {totalWorking} working
                  </span>
                </div>
                <p className="mt-0.5 text-xl font-semibold leading-none">{compactMoney.format(totalSales)}</p>
              </div>

              {/* Thin sales card per store */}
              <div className="space-y-1.5">
                {ranked.map((store) => (
                  <Dialog key={store.guid}>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-md border border-border/80 bg-background px-3 py-2 text-left transition hover:border-foreground/20 hover:bg-accent/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{shortName(store.name)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {store.summary.sales.orderCount} orders · {store.summary.labor.laborHours.toFixed(0)}h
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-sm font-semibold tabular-nums">
                            {compactMoney.format(store.summary.sales.netSales)}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </button>
                    </DialogTrigger>
                    <StoreDetailDialog store={store} />
                  </Dialog>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

function StoreDetailDialog({ store }: { store: ToastStoreSummary }) {
  const [tab, setTab] = useState<"mix" | "team">("mix");
  const { summary } = store;

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{shortName(store.name)}</DialogTitle>
        <DialogDescription>
          {compactMoney.format(summary.sales.netSales)} net · {summary.sales.orderCount} orders ·{" "}
          {summary.labor.laborHours.toFixed(1)}h labor · {formatBusinessDate(summary.businessDate)}
        </DialogDescription>
      </DialogHeader>

      <div className="mt-1 inline-flex rounded-lg border border-border/80 bg-card p-0.5 text-sm">
        <TabButton active={tab === "mix"} onClick={() => setTab("mix")}>
          Product mix
        </TabButton>
        <TabButton active={tab === "team"} onClick={() => setTab("team")}>
          Team
        </TabButton>
      </div>

      {tab === "mix" ? <ProductMixView summary={summary} guid={store.guid} /> : <LaborView summary={summary} />}
    </DialogContent>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1 font-medium transition",
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ProductMixView({ summary, guid }: { summary: ToastOpsSummary; guid: string }) {
  const [selected, setSelected] = useState<string | null>(null);

  if (selected) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="-ml-1 mb-1 flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All items
        </button>
        <p className="mb-2 text-sm font-semibold">{selected}</p>
        <ItemSalesChart key={`${guid}-${selected}`} itemName={selected} guid={guid} days={90} />
      </div>
    );
  }

  return (
    <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-lg border border-border/80">
      {summary.sales.productMix.length ? (
        summary.sales.productMix.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setSelected(item.name)}
            className="grid w-full grid-cols-[minmax(0,1fr)_3rem_5rem_1rem] items-center gap-3 border-b border-border/80 px-3 py-2 text-left text-sm transition last:border-b-0 hover:bg-accent/40"
          >
            <span className="min-w-0 truncate">{item.name}</span>
            <span className="text-right tabular-nums text-muted-foreground">{item.quantity.toFixed(0)}</span>
            <span className="text-right tabular-nums">{money.format(item.netSales)}</span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))
      ) : (
        <p className="p-4 text-sm text-muted-foreground">No product mix data is available yet.</p>
      )}
    </div>
  );
}

function LaborView({ summary }: { summary: ToastOpsSummary }) {
  return (
    <div className="mt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Metric label="Working" value={String(summary.labor.activeCount)} />
        <Metric label="Break" value={String(summary.labor.breakCount)} />
        <Metric label="Labor cost" value={money.format(summary.labor.laborCost)} />
      </div>
      <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-lg border border-border/80">
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
    </div>
  );
}

function EmployeeStatusRow({ employee }: { employee: ToastLaborEmployeeStatus }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot status={employee.status} />
          <p className="min-w-0 max-w-72 truncate font-medium">{employee.name}</p>
        </div>
        <p className="mt-1 truncate text-muted-foreground">{timecardLine(employee)}</p>
      </div>
      <Badge variant={employee.status === "working" ? "success" : employee.status === "break" ? "warning" : "muted"} className="shrink-0">
        {statusLabel(employee.status)}
      </Badge>
    </div>
  );
}

function timecardLine(employee: ToastLaborEmployeeStatus) {
  const parts = [employee.job];
  if (employee.status === "clocked_out") {
    if (employee.clockIn && employee.clockOut) parts.push(`${formatTime(employee.clockIn)}–${formatTime(employee.clockOut)}`);
    parts.push(`${employee.hours.toFixed(1)}h`);
    if (employee.overtimeHours > 0) parts.push(`${employee.overtimeHours.toFixed(1)}h OT`);
    if (employee.breakMinutes > 0) parts.push(`${Math.round(employee.breakMinutes)}m break`);
  } else {
    if (employee.clockIn) parts.push(`in ${formatTime(employee.clockIn)}`);
    if (employee.breakStart) parts.push(`break ${formatTime(employee.breakStart)}`);
  }
  return parts.join(" · ");
}

function statusLabel(status: ToastLaborEmployeeStatus["status"]) {
  if (status === "working") return "Working";
  if (status === "break") return "Break";
  return "Clocked out";
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
        status === "clocked_out" && "bg-muted-foreground/40"
      )}
    />
  );
}

// "Seoul Bowl Bellevue" -> "Bellevue"; keeps it short for the narrow panel.
function shortName(name: string) {
  return name.replace(/^seoul bowl\s*-?\s*/i, "").trim() || name;
}

function formatBusinessDate(value: string) {
  if (value.length !== 8) return value;
  return `${value.slice(4, 6)}/${value.slice(6, 8)}/${value.slice(0, 4)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
