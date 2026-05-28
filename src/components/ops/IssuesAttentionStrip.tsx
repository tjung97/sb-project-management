import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Ban, CalendarClock, Flame, UserX } from "lucide-react";
import { cn } from "@/src/lib/utils";

type AttentionItem = {
  key: string;
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  tone: "danger" | "warning" | "info";
};

const toneClass: Record<AttentionItem["tone"], string> = {
  danger: "border-destructive/25 bg-destructive/[0.06] text-destructive hover:bg-destructive/[0.1]",
  warning: "border-warning/30 bg-warning/[0.07] text-warning hover:bg-warning/[0.12]",
  info: "border-info/25 bg-info/[0.06] text-info hover:bg-info/[0.1]",
};

export function IssuesAttentionStrip({
  urgent,
  blocked,
  overdue,
  unassigned,
  dueThisWeek,
}: {
  urgent: number;
  blocked: number;
  overdue: number;
  unassigned: number;
  dueThisWeek: number;
}) {
  const items: AttentionItem[] = [
    { key: "urgent", label: "Urgent", value: urgent, href: "/issues?priority=urgent", icon: Flame, tone: "danger" },
    { key: "blocked", label: "Blocked", value: blocked, href: "/issues?status=blocked", icon: Ban, tone: "danger" },
    { key: "overdue", label: "Overdue", value: overdue, href: "/issues?due=overdue", icon: AlertTriangle, tone: "warning" },
    { key: "unassigned", label: "Needs owner", value: unassigned, href: "/issues?unassigned=1", icon: UserX, tone: "info" },
    { key: "due-week", label: "Due this week", value: dueThisWeek, href: "/issues?due=week", icon: CalendarClock, tone: "info" },
  ];

  return (
    <section className="rounded-lg border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <span className="mr-1 shrink-0 text-xs font-medium text-muted-foreground">Needs attention</span>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition",
                item.value > 0 ? toneClass[item.tone] : "border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{item.label}</span>
              <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
