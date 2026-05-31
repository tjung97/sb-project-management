export interface ToastProductMixItem {
  id: string;
  name: string;
  quantity: number;
  netSales: number;
}

export interface ToastLaborEmployeeStatus {
  id: string;
  name: string;
  job: string;
  status: "working" | "break" | "off";
  clockIn: string | null;
  breakStart: string | null;
  hours: number;
  regularHours: number;
  overtimeHours: number;
}

export interface ToastOpsSummary {
  configured: boolean;
  businessDate: string;
  sales: {
    netSales: number;
    orderCount: number;
    productMix: ToastProductMixItem[];
  };
  labor: {
    activeCount: number;
    breakCount: number;
    offCount: number;
    laborHours: number;
    laborCost: number;
    employees: ToastLaborEmployeeStatus[];
  };
  error: string | null;
}

interface ToastConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  restaurantExternalId: string;
  timezone: string;
}

interface ToastToken {
  accessToken: string;
  tokenType: string;
}

type ToastRecord = Record<string, unknown>;

const DEFAULT_TOAST_BASE_URL = "https://ws-api.toasttab.com";

export async function getToastOpsSummary(now = new Date()): Promise<ToastOpsSummary> {
  const config = getToastConfig();
  const businessDate = formatBusinessDate(now, config?.timezone ?? process.env.TOAST_BUSINESS_TIME_ZONE);

  if (!config) {
    return emptySummary({
      configured: false,
      businessDate,
      error: "Add Toast API env values to enable live sales and labor.",
    });
  }

  try {
    const token = await getToastToken(config);
    const [orders, timeEntries, employees] = await Promise.all([
      toastGet<unknown[]>(config, token, `/orders/v2/ordersBulk?businessDate=${businessDate}`),
      toastGet<unknown[]>(
        config,
        token,
        `/labor/v1/timeEntries?businessDate=${businessDate}&includeMissedBreaks=true`
      ),
      toastGet<unknown[]>(config, token, "/labor/v1/employees?includeArchived=false").catch(() => []),
    ]);

    return buildSummary({
      configured: true,
      businessDate,
      orders: Array.isArray(orders) ? orders : [],
      timeEntries: Array.isArray(timeEntries) ? timeEntries : [],
      employees: Array.isArray(employees) ? employees : [],
      error: null,
      now,
    });
  } catch (error) {
    return emptySummary({
      configured: true,
      businessDate,
      error: error instanceof Error ? error.message : "Toast data could not be loaded.",
    });
  }
}

function getToastConfig(): ToastConfig | null {
  const clientId = process.env.TOAST_CLIENT_ID;
  const clientSecret = process.env.TOAST_CLIENT_SECRET;
  const restaurantExternalId = process.env.TOAST_RESTAURANT_EXTERNAL_ID;

  if (!clientId || !clientSecret || !restaurantExternalId) return null;

  return {
    baseUrl: (process.env.TOAST_API_BASE_URL ?? DEFAULT_TOAST_BASE_URL).replace(/\/$/, ""),
    clientId,
    clientSecret,
    restaurantExternalId,
    timezone: process.env.TOAST_BUSINESS_TIME_ZONE ?? "America/Los_Angeles",
  };
}

