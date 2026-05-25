import { AlertTriangle } from "lucide-react";
import { PriorityBadge } from "@/src/components/issues/IssueBadges";

export function UrgentBanner() {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/45 bg-destructive/10 px-4 py-3.5 text-sm text-destructive"
      role="status"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-medium">
        This issue is marked <span className="sr-only">urgent priority — </span>urgent and should be handled before other work.
      </p>
      <PriorityBadge priority="urgent" prominent />
    </div>
  );
}
