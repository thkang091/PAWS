import { redGreenLightAt } from "../features/game/flow/redGreenLight";

describe("Red Light, Green Light recording cues", () => {
  it.each([
    [0, "green"], [2.999, "green"], [3, "red"], [4.999, "red"],
    [5, "green"], [7.999, "green"], [8, "red"], [9.999, "red"],
    [10, "green"], [12.999, "green"], [13, "red"], [14.999, "red"],
  ])("shows the correct light at recording time %s", (elapsed, expected) => {
    expect(redGreenLightAt(Number(elapsed))).toBe(expected);
  });

  it("catches up after skipped frames and returns to green on a retake", () => {
    expect([0, 3.7, 11.4, 13.8, 0].map(redGreenLightAt))
      .toEqual(["green", "red", "green", "red", "green"]);
  });

  it.each([-1, NaN, Infinity, -Infinity])("starts on green for invalid elapsed time %s", elapsed => {
    expect(redGreenLightAt(elapsed)).toBe("green");
  });
});
