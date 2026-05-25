import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { adminDb } from "@/src/lib/firebase/admin";
import { listRecurringTemplates, listUserSetupGaps } from "@/src/lib/ops/data";
import { profileStoreIds } from "@/src/lib/ops/user-stores";
import type { Timestamp } from "firebase/firestore";
import type { RecurringTemplateWithId, UserProfile } from "@/src/types/firestore";

export type AdminNotificationEventRow = {
  id: string;
  subject?: string;
  body?: string;
  created_at?: Timestamp;
};

const PUBLIC_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_APP_URL",
] as const;

const SERVER_ENV_KEYS = ["RESEND_API_KEY", "SLACK_WEBHOOK_URL", "FIREBASE_SERVICE_ACCOUNT_KEY"] as const;

export type AdminEnvCheck = {
  key: string;
  label: string;
  configured: boolean;
  scope: "public" | "server";
};

export type AdminHealth = {
  env: AdminEnvCheck[];
  firebaseProjectId: string | null;
  apiHealthOk: boolean;
  missingPublicEnv: string[];
  failedNotifications: AdminNotificationEventRow[];
  pendingNotifications: AdminNotificationEventRow[];
  setupGaps: UserProfile[];
  recurringTemplates: RecurringTemplateWithId[];
};

export type AdminStats = {
  locations: number;
  locationsActive: number;
  labels: number;
  users: number;
  usersActive: number;
  projects: number;
  issues: number;
  issuesOpen: number;
  issuesBlocked: number;
  issuesUrgent: number;
  notificationInboxUnread: number;
};

export type AdminDashboard = {
  health: AdminHealth;
  stats: AdminStats;
  checkedAt: string;
};

export async function listAllUserProfiles(): Promise<UserProfile[]> {
  const snapshot = await adminDb.collection("userProfiles").limit(200).get();
  if (!snapshot.empty) {
    return snapshot.docs
      .map((doc) => {
        const profile = doc.data() as UserProfile;
        const store_ids = profileStoreIds(profile);
        return { ...profile, store_ids, store_id: store_ids[0] ?? null };
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  }
  return [];
}

function sortByCreatedDesc(rows: AdminNotificationEventRow[]) {
  return [...rows].sort((a, b) => (b.created_at?.toMillis?.() ?? 0) - (a.created_at?.toMillis?.() ?? 0));
}

export async function getAdminDashboard(): Promise<AdminDashboard | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  const [
    failedNotifications,
    pendingNotifications,
    recurringTemplates,
    setupGaps,
    locationsSnap,
    labelsSnap,
    usersSnap,
    projectsSnap,
    issuesSnap,
    inboxUnreadSnap,
  ] = await Promise.all([
    adminDb.collection("notificationEvents").where("status", "==", "failed").limit(25).get(),
    adminDb.collection("notificationEvents").where("status", "==", "pending").limit(25).get(),
    listRecurringTemplates(),
    listUserSetupGaps(),
    adminDb.collection("locations").get(),
    adminDb.collection("labels").get(),
    adminDb.collection("userProfiles").limit(200).get(),
    adminDb.collection("projects").limit(200).get(),
    adminDb.collection("issues").limit(500).get(),
    adminDb.collection("notificationInbox").where("read", "==", false).limit(200).get(),
  ]);

  const locations = locationsSnap.docs.map((doc) => doc.data());
  const issues = issuesSnap.docs.map((doc) => doc.data());
  const openStatuses = new Set(["open", "in_progress", "blocked"]);

  const missingPublicEnv = PUBLIC_ENV_KEYS.filter((key) => !process.env[key]);

  const env: AdminEnvCheck[] = [
    ...PUBLIC_ENV_KEYS.map((key) => ({
      key,
      label: key.replace("NEXT_PUBLIC_", "").replaceAll("_", " ").toLowerCase(),
      configured: Boolean(process.env[key]),
      scope: "public" as const,
    })),
    ...SERVER_ENV_KEYS.map((key) => ({
      key,
      label: key.replaceAll("_", " ").toLowerCase(),
      configured: Boolean(process.env[key]),
      scope: "server" as const,
    })),
  ];

  return {
    checkedAt: new Date().toISOString(),
    health: {
      env,
      firebaseProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      apiHealthOk: missingPublicEnv.length === 0,
      missingPublicEnv,
      failedNotifications: sortByCreatedDesc(
        failedNotifications.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AdminNotificationEventRow)
      ).slice(0, 15),
      pendingNotifications: sortByCreatedDesc(
        pendingNotifications.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AdminNotificationEventRow)
      ).slice(0, 15),
      setupGaps,
      recurringTemplates,
    },
    stats: {
      locations: locationsSnap.size,
      locationsActive: locations.filter((location) => location.active !== false).length,
      labels: labelsSnap.size,
      users: usersSnap.size,
      usersActive: usersSnap.docs.filter((doc) => doc.get("active") !== false).length,
      projects: projectsSnap.size,
      issues: issuesSnap.size,
      issuesOpen: issues.filter((issue) => openStatuses.has(issue.status as string)).length,
      issuesBlocked: issues.filter((issue) => issue.status === "blocked").length,
      issuesUrgent: issues.filter((issue) => issue.priority === "urgent" && openStatuses.has(issue.status as string)).length,
      notificationInboxUnread: inboxUnreadSnap.size,
    },
  };
}
