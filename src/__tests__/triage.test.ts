jest.mock("@/services/gemini", () => ({ askGeminiJson: jest.fn(async () => ({ state: "unconfigured" })), tidy: (s: string) => s }));

import { mentions, ruleTriage, triage, triageFloor } from "@/services/triage";

const dog = { name: "Sean", weightKg: 12, stage: "adult" as const };

describe("mentions", () => {
  it("ignores a negated sign", () => {
    expect(mentions("no blood in it", /blood/)).toBe(false);
    expect(mentions("she is not bleeding heavily", /bleeding heavily/)).toBe(false);
    expect(mentions("there was blood", /blood/)).toBe(true);
  });
});

describe("triageFloor", () => {
  it("sends true emergencies now", () => {
    expect(triageFloor("he collapsed in the yard")).toBe("now");
    expect(triageFloor("ate sugar free gum with xylitol")).toBe("now");
    expect(triageFloor("belly looks swollen and retching")).toBe("now");
  });

  it("asks for a call when a toxin or blood is involved", () => {
    expect(triageFloor("ate a chocolate bar")).toBe("call");
    expect(triageFloor("a little blood in the stool")).toBe("call");
  });

  it("does not escalate what was ruled out", () => {
    expect(triageFloor("vomited once, no blood, still breathing fine")).toBe("watch");
    expect(triageFloor("ate breakfast then threw up once")).toBe("watch");
  });
});

describe("ruleTriage", () => {
  it("raises a mild sign in a senior to a same-day call", () => {
    expect(ruleTriage("vomited twice", { ...dog, stage: "senior" }).level).toBe("today");
    expect(ruleTriage("vomited twice", dog).level).toBe("watch");
  });
});

describe("triage", () => {
  it("falls back to the rules when Gemini is unavailable", async () => {
    const result = await triage("ate a chocolate bar", [], dog);
    expect(result.source).toBe("rules");
    expect(result.level).toBe("call");
  });
});
