"use server";

import { randomUUID } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/firebase/auth-server";
import { adminDb, adminStorage } from "@/src/lib/firebase/admin";
import { requireAdminRole } from "@/src/lib/ops/authz";
import type { EmploymentStatus, HrFeedbackType, PayFrequency, PayType } from "@/src/types/firestore";

const DEFAULT_FOLDERS = ["Onboarding", "Performance", "Personal"];

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function dateField(formData: FormData, key: string) {
  const raw = optionalString(formData, key);
  return raw ? Timestamp.fromDate(new Date(`${raw}T12:00:00`)) : null;
}

async function currentUserOrThrow() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");
  requireAdminRole(user);
  return user;
}

async function actor() {
  const user = await currentUserOrThrow();
  return {
    uid: user.uid,
    name: user.name ?? user.email ?? "Admin",
  };
}

async function uploadHrFile(employeeId: string, file: File) {
  const bucket = adminStorage.bucket();
  if (!bucket.name) throw new Error("Firebase Storage bucket is not configured.");
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeName = `${randomUUID()}.${extension}`;
  const path = `hr-documents/${employeeId}/${safeName}`;
  const token = randomUUID();
  const buffer = Buffer.from(await file.arrayBuffer());

  await bucket.file(path).save(buffer, {
    contentType: file.type || "application/octet-stream",
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token,
        originalName: file.name,
      },
    },
  });

  return {
    file_name: file.name,
    storage_path: path,
    download_url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
  };
}

function parseEmploymentStatus(value: string): EmploymentStatus {
  if (value === "on_leave" || value === "terminated") return value;
  return "active";
}

function parsePayType(value: string): PayType {
  return value === "hourly" ? "hourly" : "salary";
}

function parsePayFrequency(value: string): PayFrequency {
  if (value === "monthly" || value === "biweekly" || value === "weekly") return value;
  return "annual";
}

function parseFeedbackType(value: string): HrFeedbackType {
  if (value === "check_in" || value === "recognition" || value === "concern" || value === "other") return value;
  return "review";
}

function employeeBaseFields(formData: FormData) {
  return {
    employee_number: optionalString(formData, "employee_number"),
    legal_name: requiredString(formData, "legal_name"),
    preferred_name: optionalString(formData, "preferred_name"),
    email: optionalString(formData, "email"),
    phone: optionalString(formData, "phone"),
    uid: optionalString(formData, "uid"),
    location_id: optionalString(formData, "location"),
    department: optionalString(formData, "department"),
    job_title: optionalString(formData, "job_title"),
    employment_status: parseEmploymentStatus(String(formData.get("employment_status") ?? "active")),
    hire_date: dateField(formData, "hire_date"),
    termination_date: dateField(formData, "termination_date"),
    manager_employee_id: optionalString(formData, "manager_employee_id"),
    notes: String(formData.get("notes") ?? ""),
  };
}

