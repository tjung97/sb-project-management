"use client";

import * as React from "react";
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/src/components/ui/chart";
import type { ToastItemHistory, ToastItemSalesPoint } from "@/src/lib/toast/api";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const chartConfig = {
  quantity: { label: "Qty sold", color: "hsl(var(--primary))" },
  avg: { label: "7-day avg", color: "hsl(var(--info))" },
} satisfies ChartConfig;

type ChartPoint = ToastItemSalesPoint & { avg: number | null };

export function ItemSalesChart({ itemName, guid, days = 90 }: { itemName: string; guid?: string; days?: number }) {
  const [history, setHistory] = React.useState<ToastItemHistory | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const controller = new AbortController();
    const guidParam = guid ? `&guid=${encodeURIComponent(guid)}` : "";

    fetch(`/api/toast/item-history?name=${encodeURIComponent(itemName)}&days=${days}${guidParam}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = (await res.json()) as ToastItemHistory & { error?: string };
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status}).`);
        setHistory(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not load sales history.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [itemName, guid, days]);

  const points = React.useMemo<ChartPoint[]>(() => withMovingAverage(history?.points ?? [], 7), [history]);
  const trend = React.useMemo(() => computeTrend(history?.points ?? []), [history]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading 3-month history…</div>;
  }

  if (error) {
    return <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">{error}</div>;
  }

  if (!history || history.totalQuantity === 0) {
    return (
      <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No sales recorded for this item in the last {days} days.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label="Sold" value={history.totalQuantity.toLocaleString()} sub={`last ${days} days`} />
        <Stat label="Revenue" value={money.format(history.totalNetSales)} sub={`last ${days} days`} />
        <TrendStat trend={trend} />
      </div>

      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
        <ComposedChart data={points} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="fillQuantity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-quantity)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-quantity)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={28}
            tickFormatter={formatAxisDate}
          />
          <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent labelFormatter={(value) => formatFullDate(String(value))} indicator="line" />}
          />
          <Area
            dataKey="quantity"
            type="monotone"
            fill="url(#fillQuantity)"
            stroke="var(--color-quantity)"
            strokeWidth={1.5}
          />
          <Line dataKey="avg" type="monotone" stroke="var(--color-avg)" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-border/80 bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function TrendStat({ trend }: { trend: Trend }) {
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const tone =
    trend.direction === "up" ? "text-success" : trend.direction === "down" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-md border border-border/80 bg-background p-3">
      <p className="text-xs text-muted-foreground">Trend</p>
      <p className={`mt-1 flex items-center gap-1 text-lg font-semibold leading-none ${tone}`}>
        <Icon className="h-4 w-4" />
        {trend.label}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">vs. start of period</p>
    </div>
  );
}

function withMovingAverage(points: ToastItemSalesPoint[], window: number): ChartPoint[] {
  return points.map((point, index) => {
    if (index < window - 1) return { ...point, avg: null };
    let sum = 0;
    for (let i = index - window + 1; i <= index; i++) sum += points[i].quantity;
    return { ...point, avg: Math.round((sum / window) * 100) / 100 };
  });
}

type Trend = { direction: "up" | "down" | "flat"; label: string };

// Compare the average daily quantity of the first half vs the second half of the
// window to summarize whether the item is gaining or losing popularity.
function computeTrend(points: ToastItemSalesPoint[]): Trend {
  if (points.length < 4) return { direction: "flat", label: "—" };
  const mid = Math.floor(points.length / 2);
  const avg = (slice: ToastItemSalesPoint[]) =>
    slice.reduce((total, point) => total + point.quantity, 0) / Math.max(1, slice.length);
  const first = avg(points.slice(0, mid));
  const second = avg(points.slice(mid));
  if (first === 0 && second === 0) return { direction: "flat", label: "—" };
  if (first === 0) return { direction: "up", label: "New" };
  const change = ((second - first) / first) * 100;
  if (change >= 10) return { direction: "up", label: `+${Math.round(change)}%` };
  if (change <= -10) return { direction: "down", label: `${Math.round(change)}%` };
  return { direction: "flat", label: "Steady" };
}

function formatAxisDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatFullDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
}
