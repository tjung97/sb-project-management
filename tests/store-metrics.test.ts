import { describe, expect, test } from "vitest";
import {
  cumulativeToNow,
  windowSum,
  paceToNow,
  projectedFinish,
  busyNow,
  projectedEodLaborPct,
  laborVsBudget,
  splh,
  consecutiveStreak,
  fourWeekTrend,
} from "@/src/lib/ops/store-metrics";

function hoursAt(map: Record<number, number>): number[] {
  const a = new Array(24).fill(0);
  for (const [h, v] of Object.entries(map)) a[Number(h)] = v;
  return a;
}

describe("cumulativeToNow / windowSum", () => {
  const f = hoursAt({ 10: 100, 11: 100, 12: 100, 13: 100 });
  test("prorates the current hour", () => {
    expect(cumulativeToNow(f, 12.5)).toBeCloseTo(250, 5); // 100+100+50
    expect(cumulativeToNow(f, 14)).toBeCloseTo(400, 5);
    expect(cumulativeToNow(f, 9)).toBe(0);
  });
  test("windowSum prorates both edges", () => {
    expect(windowSum(f, 11.5, 12.5)).toBeCloseTo(100, 5); // 50 + 50
    expect(windowSum(f, 10, 11)).toBeCloseTo(100, 5);
  });
});

describe("pace & finish", () => {
  const actual = hoursAt({ 10: 100, 11: 100, 12: 40 });
  const forecast = hoursAt({ 10: 100, 11: 100, 12: 100, 13: 100 });
  test("pace to now = actual ÷ forecast-to-now", () => {
    const r = paceToNow(actual, forecast, 12.5);
    expect(r.actualToNow).toBe(240);
    expect(r.forecastToNow).toBe(250);
    expect(r.pacePct).toBeCloseTo(96, 5);
    expect(r.deltaPct).toBeCloseTo(-4, 5);
  });
  test("projected finish scales the day by pace", () => {
    expect(projectedFinish(240, 250, 400)).toBe(384);
    expect(projectedFinish(10, 5, 1000)).toBe(1000); // too early → plan
    expect(projectedFinish(0, 0, 0)).toBeNull();
  });
});

describe("busy now", () => {
  test("last hour actual vs forecast for that window", () => {
    const actual = hoursAt({ 11: 100, 12: 40 });
    const forecast = hoursAt({ 11: 100, 12: 100 });
    const r = busyNow(actual, forecast, 12.5, 1); // window [11.5, 12.5]
    expect(r.actualWindow).toBe(70); // 50 + 20
    expect(r.forecastWindow).toBe(100); // 50 + 50
    expect(r.indexPct).toBeCloseTo(70, 5);
  });
});

describe("labor", () => {
  test("projected EOD labor %", () => {
    expect(projectedEodLaborPct({ laborSoFar: 100, scheduledLaborRemaining: 150, salesSoFar: 1000, forecastRemaining: 1500 })).toBeCloseTo(10, 5);
    expect(projectedEodLaborPct({ laborSoFar: 0, scheduledLaborRemaining: 0, salesSoFar: 0, forecastRemaining: 0 })).toBeNull();
  });
  test("labor vs budget", () => {
    const b = laborVsBudget(600, 2500, 25);
    expect(b.budget).toBe(625);
    expect(b.deltaDollars).toBe(-25);
    expect(b.pct).toBeCloseTo(24, 5);
  });
  test("SPLH", () => {
    expect(splh(1000, 50)).toBeCloseTo(20, 5);
    expect(splh(1000, 0)).toBeNull();
  });
});

describe("streaks & trend", () => {
  test("consecutive streak counts leading trues", () => {
    expect(consecutiveStreak([true, true, false, true])).toBe(2);
    expect(consecutiveStreak([false, true])).toBe(0);
    expect(consecutiveStreak([])).toBe(0);
  });
  test("4-week trend WoW", () => {
    const t = fourWeekTrend([1200, 1000, 900, 800]);
    expect(t.wowPct).toBeCloseTo(20, 5);
    expect(t.steps[1]).toBeCloseTo(11.111, 2);
    expect(t.steps[2]).toBeCloseTo(12.5, 5);
  });
});
