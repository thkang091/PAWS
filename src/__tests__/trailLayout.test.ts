import { trailLayout } from "../features/train/components/trailLayout";

describe("train path layout", () => {
  it("handles a topic with no lessons yet", () => {
    const { items, sway } = trailLayout(0);
    expect(items).toEqual([]);
    expect(sway(0)).toBe(0);
  });

  it("puts a chest halfway and one at the end, both on the centre line", () => {
    const { items, sway } = trailLayout(5);
    expect(items.map((it) => it.kind)).toEqual(["step", "step", "step", "chest", "step", "step", "chest"]);
    items.forEach((it, j) => it.kind === "chest" && expect(sway(j)).toBe(0));
  });

  it("puts the lessons either side of the middle chest on opposite sides", () => {
    const { items, sway } = trailLayout(5);
    const mid = items.findIndex((it) => it.kind === "chest");
    expect(Math.sign(sway(mid - 1))).toBe(-Math.sign(sway(mid + 1)));
  });

  it("gives short topics only the end chest", () => {
    expect(trailLayout(2).items.map((it) => it.kind)).toEqual(["step", "step", "chest"]);
  });
});
