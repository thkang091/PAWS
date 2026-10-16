import { fixStatus, groomingStatus, idStatus, weightStatus } from "@/features/care/intel/coverage";

describe("care coverage", () => {
  it("asks puppies to be weighed more often", () => {
    expect(weightStatus("2026-09-20", "puppy", "2026-10-14", null).attention).toBe(true);
    expect(weightStatus("2026-09-20", "adult", "2026-10-14", "25 lb")).toEqual({ text: "25 lb, weighed 3 weeks ago", attention: false });
    expect(weightStatus(null, "adult", "2026-10-14", null).attention).toBe(true);
  });

  it("names what grooming is overdue", () => {
    const logs = [
      { groomingType: "nail_trim", doneDate: "2026-09-01", nextDueDate: null },
      { groomingType: "bath", doneDate: "2026-10-10", nextDueDate: null },
    ];
    expect(groomingStatus(logs, "2026-10-14")).toEqual({ text: "Nails due", attention: true });
    expect(groomingStatus([], "2026-10-14").attention).toBe(false);
  });

  it("flags a missing microchip", () => {
    expect(idStatus(null).attention).toBe(true);
    expect(idStatus("985112003456789").text).toBe("Microchip ending 6789");
  });

  it("times spay or neuter by size, and only for young unfixed dogs", () => {
    expect(fixStatus("Not yet", 3, "small")?.attention).toBe(false);
    expect(fixStatus("Not yet", 6, "small")?.attention).toBe(true);
    expect(fixStatus("", 6, "large")?.text).toBe("Usually discussed at 9 to 15 months");
    expect(fixStatus("Yes", 6, "small")).toBeNull();
    expect(fixStatus("Not yet", 30, "small")).toBeNull();
  });
});
