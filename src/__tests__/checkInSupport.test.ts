jest.mock("@/services/geminiProxy", () => ({ geminiAvailable: false, callGemini: jest.fn() }));

import { ruleLevel, ruleSupport } from "@/services/checkInSupport";
import { firstJson } from "@/services/gemini";

const base = { unusual: [] as ("vomiting" | "coughing" | "other")[], unusualNote: "", appetite: "normal" as const, energy: "normal" as const, stool: "normal" as const, urination: "normal" as const };
const dog = { name: "23", breed: null, ageYears: 4, weightKg: 12, stage: "adult" as const, allergies: [] };

describe("check-in support rules", () => {
  it("keeps a single mild sign at home", () => {
    expect(ruleLevel({ ...base, unusual: ["coughing"] }, "adult")).toBe("home");
  });

  it("asks for a call when vomiting comes with other changes, or for puppies and seniors", () => {
    expect(ruleLevel({ ...base, unusual: ["vomiting"], appetite: "skipped" as never }, "adult")).toBe("call");
    expect(ruleLevel({ ...base, unusual: ["vomiting"] }, "senior")).toBe("call");
    expect(ruleLevel({ ...base, urination: "difficulty" as never }, "adult")).toBe("call");
  });

  it("treats emergencies in the note as urgent", () => {
    expect(ruleLevel({ ...base, unusual: ["other"], unusualNote: "she ate chocolate an hour ago" }, "adult")).toBe("urgent");
    expect(ruleLevel({ ...base, unusual: ["vomiting"], unusualNote: "some blood in it" }, "adult")).toBe("urgent");
    expect(ruleSupport({ ...base, unusual: ["other"], unusualNote: "had a seizure" }, dog).headline).toBe("Call a vet now");
  });

  it("keeps proportion: blood alone is a call, a ruled-out sign is nothing", () => {
    expect(ruleLevel({ ...base, unusual: ["other"], unusualNote: "a little blood in her stool" }, "adult")).toBe("call");
    expect(ruleLevel({ ...base, unusual: ["vomiting"], unusualNote: "threw up once, no blood" }, "adult")).toBe("home");
  });
});

describe("reading Gemini replies", () => {
  it("finds the JSON inside text and code fences", () => {
    expect(firstJson('Here it is:\n```json\n{"found": true, "ingredients": ["Salmon", "Peas {dried}"]}\n```')).toEqual({ found: true, ingredients: ["Salmon", "Peas {dried}"] });
  });
});
