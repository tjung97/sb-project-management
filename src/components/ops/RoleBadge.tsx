import { Shield, UserCog, UserRound } from "lucide-react";
import { roleStyles } from "@/src/lib/ops/semantic";
import { cn } from "@/src/lib/utils";
import type { UserRole } from "@/src/types/firestore";

const icons = {
  admin: Shield,
  manager: UserCog,
  member: UserRound,
} as const;

export function RoleBadge({ role, className }: { role: UserRole; className?: string }) {
  const style = roleStyles[role];
  const Icon = icons[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium",
        style.badgeClass,
        className
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {style.label}
    </span>
  );
}