function formatBusinessDate(date: Date, timezone = "America/Los_Angeles") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function getToastToken(config: ToastConfig): Promise<ToastToken> {
  const response = await fetch(`${config.baseUrl}/authentication/v1/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      userAccessType: "TOAST_MACHINE_CLIENT",
    }),
  });

  if (!response.ok) {
    throw new Error(`Toast authentication failed (${response.status}).`);
  }

  const data = (await response.json()) as { token?: { accessToken?: string; tokenType?: string } };
  if (!data.token?.accessToken) {
    throw new Error("Toast authentication did not return an access token.");
  }

  return {
    accessToken: data.token.accessToken,
    tokenType: data.token.tokenType ?? "Bearer",
  };
}

async function toastGet<T>(config: ToastConfig, token: ToastToken, path: string): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    headers: {
      Authorization: `${token.tokenType} ${token.accessToken}`,
      "Toast-Restaurant-External-ID": config.restaurantExternalId,
    },
  });

  if (!response.ok) {
    throw new Error(`Toast request failed (${response.status}) for ${path.split("?")[0]}.`);
  }

  return response.json() as Promise<T>;
}

function buildSummary({
  configured,
  businessDate,
  orders,
  timeEntries,
  employees,
  error,
  now,
}: {
  configured: boolean;
  businessDate: string;
  orders: unknown[];
  timeEntries: unknown[];
  employees: unknown[];
  error: string | null;
  now: Date;
}): ToastOpsSummary {
  const productMix = aggregateProductMix(orders);
  const netSales = productMix.reduce((total, item) => total + item.netSales, 0);
  const employeeNames = new Map<string, string>(
    employees.flatMap((employee) => {
      const record = asRecord(employee);
      const id = stringValue(record.guid) || stringValue(record.externalId);
      return id ? [[id, employeeName(record)] as const] : [];
    })
  );
  const activeEmployeeIds = new Set<string>();
  const laborRows = timeEntries
    .map((entry) => laborStatus(entry, employeeNames, now))
    .filter((row): row is ToastLaborEmployeeStatus => Boolean(row));

  for (const row of laborRows) {
    if (row.status !== "off") activeEmployeeIds.add(row.id);
  }

  const offRows = employees.reduce<ToastLaborEmployeeStatus[]>((rows, employee) => {
    const record = asRecord(employee);
    const id = stringValue(record.guid) || stringValue(record.externalId);
    if (!id || activeEmployeeIds.has(id)) return rows;
    rows.push({
      id,
      name: employeeName(record),
      job: "Not clocked in",
      status: "off",
      clockIn: null,
      breakStart: null,
      hours: 0,
      regularHours: 0,
      overtimeHours: 0,
    });
    return rows;
  }, []);

  const employeesByStatus = [...laborRows, ...offRows].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name)
  );
  const laborCost = laborRows.reduce((total, row) => {
    const source = asRecord(timeEntries.find((entry) => referenceGuid(asRecord(asRecord(entry).employeeReference)) === row.id));
    return total + row.hours * numberValue(source.hourlyWage);
  }, 0);

  return {
    configured,
    businessDate,
    sales: {
      netSales,
      orderCount: orders.length,
      productMix,
    },
    labor: {
      activeCount: laborRows.filter((row) => row.status === "working").length,
      breakCount: laborRows.filter((row) => row.status === "break").length,
      offCount: offRows.length,
      laborHours: laborRows.reduce((total, row) => total + row.hours, 0),
      laborCost,
      employees: employeesByStatus,
    },
    error,
  };
}

function aggregateProductMix(orders: unknown[]): ToastProductMixItem[] {
  const byItem = new Map<string, ToastProductMixItem>();

  for (const order of orders) {
    const orderRecord = asRecord(order);
    const checks = arrayValue(orderRecord.checks);
    for (const check of checks) {
      const checkRecord = asRecord(check);
      for (const selection of arrayValue(checkRecord.selections)) {
        addSelection(byItem, asRecord(selection));
      }
    }
  }

  return [...byItem.values()].sort((a, b) => b.netSales - a.netSales);
}

function addSelection(byItem: Map<string, ToastProductMixItem>, selection: ToastRecord) {
  if (selection.voided === true || selection.deferred === true) return;

  const itemReference = asRecord(selection.itemReference ?? selection.menuItemReference ?? selection.salesCategoryReference);
  const id = stringValue(itemReference.guid) || stringValue(selection.guid) || stringValue(selection.externalId) || "unknown";
  const name =
    stringValue(selection.displayName) ||
    stringValue(selection.name) ||
    stringValue(itemReference.name) ||
    stringValue(itemReference.externalId) ||
    "Unknown item";
  const quantity = numberValue(selection.quantity) || 1;
  const netSales =
    numberValue(selection.receiptLinePrice) ||
    numberValue(selection.price) ||
    numberValue(selection.preDiscountPrice) ||
    numberValue(selection.selectionPrice);

  const current = byItem.get(id) ?? { id, name, quantity: 0, netSales: 0 };
  current.quantity += quantity;
  current.netSales += netSales;
  byItem.set(id, current);
}

function laborStatus(entry: unknown, employeeNames: Map<string, string>, now: Date): ToastLaborEmployeeStatus | null {
  const record = asRecord(entry);
  const employeeId = referenceGuid(asRecord(record.employeeReference));
  if (!employeeId) return null;

  const inDate = dateValue(record.inDate);
  const outDate = dateValue(record.outDate);
  if (!inDate || outDate) return null;

  const currentBreak = arrayValue(record.breaks)
    .map((item) => asRecord(item))
    .find((item) => dateValue(item.inDate) && !dateValue(item.outDate) && item.missed !== true && item.waived !== true);
  const hours = Math.max(0, (now.getTime() - inDate.getTime()) / 3_600_000);

  return {
    id: employeeId,
    name: employeeNames.get(employeeId) ?? stringValue(asRecord(record.employeeReference).externalId) ?? "Unknown employee",
    job: stringValue(asRecord(record.jobReference).name) || stringValue(asRecord(record.jobReference).externalId) || "Clocked in",
    status: currentBreak ? "break" : "working",
    clockIn: inDate.toISOString(),
    breakStart: currentBreak ? dateValue(currentBreak.inDate)?.toISOString() ?? null : null,
    hours,
    regularHours: numberValue(record.regularHours),
    overtimeHours: numberValue(record.overtimeHours),
  };
}

function employeeName(record: ToastRecord) {
  const first = stringValue(record.firstName);
  const last = stringValue(record.lastName);
  return stringValue(record.name) || stringValue(record.chosenName) || [first, last].filter(Boolean).join(" ") || stringValue(record.guid) || "Unknown employee";
}

function emptySummary({
  configured,
  businessDate,
  error,
}: {
  configured: boolean;
  businessDate: string;
  error: string | null;
}): ToastOpsSummary {
  return {
    configured,
    businessDate,
    sales: { netSales: 0, orderCount: 0, productMix: [] },
    labor: { activeCount: 0, breakCount: 0, offCount: 0, laborHours: 0, laborCost: 0, employees: [] },
    error,
  };
}

function asRecord(value: unknown): ToastRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as ToastRecord) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function dateValue(value: unknown): Date | null {
  const text = stringValue(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function referenceGuid(record: ToastRecord): string | null {
  return stringValue(record.guid) || stringValue(record.externalId);
}

function statusRank(status: ToastLaborEmployeeStatus["status"]) {
  if (status === "break") return 0;
  if (status === "working") return 1;
  return 2;
}
