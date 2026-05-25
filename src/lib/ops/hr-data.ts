import "server-only";

import { adminDb } from "@/src/lib/firebase/admin";
import type {
  EmployeeCompEntry,
  EmployeeCompEntryWithId,
  EmployeeDocument,
  EmployeeDocumentWithId,
  EmployeeFeedback,
  EmployeeFeedbackWithId,
  EmployeeFolder,
  EmployeeFolderWithId,
  EmployeeWithId,
} from "@/src/types/firestore";

function employeeFromDoc(id: string, data: Record<string, unknown>): EmployeeWithId {
  return {
    id,
    employee_number: (data.employee_number as string | null | undefined) ?? null,
    legal_name: String(data.legal_name ?? ""),
    preferred_name: (data.preferred_name as string | null | undefined) ?? null,
    email: (data.email as string | null | undefined) ?? null,
    phone: (data.phone as string | null | undefined) ?? null,
    uid: (data.uid as string | null | undefined) ?? null,
    location_id: (data.location_id as string | null | undefined) ?? null,
    department: (data.department as string | null | undefined) ?? null,
    job_title: (data.job_title as string | null | undefined) ?? null,
    employment_status: (data.employment_status as EmployeeWithId["employment_status"]) ?? "active",
    hire_date: (data.hire_date as EmployeeWithId["hire_date"]) ?? null,
    termination_date: (data.termination_date as EmployeeWithId["termination_date"]) ?? null,
    manager_employee_id: (data.manager_employee_id as string | null | undefined) ?? null,
    notes: String(data.notes ?? ""),
    current_comp: (data.current_comp as EmployeeWithId["current_comp"]) ?? null,
    created_at: data.created_at as EmployeeWithId["created_at"],
    updated_at: data.updated_at as EmployeeWithId["updated_at"],
    created_by_uid: String(data.created_by_uid ?? ""),
  };
}

export async function listEmployees(): Promise<EmployeeWithId[]> {
  const snapshot = await adminDb.collection("employees").orderBy("legal_name").get();
  return snapshot.docs.map((doc) => employeeFromDoc(doc.id, doc.data()));
}

export async function getEmployee(employeeId: string): Promise<EmployeeWithId | null> {
  const doc = await adminDb.collection("employees").doc(employeeId).get();
  if (!doc.exists) return null;
  return employeeFromDoc(doc.id, doc.data()!);
}

export async function listEmployeeFolders(employeeId: string): Promise<EmployeeFolderWithId[]> {
  const snapshot = await adminDb
    .collection("employees")
    .doc(employeeId)
    .collection("folders")
    .orderBy("sort_order")
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as EmployeeFolder),
  }));
}

export async function listEmployeeDocuments(employeeId: string): Promise<EmployeeDocumentWithId[]> {
  const snapshot = await adminDb
    .collection("employees")
    .doc(employeeId)
    .collection("documents")
    .orderBy("uploaded_at", "desc")
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as EmployeeDocument),
  }));
}

export async function listEmployeeFeedback(employeeId: string): Promise<EmployeeFeedbackWithId[]> {
  const snapshot = await adminDb
    .collection("employees")
    .doc(employeeId)
    .collection("feedback")
    .orderBy("created_at", "desc")
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as EmployeeFeedback),
  }));
}

export async function listEmployeeCompEntries(employeeId: string): Promise<EmployeeCompEntryWithId[]> {
  const snapshot = await adminDb
    .collection("employees")
    .doc(employeeId)
    .collection("compEntries")
    .orderBy("effective_date", "desc")
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as EmployeeCompEntry),
  }));
}

export type EmployeeBundle = {
  employee: EmployeeWithId;
  folders: EmployeeFolderWithId[];
  documents: EmployeeDocumentWithId[];
  feedback: EmployeeFeedbackWithId[];
  compEntries: EmployeeCompEntryWithId[];
};

export async function getEmployeeBundle(employeeId: string): Promise<EmployeeBundle | null> {
  const employee = await getEmployee(employeeId);
  if (!employee) return null;
  const [folders, documents, feedback, compEntries] = await Promise.all([
    listEmployeeFolders(employeeId),
    listEmployeeDocuments(employeeId),
    listEmployeeFeedback(employeeId),
    listEmployeeCompEntries(employeeId),
  ]);
  return { employee, folders, documents, feedback, compEntries };
}
