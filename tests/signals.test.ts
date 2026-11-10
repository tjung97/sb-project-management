import { describe, expect, test } from "vitest";
import { evaluateSignals, buildWins, type SignalInputs } from "@/src/lib/ops/signals";

function base(overrides: Partial<SignalInputs> = {}): SignalInputs {
  return {
    hasToastData: true,
    hasSlingMatch: true,
    openHoursElapsed: 4,
    paceDelta: 0,
    busyIndexPct: 100,
    projEodLaborPct: 24,
    laborTargetPct: 25,
    understaffNext2h: 0,
    laborOverReason: "extra hours",
    ...overrides,
  };
}

describe("evaluateSignals", () => {
  test("data missing wins everything", () => {
    const r = evaluateSignals(base({ hasToastData: false, projEodLaborPct: 60 }));
    expect(r.status).toBe("nodata");
    expect(r.why).toBe("No Toast data today");
  });

  test("understaffed is attention and outranks labor over", () => {
    const r = evaluateSignals(base({ understaffNext2h: 1.5, projEodLaborPct: 33 }));
    expect(r.status).toBe("attention");
    expect(r.signals[0].kind).toBe("understaffed");
  });

  test("labor over names the reason", () => {
    const r = evaluateSignals(base({ projEodLaborPct: 33, laborOverReason: "prep hours" }));
    expect(r.status).toBe("attention");
    expect(r.why).toContain("33% proj vs 25%");
    expect(r.why).toContain("prep hours");
  });

  test("slow only after min open hours", () => {
    expect(evaluateSignals(base({ paceDelta: -20, openHoursElapsed: 1 })).signals.some((s) => s.kind === "slow")).toBe(false);
    const r = evaluateSignals(base({ paceDelta: -20, openHoursElapsed: 3 }));
    expect(r.status).toBe("attention");
    expect(r.signals[0].kind).toBe("slow");
  });

  test("busy is a neutral heads-up", () => {
    const r = evaluateSignals(base({ busyIndexPct: 130 }));
    expect(r.status).toBe("good"); // labor on target (24<=25) also fires → good
    expect(r.signals.some((s) => s.kind === "busy")).toBe(true);
  });

  test("ahead + on target = good", () => {
    const r = evaluateSignals(base({ paceDelta: 15, projEodLaborPct: 22 }));
    expect(r.status).toBe("good");
  });

  test("on plan default", () => {
    const r = evaluateSignals(base({ projEodLaborPct: null, busyIndexPct: 100, paceDelta: 0 }));
    expect(r.why).toBe("On plan");
    expect(r.status).toBe("neutral");
  });
});

describe("buildWins", () => {
  test("labor leader and a different pace leader", () => {
    const wins = buildWins([
      { guid: "a", name: "A", projEodLaborPct: 20, laborTargetPct: 25, paceDelta: 2, hasToastData: true }, // 5 under → labor win
      { guid: "b", name: "B", projEodLaborPct: 26, laborTargetPct: 25, paceDelta: 18, hasToastData: true }, // pace win
      { guid: "c", name: "C", projEodLaborPct: 25, laborTargetPct: 25, paceDelta: 1, hasToastData: true },
    ]);
    expect(wins.find((w) => w.kind === "labor")?.guid).toBe("a");
    expect(wins.find((w) => w.kind === "pace")?.guid).toBe("b");
  });

  test("no wins when nothing qualifies", () => {
    expect(buildWins([{ guid: "a", name: "A", projEodLaborPct: 25, laborTargetPct: 25, paceDelta: 1, hasToastData: true }])).toHaveLength(0);
  });
});
