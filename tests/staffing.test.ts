import { describe, expect, test } from "vitest";
import {
  coverageFromShifts,
  computeStaffing,
  matrixStaff,
  requiredStaff,
  isOpenHour,
  groupHourRanges,
  DEFAULT_MATRIX,
  type ShiftInterval,
} from "@/src/lib/ops/staffing-math";

const OPEN = 11 * 60; // 11a
const CLOSE = 21 * 60; // 9p

// Forecast 11a..8p (hours 11..20).
function forecastFixture(): number[] {
  const f = new Array(24).fill(0);
  const vals = [220, 620, 560, 240, 120, 230, 420, 600, 380, 180];
  vals.forEach((v, i) => (f[11 + i] = v));
  return f;
}

const SHIFTS: ShiftInterval[] = [
  { startMin: 600, endMin: 1080 }, // 10a–6p
  { startMin: 600, endMin: 1020 }, // 10a–5p
  { startMin: 660, endMin: 1020 }, // 11a–5p
  { startMin: 660, endMin: 900 }, // 11a–3p
  { startMin: 900, endMin: 1260 }, // 3p–9p
  { startMin: 1020, endMin: 1260 }, // 5p–9p
  { startMin: 1020, endMin: 1260 }, // 5p–9p
];

describe("matrix + required staff", () => {
  test("bands map sales to floor staff", () => {
    expect(matrixStaff(DEFAULT_MATRIX, 0)).toBe(2);
    expect(matrixStaff(DEFAULT_MATRIX, 149)).toBe(2);
    expect(matrixStaff(DEFAULT_MATRIX, 150)).toBe(3);
    expect(matrixStaff(DEFAULT_MATRIX, 449)).toBe(4);
    expect(matrixStaff(DEFAULT_MATRIX, 450)).toBe(5);
    expect(matrixStaff(DEFAULT_MATRIX, 9999)).toBe(5);
  });
  test("minCrew floors low hours", () => {
    expect(requiredStaff(DEFAULT_MATRIX, 2, 0)).toBe(2);
    expect(requiredStaff(DEFAULT_MATRIX, 3, 120)).toBe(3); // matrix 2, crew 3
  });
});

describe("open-hour detection", () => {
  test("prep hour is not open; open hours are in range", () => {
    expect(isOpenHour(10, OPEN, CLOSE)).toBe(false);
    expect(isOpenHour(11, OPEN, CLOSE)).toBe(true);
    expect(isOpenHour(20, OPEN, CLOSE)).toBe(true);
    expect(isOpenHour(21, OPEN, CLOSE)).toBe(false);
  });
});

describe("coverage from shifts", () => {
  test("fractional coverage per hour", () => {
    const cov = coverageFromShifts(SHIFTS);
    expect(cov[10]).toBeCloseTo(2, 5); // prep
    for (let h = 11; h <= 17; h++) expect(cov[h]).toBeCloseTo(4, 5);
    for (let h = 18; h <= 20; h++) expect(cov[h]).toBeCloseTo(3, 5);
  });
  test("unpaid break subtracts only when on the shift", () => {
    const cov = coverageFromShifts([{ startMin: 600, endMin: 720, breaks: [{ startMin: 660, endMin: 690 }] }]);
    expect(cov[10]).toBeCloseTo(1, 5); // 10a full
    expect(cov[11]).toBeCloseTo(0.5, 5); // 11a: 60min − 30min break
  });
});

describe("computeStaffing — spec fixture", () => {
  const result = computeStaffing({
    forecastHour: forecastFixture(),
    scheduledHour: coverageFromShifts(SHIFTS),
    openMin: OPEN,
    closeMin: CLOSE,
    minCrew: 2,
    avgWage: 20,
  });

  test("required/scheduled totals", () => {
    expect(result.requiredHours).toBe(37);
    expect(result.scheduledHours).toBe(37);
  });
  test("over/under/misplaced/net", () => {
    expect(result.overHours).toBe(5);
    expect(result.underHours).toBe(5);
    expect(result.misplacedHours).toBe(5);
    expect(result.netHours).toBe(0);
  });
  test("fit score and prep", () => {
    expect(result.fitScore).toBe(86);
    expect(result.prepHours).toBe(2);
  });
  test("per-hour required curve", () => {
    const req = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((h) => result.hours.find((r) => r.hour === h)!.required);
    expect(req).toEqual([3, 5, 5, 3, 2, 3, 4, 5, 4, 3]);
  });
  test("summary names the misplaced ranges", () => {
    expect(result.summary).toContain("5 hrs misplaced");
    expect(result.summary).toContain("extra 11a");
    expect(result.summary).toContain("short");
  });
});

describe("groupHourRanges", () => {
  test("collapses consecutive hours", () => {
    expect(groupHourRanges([12, 13, 14, 18])).toEqual(["12p–3p", "6p–7p"]);
  });
});
