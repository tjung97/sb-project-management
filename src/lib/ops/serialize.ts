import type { ActivityEventWithId, UserProfile } from "@/src/types/firestore";

export type TimestampLike =
  | { toMillis?: () => number; toDate?: () => Date; _seconds?: number; _nanoseconds?: number }
  | Date
  | string
  | number
  | null
  | undefined;

export function timestampToMillis(value: TimestampLike): number {
  if (value == null) return Date.now();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value._seconds === "number") {
    return value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1_000_000);
  }
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return Date.now();
}

export type ActivityEventClient = Omit<ActivityEventWithId, "created_at"> & { created_at: number };

export function serializeActivityEvent(event: ActivityEventWithId): ActivityEventClient {
  return {
    id: event.id,
    type: event.type,
    actor_uid: event.actor_uid,
    actor_name: event.actor_name,
    summary: event.summary,
    changes: event.changes,
    before: event.before,
    after: event.after,
    notification_event_id: event.notification_event_id,
    created_at: timestampToMillis(event.created_at as TimestampLike),
  };
}

export type UserProfileClient = Pick<UserProfile, "uid" | "email" | "display_name" | "role" | "store_ids" | "active">;

export function serializeUserProfile(user: UserProfile): UserProfileClient {
  return {
    uid: user.uid,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    store_ids: user.store_ids ?? [],
    active: user.active,
  };
}
