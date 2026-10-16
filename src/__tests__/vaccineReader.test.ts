jest.mock("@/services/gemini", () => ({ askGeminiJson: jest.fn(), tidy: (s: string) => s }));
import { quickRead, searchKeys } from "@/services/vaccineReader";

describe("quickRead", () => {
  it("reads combo shots onto every vaccine they cover", () => {
    expect(quickRead("Nobivac DAPPv+L4").covers).toEqual(["dhpp", "leptospirosis"]);
    expect(quickRead("DHLPP").covers).toEqual(["dhpp", "leptospirosis"]);
    expect(quickRead("Vanguard Plus 5/CV-L").covers).toContain("leptospirosis");
  });

  it("reads everyday words", () => {
    expect(quickRead("kennel cough spray").covers).toEqual(["bordetella"]);
    expect(quickRead("dog flu h3n2").covers).toEqual(["influenza"]);
    expect(quickRead("Imrab 3").covers).toEqual(["rabies"]);
  });

  it("does not mistake parainfluenza for flu", () => {
    expect(quickRead("parainfluenza").covers).toEqual(["dhpp"]);
  });

  it("uses the shortest repeat among what it covers", () => {
    expect(quickRead("DHLPP").months).toBe(12);
    expect(quickRead("DA2PP").months).toBe(36);
  });

  it("knows a flea tablet is not a vaccine", () => {
    const read = quickRead("Bravecto");
    expect(read.isVaccine).toBe(false);
    expect(read.covers).toEqual([]);
  });

  it("leaves unknown vaccines uncovered", () => {
    expect(quickRead("Rattlesnake").covers).toEqual([]);
  });
});

describe("searchKeys", () => {
  it("finds listed vaccines by their other names", () => {
    expect(searchKeys("kennel")).toEqual(["bordetella"]);
    expect(searchKeys("parvo")).toEqual(["dhpp"]);
    expect(searchKeys("lep")).toEqual(["leptospirosis"]);
    expect(searchKeys("")).toHaveLength(6);
  });
});
