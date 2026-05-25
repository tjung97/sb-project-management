import { Building2, Globe, Store, Warehouse } from "lucide-react";
import { locationKindStyles } from "@/src/lib/ops/semantic";
import { cn } from "@/src/lib/utils";
import type { LocationKind } from "@/src/types/firestore";

const icons = {
  store: Store,
  warehouse: Warehouse,
  hq: Building2,
  office: Building2,
  global: Globe,
} as const;

export function LocationKindBadge({
  kind,
  name,
  className,
}: {
  kind: LocationKind;
  name?: string;
  className?: string;
}) {
  const style = locationKindStyles[kind];
  const Icon = icons[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium",
        style.badgeClass,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {name ?? style.label}
    </span>
  );
}
