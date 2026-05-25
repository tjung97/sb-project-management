import { Badge } from "@/src/components/ui/badge";
import { UserAvatar } from "@/src/components/ops/UserAvatar";
import type { UserProfile } from "@/src/types/firestore";

export function AvatarStack({
  uids,
  usersById,
  max = 4,
  emptyLabel = "Unassigned",
}: {
  uids: string[];
  usersById: Map<string, UserProfile>;
  max?: number;
  emptyLabel?: string;
}) {
  if (uids.length === 0) {
    return (
      <Badge variant="muted" className="font-normal">
        {emptyLabel}
      </Badge>
    );
  }

  const visible = uids.slice(0, max);
  const overflow = uids.length - visible.length;
  const names = uids.map((uid) => usersById.get(uid)?.display_name ?? "Team member").join(", ");

  return (
    <span className="inline-flex items-center gap-1" title={names}>
      <span className="flex -space-x-2">
        {visible.map((uid) => {
          const user = usersById.get(uid);
          return (
            <span key={uid} className="ring-2 ring-card rounded-full">
              <UserAvatar uid={uid} name={user?.display_name ?? "Team member"} size="sm" />
            </span>
          );
        })}
      </span>
      {overflow > 0 ? <span className="text-xs text-muted-foreground">+{overflow}</span> : null}
    </span>
  );
}
