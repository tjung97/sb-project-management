import { avatarColor, initials } from "@/src/lib/ops/avatar";
import { cn } from "@/src/lib/utils";

export function UserAvatar({
  uid,
  name,
  size = "md",
  className,
}: {
  uid: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const colors = avatarColor(uid);
  const sizeClass = size === "sm" ? "h-6 w-6 text-[10px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";

  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-1", sizeClass, className)}
      style={{ backgroundColor: colors.background, color: colors.color, boxShadow: `inset 0 0 0 1px ${colors.ring}` }}
    >
      {initials(name)}
    </span>
  );
}
