import { questionsFor, tailoring, typicalEnergy } from "@/features/profile/intel/getToKnow";

const ids = (breed: string | null, stage: "puppy" | "adult" | "senior", size: "small" | "medium" | "large" | "giant") =>
  questionsFor({ breed, stage, size }).map((q) => q.id);

describe("getting to know the dog", () => {
  it("asks everyone the core questions, energy first", () => {
    const list = ids(null, "adult", "medium");
    expect(list[0]).toBe("energy");
    expect(list).toEqual(expect.arrayContaining(["motivation", "people", "dogs", "triggers"]));
    expect(list).not.toContain("alone");
  });

  it("adds what a breed and age make important", () => {
    expect(ids("Beagle", "puppy", "small")).toEqual(expect.arrayContaining(["housetraining", "chewing", "scent", "barking"]));
    expect(ids("French Bulldog", "senior", "small")).toEqual(expect.arrayContaining(["aging", "heat"]));
    expect(ids("Border Collie", "adult", "medium")).toContain("herding");
    expect(ids("Siberian Husky", "adult", "large")).toEqual(expect.arrayContaining(["escape", "jumping"]));
    expect(ids("Mixed", "adult", "medium")).not.toContain("heat");
  });

  it("marks the usual energy for a breed and turns answers into changes", () => {
    expect(typicalEnergy("Border Collie")).toBe("Non-stop");
    expect(tailoring({ energy: "Non-stop", motivation: "Food, Toys", alone: "Very upset" }, "Sean")).toEqual([
      "Longer walks and brain games, so Sean gets a real outlet",
      "Lessons reward with food, toys",
      "Alone-time training is added to the plan",
    ]);
  });
});
