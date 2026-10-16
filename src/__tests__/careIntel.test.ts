import { areaSummary, bcsBand, dueFor, kindsFor, lifeStageOf, mobilityOf, sizeOf, type LogEntry } from "@/features/care/intel/careIntel";

const entry = (kind: LogEntry["kind"], date: string): LogEntry => ({ id: `${kind}-${date}`, kind, date });

describe("life stage", () => {
  it("sizes by breed first, then weight", () => {
    expect(sizeOf("Great Dane", 20)).toBe("giant");
    expect(sizeOf("Golden Retriever", null)).toBe("large");
    expect(sizeOf("Mixed", 8)).toBe("small");
    expect(sizeOf(null, null)).toBe("medium");
  });

  it("makes bigger dogs senior sooner", () => {
    expect(lifeStageOf(6, "large")).toBe("puppy");
    expect(lifeStageOf(7 * 12, "large")).toBe("senior");
    expect(lifeStageOf(7 * 12, "small")).toBe("adult");
    expect(lifeStageOf(null, "medium")).toBe("adult");
  });

  it("adds senior tests and drops adult-only ones for puppies", () => {
    expect(kindsFor("exams", "senior")).toContain("urinalysis");
    expect(kindsFor("exams", "puppy")).not.toContain("bloodwork");
  });
});

describe("what is due", () => {
  it("counts monthly prevention from the last dose", () => {
    expect(dueFor("heartworm_prev", [entry("heartworm_prev", "2026-09-01")], "adult", "2026-10-05")).toMatchObject({ status: "due", daysLeft: -4 });
    expect(dueFor("heartworm_prev", [entry("heartworm_prev", "2026-10-01")], "adult", "2026-10-05").status).toBe("ok");
  });

  it("brings senior exams round twice a year", () => {
    expect(dueFor("wellness_exam", [entry("wellness_exam", "2026-03-01")], "senior", "2026-10-01").status).toBe("due");
    expect(dueFor("wellness_exam", [entry("wellness_exam", "2026-03-01")], "adult", "2026-10-01").status).toBe("ok");
  });

  it("judges brushing on the last week", () => {
    const three = ["2026-10-01", "2026-10-03", "2026-10-05"].map((d) => entry("brushing", d));
    expect(dueFor("brushing", three, "adult", "2026-10-05").status).toBe("ok");
    expect(dueFor("brushing", three.slice(0, 1), "adult", "2026-10-05").status).toBe("due");
  });

  it("summarises an area", () => {
    expect(areaSummary("parasites", [], "adult", "2026-10-05").text).toBe("Add when each was last done");
    expect(areaSummary("parasites", [entry("flea_tick", "2026-08-01")], "adult", "2026-10-05").attention).toBe(true);
  });
});

describe("products", () => {
  it("lets a long-acting product set the next date", () => {
    const collar: LogEntry = { ...entry("flea_tick", "2026-06-01"), product: "Seresto", everyDays: 240 };
    expect(dueFor("flea_tick", [collar], "adult", "2026-10-05")).toMatchObject({ status: "ok", next: "2027-01-27", everyDays: 240 });
  });

  it("counts a combination product for every kind it covers", () => {
    const trio: LogEntry = { ...entry("flea_tick", "2026-10-01"), product: "Simparica Trio", everyDays: 30, covers: ["flea_tick", "heartworm_prev", "deworm"] };
    expect(dueFor("heartworm_prev", [trio], "adult", "2026-10-05").status).toBe("ok");
    expect(dueFor("deworm", [trio], "adult", "2026-10-05").next).toBe("2026-10-31");
    expect(areaSummary("parasites", [trio], "adult", "2026-10-05").text).toBe("All up to date");
  });
});

describe("mobility", () => {
  it("is normal with clean check-ins", () => {
    expect(mobilityOf([{ date: "2026-10-05", mobility: [] }], "2026-10-05").status).toBe("normal");
  });

  it("raises concern after three days of stiffness in a row", () => {
    const m = mobilityOf(
      ["2026-10-03", "2026-10-04", "2026-10-05"].map((date) => ({ date, mobility: ["stiff" as const] })),
      "2026-10-05",
    );
    expect(m.status).toBe("concern");
    expect(m.streak).toEqual({ sign: "stiff", days: 3 });
  });

  it("watches a single mention and ignores check-ins without the question", () => {
    expect(mobilityOf([{ date: "2026-10-05", mobility: ["stairs"] }, { date: "2026-10-04" }], "2026-10-05").status).toBe("watch");
    expect(mobilityOf([{ date: "2026-10-04" }], "2026-10-05").status).toBe("unknown");
  });
});

describe("body condition", () => {
  it("maps the 9-point score to the food plan bands", () => {
    expect([3, 5, 7].map(bcsBand)).toEqual(["thin", "ideal", "heavy"]);
  });
});