async function seedDefaultFolders(employeeId: string) {
  const batch = adminDb.batch();
  DEFAULT_FOLDERS.forEach((name, index) => {
    const ref = adminDb.collection("employees").doc(employeeId).collection("folders").doc();
    batch.set(ref, {
      name,
      parent_folder_id: null,
      sort_order: index,
      created_at: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function upsertEmployee(formData: FormData) {
  const user = await currentUserOrThrow();
  const id = optionalString(formData, "id");
  const fields = employeeBaseFields(formData);
  const ref = id ? adminDb.collection("employees").doc(id) : adminDb.collection("employees").doc();
  const existing = id ? await ref.get() : null;

  await ref.set(
    {
      ...fields,
      created_by_uid: existing?.exists ? existing.get("created_by_uid") : user.uid,
      created_at: existing?.exists ? existing.get("created_at") : FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
      current_comp: existing?.exists ? existing.get("current_comp") ?? null : null,
    },
    { merge: true }
  );

  if (!id) {
    await seedDefaultFolders(ref.id);
  }

  revalidatePath("/hr");
  revalidatePath(`/hr/${ref.id}`);
  redirect(`/hr/${ref.id}?tab=overview`);
}

export async function addCompEntry(formData: FormData) {
  const actorInfo = await actor();
  const employeeId = requiredString(formData, "employee_id");
  const payType = parsePayType(requiredString(formData, "pay_type"));
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount < 0) throw new Error("amount must be a valid number.");

  const entry = {
    pay_type: payType,
    amount,
    currency: optionalString(formData, "currency") ?? "USD",
    pay_frequency: parsePayFrequency(requiredString(formData, "pay_frequency")),
    effective_date: dateField(formData, "effective_date") ?? Timestamp.now(),
    job_title: optionalString(formData, "job_title"),
    notes: String(formData.get("notes") ?? ""),
    created_at: FieldValue.serverTimestamp(),
    created_by_uid: actorInfo.uid,
    created_by_name: actorInfo.name,
  };

  await adminDb.collection("employees").doc(employeeId).collection("compEntries").add(entry);

  const snapshot = {
    pay_type: entry.pay_type,
    amount: entry.amount,
    currency: entry.currency,
    pay_frequency: entry.pay_frequency,
    effective_date: entry.effective_date,
    job_title: entry.job_title,
  };

  await adminDb.collection("employees").doc(employeeId).set(
    {
      current_comp: snapshot,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=compensation`);
}

export async function deleteCompEntry(formData: FormData) {
  await currentUserOrThrow();
  const employeeId = requiredString(formData, "employee_id");
  const entryId = requiredString(formData, "entry_id");
  await adminDb.collection("employees").doc(employeeId).collection("compEntries").doc(entryId).delete();

  const remaining = await adminDb
    .collection("employees")
    .doc(employeeId)
    .collection("compEntries")
    .orderBy("effective_date", "desc")
    .limit(1)
    .get();

  const latest = remaining.docs[0];
  await adminDb.collection("employees").doc(employeeId).set(
    {
      current_comp: latest
        ? {
            pay_type: latest.get("pay_type"),
            amount: latest.get("amount"),
            currency: latest.get("currency"),
            pay_frequency: latest.get("pay_frequency"),
            effective_date: latest.get("effective_date"),
            job_title: latest.get("job_title") ?? null,
          }
        : null,
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=compensation`);
}

export async function addEmployeeFeedback(formData: FormData) {
  const actorInfo = await actor();
  const employeeId = requiredString(formData, "employee_id");

  await adminDb.collection("employees").doc(employeeId).collection("feedback").add({
    type: parseFeedbackType(String(formData.get("feedback_type") ?? "review")),
    title: requiredString(formData, "title"),
    body: String(formData.get("body") ?? ""),
    rating: optionalString(formData, "rating") ? Number(formData.get("rating")) : null,
    author_uid: actorInfo.uid,
    author_name: actorInfo.name,
    created_at: FieldValue.serverTimestamp(),
  });

  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=feedback`);
}

export async function deleteEmployeeFeedback(formData: FormData) {
  await currentUserOrThrow();
  const employeeId = requiredString(formData, "employee_id");
  const feedbackId = requiredString(formData, "feedback_id");
  await adminDb.collection("employees").doc(employeeId).collection("feedback").doc(feedbackId).delete();
  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=feedback`);
}

export async function upsertEmployeeFolder(formData: FormData) {
  await currentUserOrThrow();
  const employeeId = requiredString(formData, "employee_id");
  const folderId = optionalString(formData, "folder_id");
  const name = requiredString(formData, "name");
  const ref = folderId
    ? adminDb.collection("employees").doc(employeeId).collection("folders").doc(folderId)
    : adminDb.collection("employees").doc(employeeId).collection("folders").doc();

  const existing = folderId ? await ref.get() : null;
  await ref.set(
    {
      name,
      parent_folder_id: optionalString(formData, "parent_folder_id"),
      sort_order: existing?.exists ? existing.get("sort_order") ?? 0 : Date.now(),
      created_at: existing?.exists ? existing.get("created_at") : FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=files`);
}

export async function deleteEmployeeFolder(formData: FormData) {
  await currentUserOrThrow();
  const employeeId = requiredString(formData, "employee_id");
  const folderId = requiredString(formData, "folder_id");

  const docs = await adminDb
    .collection("employees")
    .doc(employeeId)
    .collection("documents")
    .where("folder_id", "==", folderId)
    .limit(1)
    .get();
  if (!docs.empty) {
    throw new Error("Move or delete files in this folder before removing it.");
  }

  await adminDb.collection("employees").doc(employeeId).collection("folders").doc(folderId).delete();
  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=files`);
}

export async function uploadEmployeeDocument(formData: FormData) {
  const actorInfo = await actor();
  const employeeId = requiredString(formData, "employee_id");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("file is required.");

  const uploaded = await uploadHrFile(employeeId, file);
  const displayName = optionalString(formData, "name") ?? uploaded.file_name;
  const folderId = optionalString(formData, "folder_id");

  await adminDb.collection("employees").doc(employeeId).collection("documents").add({
    folder_id: folderId,
    name: displayName,
    file_name: uploaded.file_name,
    storage_path: uploaded.storage_path,
    download_url: uploaded.download_url,
    mime_type: uploaded.mime_type,
    size_bytes: uploaded.size_bytes,
    uploaded_by_uid: actorInfo.uid,
    uploaded_by_name: actorInfo.name,
    uploaded_at: FieldValue.serverTimestamp(),
  });

  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=files${folderId ? `&folder=${folderId}` : ""}`);
}

export async function deleteEmployeeDocument(formData: FormData) {
  await currentUserOrThrow();
  const employeeId = requiredString(formData, "employee_id");
  const documentId = requiredString(formData, "document_id");
  const doc = await adminDb.collection("employees").doc(employeeId).collection("documents").doc(documentId).get();
  if (doc.exists) {
    const path = doc.get("storage_path") as string | undefined;
    if (path) {
      try {
        await adminStorage.bucket().file(path).delete({ ignoreNotFound: true });
      } catch {
        // Storage cleanup is best-effort; metadata removal still proceeds.
      }
    }
    await doc.ref.delete();
  }
  revalidatePath(`/hr/${employeeId}`);
  redirect(`/hr/${employeeId}?tab=files`);
}

export async function deactivateEmployee(formData: FormData) {
  await currentUserOrThrow();
  const employeeId = requiredString(formData, "employee_id");
  await adminDb.collection("employees").doc(employeeId).set(
    {
      employment_status: "terminated",
      termination_date: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  revalidatePath("/hr");
  revalidatePath(`/hr/${employeeId}`);
  redirect("/hr");
}
