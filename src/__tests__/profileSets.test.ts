import { lifeStageLabel, questionsIn, trainingPlan } from "@/features/profile/intel/profileSets";

const dog = { breed: "Border Collie", stage: "adult" as const, size: "medium" as const, months: 40 };

describe("profile sets", () => {
  it("sizes life stages: large dogs stay puppies longer and become senior sooner", () => {
    expect(lifeStageLabel(14, "small")).toBe("Young adult");
    expect(lifeStageLabel(14, "large")).toBe("Puppy");
    expect(lifeStageLabel(30, "medium")).toBe("Young adult");
    expect(lifeStageLabel(90, "large")).toBe("Senior");
    expect(lifeStageLabel(90, "small")).toBe("Adult");
    expect(lifeStageLabel(null, "small")).toBeNull();
  });

  it("asks grown size only for young dogs", () => {
    expect(questionsIn("basics", { ...dog, months: 6 }, {}).map((q) => q.id)).toContain("adultSize");
    expect(questionsIn("basics", dog, {}).map((q) => q.id)).not.toContain("adultSize");
  });

  it("adds a follow-up for each problem picked, then asks which comes first", () => {
    const ids = questionsIn("baseline", dog, { needs: "Pulling, Recall" }).map((q) => q.id);
    expect(ids).toEqual(["knows", "needs", "sev_pulling", "sev_recall", "goal"]);
    expect(questionsIn("baseline", dog, { needs: "Nothing right now" }).map((q) => q.id)).toEqual(["knows", "needs"]);
  });

  it("builds the plan with the chosen goal first", () => {
    expect(trainingPlan({ needs: "Pulling, Recall", goal: "Recall", knows: "Sit" })).toEqual([
      "Engagement and focus",
      "Recall around distractions",
      "Loose-leash foundations",
      "Settle outdoors",
    ]);
    expect(trainingPlan({ needs: "Nothing right now" })).toEqual([]);
  });
});
