import Link from "next/link";
import { AlertTriangle, Calendar } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { AvatarStack } from "@/src/components/ops/AvatarStack";
import { LocationKindBadge } from "@/src/components/ops/LocationKindBadge";
import { cn } from "@/src/lib/utils";
import type { LocationKind } from "@/src/types/firestore";
import type { UserProfile } from "@/src/types/firestore";

export function IssueMetaChips({
  kind,
  locationKind,
  locationName,
  labels,
  dueAtFormatted,
  isOverdue,
  assigneeUids,
  usersById,
  parentIssue,
}: {
  kind: string;
  locationKind?: LocationKind;
  locationName?: string;
  labels: Array<{ id: string; name: string }>;
  dueAtFormatted: string | null;
  isOverdue: boolean;
  assigneeUids: string[];
  usersById: Map<string, UserProfile>;
  parentIssue?: { id: string; title: string } | null;
}) {
  const visibleLabels = labels.slice(0, 2);
  const labelOverflow = labels.length > 2 ? labels.length - 2 : 0;
  const kindLabel = kind.replaceAll("_", " ");

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {locationKind && locationName ? (
        <LocationKindBadge kind={locationKind} name={locationName} />
      ) : null}
      <Badge variant="muted">{kindLabel}</Badge>
      {visibleLabels.map((label) => (
        <Badge key={label.id} variant="outline">
          {label.name}
        </Badge>
      ))}
      {labelOverflow > 0 ? <Badge variant="outline">+{labelOverflow}</Badge> : null}
      {dueAtFormatted ? (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs tabular-nums",
            isOverdue
              ? "border-warning/50 bg-warning/10 font-medium text-warning-foreground"
              : "border-border bg-secondary text-muted-foreground"
          )}
        >
          {isOverdue ? <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden /> : <Calendar className="h-3 w-3 shrink-0" aria-hidden />}
          Due {dueAtFormatted}
        </span>
      ) : null}
      {assigneeUids.length > 0 ? (
        <Link href="#people" className="rounded-md hover:bg-accent/40" title="Jump to assignees">
          <AvatarStack uids={assigneeUids} usersById={usersById} />
        </Link>
      ) : (
        <Link href="#people" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Unassigned
        </Link>
      )}
      {parentIssue ? (
        <Link href={`/issues/${parentIssue.id}`} className="text-xs text-primary hover:underline">
          Parent: {parentIssue.title}
        </Link>
      ) : null}
    </div>
  );
}
