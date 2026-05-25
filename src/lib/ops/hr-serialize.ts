import { timestampToMillis, type TimestampLike } from "@/src/lib/ops/serialize";
import type {
  EmployeeCompEntryWithId,
  EmployeeCompSnapshot,
  EmployeeDocumentWithId,
  EmployeeFeedbackWithId,
  EmployeeFolderWithId,
  EmployeeWithId,
} from "@/src/types/firestore";

function ms(value: TimestampLike) {
  return value == null ? null : timestampToMillis(value);
}

export type EmployeeCompSnapshotClient = Omit<EmployeeCompSnapshot, "effective_date"> & {
  effective_date: number | null;
};

export type EmployeeClient = Omit<
  EmployeeWithId,
  "hire_date" | "termination_date" | "created_at" | "updated_at" | "current_comp"
> & {
  hire_date: number | null;
  termination_date: number | null;
  created_at: number;
  updated_at: number;
  current_comp: EmployeeCompSnapshotClient | null;
};

export type EmployeeCompEntryClient = Omit<EmployeeCompEntryWithId, "effective_date" | "created_at"> & {
  effective_date: number;
  created_at: number;
};

export type EmployeeFeedbackClient = Omit<EmployeeFeedbackWithId, "created_at"> & {
  created_at: number;
};

export type EmployeeDocumentClient = Omit<EmployeeDocumentWithId, "uploaded_at"> & {
  uploaded_at: number;
};

export type EmployeeFolderClient = EmployeeFolderWithId;

export function serializeEmployee(employee: EmployeeWithId): EmployeeClient {
  return {
    ...employee,
    hire_date: ms(employee.hire_date as TimestampLike),
    termination_date: ms(employee.termination_date as TimestampLike),
    created_at: timestampToMillis(employee.created_at as TimestampLike),
    updated_at: timestampToMillis(employee.updated_at as TimestampLike),
    current_comp: employee.current_comp
      ? {
          ...employee.current_comp,
          effective_date: ms(employee.current_comp.effective_date as TimestampLike),
        }
      : null,
  };
}

export function serializeCompEntry(entry: EmployeeCompEntryWithId): EmployeeCompEntryClient {
  return {
    ...entry,
    effective_date: timestampToMillis(entry.effective_date as TimestampLike),
    created_at: timestampToMillis(entry.created_at as TimestampLike),
  };
}

export function serializeFeedback(item: EmployeeFeedbackWithId): EmployeeFeedbackClient {
  return {
    ...item,
    created_at: timestampToMillis(item.created_at as TimestampLike),
  };
}

export function serializeDocument(doc: EmployeeDocumentWithId): EmployeeDocumentClient {
  return {
    ...doc,
    uploaded_at: timestampToMillis(doc.uploaded_at as TimestampLike),
  };
}
