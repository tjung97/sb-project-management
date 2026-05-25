import { describe, expect, test } from "vitest";
import { serializeEmployee } from "@/src/lib/ops/hr-serialize";
import type { EmployeeWithId } from "@/src/types/firestore";

const timestamp = (iso: string) => ({
  toDate: () => new Date(iso),
  toMillis: () => new Date(iso).getTime(),
});

describe("hr serialize", () => {
  test("serializeEmployee converts dates to millis", () => {
    const employee: EmployeeWithId = {
      id: "emp1",
      employee_number: "1042",
      legal_name: "Alex Kim",
      preferred_name: "Alex",
      email: "alex@example.com",
      phone: null,
      uid: null,
      location_id: "store-1",
      department: "Operations",
      job_title: "Shift lead",
      employment_status: "active",
      hire_date: timestamp("2024-03-01") as EmployeeWithId["hire_date"],
      termination_date: null,
      manager_employee_id: null,
      notes: "",
      current_comp: {
        pay_type: "hourly",
        amount: 22,
        currency: "USD",
        pay_frequency: "biweekly",
        effective_date: timestamp("2025-01-01") as EmployeeWithId["current_comp"] extends infer C
          ? C extends { effective_date: infer D }
            ? D
            : null
          : null,
        job_title: "Shift lead",
      },
      created_at: timestamp("2024-03-01") as EmployeeWithId["created_at"],
      updated_at: timestamp("2025-01-01") as EmployeeWithId["updated_at"],
      created_by_uid: "admin1",
    };

    const client = serializeEmployee(employee);
    expect(client.hire_date).toBe(new Date("2024-03-01").getTime());
    expect(client.current_comp?.amount).toBe(22);
    expect(client.legal_name).toBe("Alex Kim");
  });
});
