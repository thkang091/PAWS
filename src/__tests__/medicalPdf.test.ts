jest.mock("expo-print", () => ({}));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));

import { medicalRecordHtml, type MedicalPdf } from "@/services/medicalPdf";

const base: MedicalPdf = {
  dog: { name: "23", breed: "Mixed", sex: "Male, neutered", born: null, age: "4 years", weight: "12 kg (Oct 1, 2026)", stage: "Adult" },
  ids: [],
  allergies: [],
  conditions: [],
  medications: [],
  vaccinations: [["Rabies", "Sep 15, 2026", "Sep 15, 2029", "City Vet"]],
  prevention: [],
  visits: [],
  history: [],
  recentSigns: [],
  review: null,
  owner: null,
  preparedOn: "Oct 5, 2026",
};

describe("medical record PDF", () => {
  it("leads with allergies and their label names", () => {
    const html = medicalRecordHtml({ ...base, allergies: [{ name: "Chicken", note: "", alsoListedAs: ["poultry fat"] }] });
    expect(html.indexOf("ALLERGIES")).toBeLessThan(html.indexOf("Vaccinations"));
    expect(html).toContain("poultry fat");
  });

  it("says plainly when nothing is known, and escapes what was typed", () => {
    const html = medicalRecordHtml({ ...base, conditions: [{ name: "<b>Itchy</b> ears", note: "" }] });
    expect(html).toContain("&lt;b&gt;Itchy&lt;/b&gt; ears");
    expect(html).toContain("No known allergies recorded.");
  });

  it("always has a place for the vet to sign, and notes a past review", () => {
    expect(medicalRecordHtml(base)).toContain("Veterinarian review");
    expect(medicalRecordHtml({ ...base, review: { vet: "Dr. Han", clinic: "City Vet", date: "Oct 5, 2026" } })).toContain("Last reviewed by Dr. Han, City Vet");
  });
});
