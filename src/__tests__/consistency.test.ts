import { consistencyOf, shiftDay } from "@/features/care/intel/consistency";

const base = { today: "2026-10-13", since: "2026-10-01", entries: {}, skipped: [] as string[], settledThrough: null };
const kept = (...dates: string[]) => Object.fromEntries(dates.map((d) => [d, {}]));

describe("consistencyOf", () => {
  it("shifts days across month ends", () => {
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("marks a week ending today, oldest first", () => {
    const c = consistencyOf({ ...base, entries: kept("2026-10-12"), skipped: ["2026-10-11"] });
    expect(c.week.map((d) => d.date)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"]);
    expect(c.week.map((d) => d.mark)).toEqual(["missed", "missed", "missed", "missed", "rest", "kept", "today"]);
  });

  it("counts a streak through rest days and stops at a missed one", () => {
    const c = consistencyOf({ ...base, entries: kept("2026-10-13", "2026-10-12", "2026-10-10"), skipped: ["2026-10-11"] });
    expect(c.streak).toBe(3);
    expect(c.level).toBe("slipping");
  });

  it("does not count days before check-ins started", () => {
    const c = consistencyOf({ ...base, since: "2026-10-12" });
    expect(c.week.filter((d) => d.mark === "off")).toHaveLength(5);
    expect(c.missedRun).toBe(1);
    expect(c.level).toBe("gap");
    expect(c.catchUp).toEqual(["2026-10-12"]);
  });

  it("offers at most three recent missed days, and not ones already reviewed", () => {
    const c = consistencyOf({ ...base, since: "2026-10-08", skipped: ["2026-10-08"] });
    expect(c.missedRun).toBe(4);
    expect(c.catchUp).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(consistencyOf({ ...base, since: "2026-10-08", settledThrough: "2026-10-11" }).catchUp).toEqual(["2026-10-12"]);
  });

  it("is steady when every day was answered", () => {
    const c = consistencyOf({ ...base, since: "2026-10-10", entries: kept("2026-10-10", "2026-10-11", "2026-10-12") });
    expect(c.level).toBe("steady");
    expect(c.streak).toBe(3);
    expect(c.catchUp).toEqual([]);
  });

  it("counts nothing while check-ins are off", () => {
    const c = consistencyOf({ ...base, since: null });
    expect(c.missedThisWeek).toBe(0);
    expect(c.level).toBe("steady");
  });
});
