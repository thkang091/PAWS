import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/**
 * The medical record as a clinic-ready PDF: patient details, an allergy alert first, then conditions, medications,
 * vaccinations, parasite prevention, visits and history in plain tables. It ends with a review block the vet can tick,
 * sign and date at the visit, because the app cannot make a record vet-approved on its own. It says so on the page.
 */
export type PdfRow = readonly string[];

export type MedicalPdf = {
  dog: { name: string; breed: string | null; sex: string | null; born: string | null; age: string | null; weight: string | null; stage: string | null };
  ids: readonly (readonly [string, string])[];
  allergies: readonly { name: string; note: string; alsoListedAs: readonly string[] }[];
  conditions: readonly { name: string; note: string }[];
  medications: readonly PdfRow[];
  vaccinations: readonly PdfRow[];
  prevention: readonly PdfRow[];
  visits: readonly PdfRow[];
  history: readonly (readonly [string, string])[];
  recentSigns: readonly PdfRow[];
  review: { vet: string; clinic: string; date: string } | null;
  owner: string | null;
  preparedOn: string;
};

const esc = (value: string | null | undefined) =>
  (value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const table = (head: readonly string[], rows: readonly PdfRow[], empty: string) =>
  rows.length
    ? `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${esc(c) || "&mdash;"}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`
    : `<p class="none">${esc(empty)}</p>`;

const section = (title: string, body: string) => `<section><h2>${esc(title)}</h2>${body}</section>`;

export const medicalRecordHtml = (d: MedicalPdf) => {
  const patient: [string, string | null][] = [
    ["Name", d.dog.name],
    ["Breed", d.dog.breed],
    ["Sex", d.dog.sex],
    ["Date of birth", d.dog.born],
    ["Age", d.dog.age],
    ["Life stage", d.dog.stage],
    ["Weight", d.dog.weight],
    ...d.ids.map(([k, v]) => [k, v] as [string, string]),
  ];
  const allergyAlert = d.allergies.length
    ? `<div class="alert"><div class="alert-label">ALLERGIES</div><div class="alert-body">${d.allergies
        .map(
          (a) =>
            `<div><strong>${esc(a.name)}</strong>${a.note ? `. ${esc(a.note)}` : ""}${
              a.alsoListedAs.length ? `<div class="aka">Also listed on labels as: ${esc(a.alsoListedAs.join(", "))}</div>` : ""
            }</div>`,
        )
        .join("")}</div></div>`
    : `<div class="alert alert-none"><div class="alert-label">ALLERGIES</div><div class="alert-body">No known allergies recorded.</div></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1C1B1A; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #1C1B1A; padding-bottom: 10px; }
  .doc { font-size: 9pt; letter-spacing: 0.12em; color: #686762; text-transform: uppercase; }
  h1 { font-size: 24pt; margin: 2px 0 0; letter-spacing: -0.02em; }
  .meta { text-align: right; font-size: 9pt; color: #686762; }
  .patient { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px 16px; margin: 14px 0 12px; }
  .field .k { font-size: 8pt; color: #686762; text-transform: uppercase; letter-spacing: 0.06em; }
  .field .v { font-weight: 600; }
  .alert { display: flex; gap: 14px; border: 1.5px solid #E9A73E; background: #FDFBDB; border-radius: 8px; padding: 10px 12px; margin: 6px 0 4px; }
  .alert-none { border-color: #DCDAD4; background: #FFFFFF; }
  .alert-label { font-weight: 700; font-size: 9pt; letter-spacing: 0.1em; min-width: 76px; padding-top: 1px; }
  .alert-body div + div { margin-top: 4px; }
  .aka { font-size: 9pt; color: #686762; }
  section { margin-top: 16px; page-break-inside: avoid; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #DCDAD4; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5pt; font-weight: 600; color: #686762; padding: 4px 8px 4px 0; border-bottom: 1px solid #E8E7E2; }
  td { padding: 5px 8px 5px 0; border-bottom: 1px solid #F4F4F2; vertical-align: top; }
  .none { color: #686762; font-style: italic; margin: 2px 0; }
  .list div { padding: 4px 0; border-bottom: 1px solid #F4F4F2; }
  .review { margin-top: 22px; border: 1.5px solid #1C1B1A; border-radius: 8px; padding: 12px 14px; page-break-inside: avoid; }
  .review h2 { border: none; padding: 0; margin-bottom: 8px; }
  .boxes { display: flex; gap: 24px; margin-bottom: 14px; }
  .box { display: inline-block; width: 11px; height: 11px; border: 1.3px solid #1C1B1A; margin-right: 6px; vertical-align: -1px; }
  .lines { display: grid; grid-template-columns: 1.3fr 1.3fr 1fr; gap: 18px; }
  .line { border-bottom: 1px solid #1C1B1A; height: 26px; }
  .line-k { font-size: 8pt; color: #686762; margin-top: 3px; }
  .reviewed { font-size: 9.5pt; margin-bottom: 10px; }
  footer { margin-top: 18px; font-size: 8pt; color: #686762; }
  </style></head><body>
  <header>
    <div><div class="doc">Pet medical record</div><h1>${esc(d.dog.name)}</h1></div>
    <div class="meta">Prepared ${esc(d.preparedOn)}${d.owner ? `<br/>Owner: ${esc(d.owner)}` : ""}<br/>Made with PAWS</div>
  </header>
  <div class="patient">${patient
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="field"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`)
    .join("")}</div>
  ${allergyAlert}
  ${section(
    "Conditions",
    d.conditions.length ? `<div class="list">${d.conditions.map((c) => `<div><strong>${esc(c.name)}</strong>${c.note ? `. ${esc(c.note)}` : ""}</div>`).join("")}</div>` : `<p class="none">No known conditions recorded.</p>`,
  )}
  ${section("Current medications", table(["Medication", "Dose", "How often", "Since"], d.medications, "No current medications."))}
  ${section("Vaccinations", table(["Vaccine", "Given", "Next due", "Given by"], d.vaccinations, "No vaccinations recorded."))}
  ${section("Parasite prevention", table(["Protection", "Product", "Last given", "Next due"], d.prevention, "No prevention doses recorded."))}
  ${section("Visits, tests and procedures", table(["Date", "What", "Result", "Notes"], d.visits, "No visits recorded."))}
  ${section(
    "History",
    d.history.length ? `<table><tbody>${d.history.map(([k, v]) => `<tr><td style="width:28%;color:#686762">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : `<p class="none">Nothing recorded.</p>`,
  )}
  ${d.recentSigns.length ? section("Signs noted at home, last 14 days", table(["Date", "What the owner noticed", "Note"], d.recentSigns, "")) : ""}
  <div class="review">
    <h2>Veterinarian review</h2>
    ${d.review ? `<div class="reviewed">Last reviewed by ${esc(d.review.vet)}${d.review.clinic ? `, ${esc(d.review.clinic)}` : ""} on ${esc(d.review.date)}.</div>` : ""}
    <div class="boxes"><span><span class="box"></span>Reviewed, accurate</span><span><span class="box"></span>Reviewed with corrections</span></div>
    <div class="lines">
      <div><div class="line"></div><div class="line-k">Veterinarian</div></div>
      <div><div class="line"></div><div class="line-k">Clinic</div></div>
      <div><div class="line"></div><div class="line-k">Date</div></div>
    </div>
    <div class="lines" style="grid-template-columns: 2.6fr 1fr; margin-top: 14px;">
      <div><div class="line"></div><div class="line-k">Signature</div></div>
      <div><div class="line"></div><div class="line-k">License no.</div></div>
    </div>
  </div>
  <footer>Kept by the owner in the PAWS app and not verified by a veterinarian until signed above. Please check against clinic records.</footer>
  </body></html>`;
};

/** Make the PDF and open the share sheet (save to Files, AirDrop, email, print). */
export const shareMedicalPdf = async (data: MedicalPdf) => {
  const made = await Print.printToFileAsync({ html: medicalRecordHtml(data), width: 612, height: 792, margins: { top: 40, bottom: 44, left: 40, right: 40 } });
  // A readable file name for Files, email and AirDrop, instead of a random id.
  let uri = made.uri;
  try {
    const safe = data.dog.name.replace(/[^\p{L}\p{N} ]+/gu, "").trim() || "Dog";
    const target = new File(Paths.cache, `${safe} medical record ${data.preparedOn.replace(/,/g, "")}.pdf`);
    if (target.exists) target.delete();
    new File(made.uri).move(target);
    uri = target.uri;
  } catch {
    // Keep the original file if renaming fails; sharing still works.
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: `${data.dog.name} medical record` });
  } else {
    await Print.printAsync({ uri });
  }
};
