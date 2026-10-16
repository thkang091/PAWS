jest.mock("@/lib/cloudKv", () => ({ syncedStorage: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }, onWipe: jest.fn() }));

import { supplyOf } from "@/features/care/state/medSupply";

describe("supplyOf", () => {
  it("counts down daily doses from the day they were counted", () => {
    expect(supplyOf({ left: 30, at: "2026-10-01" }, "daily", "2026-10-11")).toEqual({ left: 20, days: 20, runsOut: "2026-10-31" });
  });

  it("handles monthly doses", () => {
    const s = supplyOf({ left: 3, at: "2026-10-01" }, "monthly", "2026-10-01");
    expect(s?.days).toBe(90);
  });

  it("cannot tell for as-needed or uncounted medicine", () => {
    expect(supplyOf({ left: 10, at: "2026-10-01" }, "as_needed", "2026-10-05")).toBeNull();
    expect(supplyOf(undefined, "daily", "2026-10-05")).toBeNull();
  });

  it("never goes below zero", () => {
    expect(supplyOf({ left: 2, at: "2026-10-01" }, "daily", "2026-10-20")?.left).toBe(0);
  });
});
