"use server";

import { Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { adminDb } from "@/src/lib/firebase/admin";

export async function createCalendarEvent(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Title is required.");

  const dateStr = String(formData.get("date") ?? "").trim();
  if (!dateStr) throw new Error("Date is required.");

  const notes = String(formData.get("notes") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  const validColors = ["blue", "green", "yellow", "red", "purple"] as const;
  const color = validColors.includes(colorRaw as (typeof validColors)[number])
    ? (colorRaw as "blue" | "green" | "yellow" | "red" | "purple")
    : null;

  const date = Timestamp.fromDate(new Date(`${dateStr}T12:00:00`));

  const event = {
    title,
    date,
    notes,
    color,
    created_by_uid: user.uid,
    created_at: Timestamp.now(),
  };

  await adminDb.collection("calendar_events").add(event);
  revalidatePath("/", "layout");
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");

  const ref = adminDb.collection("calendar_events").doc(eventId);
  const doc = await ref.get();
  if (!doc.exists) return;
  if (doc.get("created_by_uid") !== user.uid) throw new Error("Not authorized.");

  await ref.delete();
  revalidatePath("/", "layout");
}
