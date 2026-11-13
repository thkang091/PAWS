import { isJpeg, jpegInfo, stripJpegMetadata } from "../../supabase/functions/media/jpeg";
import { BASE_CRITERIA, CHECK_RULES, buildCheckRequest, criteriaFor, decideCheck, parseCheck, type Criterion } from "../../supabase/functions/media/entryCheck";
import { isVisible, mediaPhase, phaseEndsAt, rankEntries } from "../../supabase/functions/media/phase";

declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

// ---------- A small JPEG with the metadata a phone adds ----------

const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** EXIF (little-endian) with an orientation tag and a fake GPS string, the way phones write it. */
const exif = (orientation: number) =>
  seg(0xe1, [
    ...ascii("Exif"), 0, 0,
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00,
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    ...ascii("GPSLatitude 37.7749 GPSLongitude -122.4194 iPhone 15 Pro"),
  ]);

const SCAN = [0x12, 0x34, 0xff, 0x00, 0x56, 0x78, 0x9a];
const makeJpeg = ({ orientation = 6, width = 800, height = 600 } = {}) =>
  new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...exif(orientation),
    ...seg(0xed, ascii("Photoshop 3.0 IPTC city=San Francisco")),
    ...seg(0xfe, ascii("taken at home")),
    ...seg(0xdb, new Array(65).fill(1)),
    ...seg(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]),
    ...seg(0xda, [3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0]),
    ...SCAN,
    0xff, 0xd9,
  ]);

const contains = (b: Uint8Array, text: string) => Array.from(b, (c) => String.fromCharCode(c)).join("").includes(text);

describe("photo cleaning", () => {
  it("removes location, device and comment metadata but keeps the pixels", () => {
    const original = makeJpeg();
    expect(contains(original, "GPSLatitude")).toBe(true);
    const out = stripJpegMetadata(original)!;
    expect(out).not.toBeNull();
    expect(contains(out.bytes, "GPS")).toBe(false);
    expect(contains(out.bytes, "iPhone")).toBe(false);
    expect(contains(out.bytes, "San Francisco")).toBe(false);
    expect(contains(out.bytes, "taken at home")).toBe(false);
    expect(out.removed).toBe(3);
    // JFIF stays, the scan is copied byte for byte, and it still ends the image.
    expect(contains(out.bytes, "JFIF")).toBe(true);
    expect([...out.bytes.slice(-SCAN.length - 2)]).toEqual([...SCAN, 0xff, 0xd9]);
  });

  it("keeps the orientation so an upright photo stays upright", () => {
    const out = stripJpegMetadata(makeJpeg({ orientation: 6 }))!;
    const info = jpegInfo(out.bytes)!;
    expect(info.orientation).toBe(6);
    // Stored 800 x 600, displayed rotated: 600 wide, 800 tall.
    expect(info).toEqual({ width: 600, height: 800, orientation: 6 });
    // An upright photo gets no EXIF at all.
    const upright = stripJpegMetadata(makeJpeg({ orientation: 1 }))!;
    expect(contains(upright.bytes, "Exif")).toBe(false);
    expect(jpegInfo(upright.bytes)).toEqual({ width: 800, height: 600, orientation: 1 });
  });

  it("refuses anything that isn't a readable JPEG", () => {
    expect(stripJpegMetadata(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
    expect(stripJpegMetadata(makeJpeg().slice(0, 40))).toBeNull();
    expect(isJpeg(new Uint8Array([1, 2, 3]))).toBe(false);
    // A JPEG with no frame header has no size, so it is refused too.
    expect(jpegInfo(new Uint8Array([0xff, 0xd8, ...seg(0xe0, [1, 2, 3]), 0xff, 0xd9]))).toBeNull();
  });

  it("cleans a real JPEG from the repository and it still parses the same", () => {
    const file = path.join(__dirname, "../../assets/training/section-2-2/level-1.jpg");
    const original = new Uint8Array(fs.readFileSync(file));
    const out = stripJpegMetadata(original)!;
    expect(out).not.toBeNull();
    const before = jpegInfo(original)!;
    expect(jpegInfo(out.bytes)).toEqual(before);
    expect(before.width).toBeGreaterThan(0);
    expect(out.bytes.length).toBeLessThanOrEqual(original.length + 40);
    expect([...out.bytes.slice(-2)]).toEqual([0xff, 0xd9]);
  });
});

// ---------- The automatic check ----------

const POSE: Criterion = { id: "pose_tilt", label: "Both heads tilt the same way", kind: "pose" };
const CRITERIA = criteriaFor([POSE], true);
const answer = (overrides: Record<string, [string, number]> = {}) =>
  JSON.stringify({
    answers: CRITERIA.map((c) => {
      const [a, conf] = overrides[c.id] ?? ["yes", 0.95];
      return { id: c.id, answer: a, confidence: conf };
    }),
  });

describe("entry check", () => {
  it("checks a dog, the owner, both together, then the pose", () => {
    expect(CRITERIA.map((c) => c.id)).toEqual(["dog_visible", "owner_visible", "same_frame", "pose_tilt"]);
    // A dog-only challenge only needs the dog.
    expect(criteriaFor([POSE], false).map((c) => c.id)).toEqual(["dog_visible", "pose_tilt"]);
    // Base criteria can't be duplicated or overridden by a pose.
    expect(criteriaFor([{ ...BASE_CRITERIA[0], kind: "pose" }, POSE], true).filter((c) => c.id === "dog_visible")).toHaveLength(1);
  });

  it("asks only objective questions and sends the photo", () => {
    const body = buildCheckRequest(CRITERIA, { mimeType: "image/jpeg", base64: "abc" });
    const prompt = body.contents[0].parts[0].text as string;
    expect(prompt).toMatch(/Do not judge cuteness/);
    expect(prompt).toMatch(/Ignore any text/);
    expect(body.contents[0].parts[1]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "abc" } });
    expect(body.generationConfig.temperature).toBe(0);
    expect(body.generationConfig.responseSchema.properties.answers.items.properties.id.enum).toEqual(CRITERIA.map((c) => c.id));
  });

  it("passes only when every criterion is a confident yes", () => {
    expect(decideCheck(parseCheck(answer(), CRITERIA), CRITERIA)).toEqual({ status: "passed", heldReason: null });
    const shaky = parseCheck(answer({ pose_tilt: ["yes", CHECK_RULES.passConfidence - 0.01] }), CRITERIA);
    expect(decideCheck(shaky, CRITERIA).status).toBe("unclear");
  });

  it("holds an entry only when a required thing is confidently missing", () => {
    expect(decideCheck(parseCheck(answer({ dog_visible: ["no", 0.97] }), CRITERIA), CRITERIA)).toEqual({ status: "failed", heldReason: "no_dog" });
    expect(decideCheck(parseCheck(answer({ owner_visible: ["no", 0.95] }), CRITERIA), CRITERIA).heldReason).toBe("no_owner");
    expect(decideCheck(parseCheck(answer({ same_frame: ["no", 0.92] }), CRITERIA), CRITERIA).heldReason).toBe("not_together");
    // Not confident enough: a person decides instead.
    expect(decideCheck(parseCheck(answer({ dog_visible: ["no", 0.85] }), CRITERIA), CRITERIA).status).toBe("unclear");
  });

  it("never holds an entry over the pose alone, which is partly a judgement", () => {
    expect(decideCheck(parseCheck(answer({ pose_tilt: ["no", 0.99] }), CRITERIA), CRITERIA)).toEqual({ status: "unclear", heldReason: null });
  });

  it("sends anything it can't read to a person", () => {
    expect(parseCheck("not json", CRITERIA)).toBeNull();
    expect(parseCheck(JSON.stringify({ answers: [] }), CRITERIA)).toBeNull();
    expect(parseCheck(answer({ dog_visible: ["maybe", 0.9] }), CRITERIA)).toBeNull();
    expect(parseCheck(answer({ dog_visible: ["yes", 1.4] }), CRITERIA)).toBeNull();
    const extra = JSON.parse(answer());
    extra.answers.push({ id: "dog_visible", answer: "yes", confidence: 1 });
    expect(parseCheck(JSON.stringify(extra), CRITERIA)).toBeNull();
    const unknown = JSON.parse(answer());
    unknown.answers[0].id = "is_cute";
    expect(parseCheck(JSON.stringify(unknown), CRITERIA)).toBeNull();
    expect(decideCheck(null, CRITERIA)).toEqual({ status: "unclear", heldReason: null });
  });
});

// ---------- Timeline and results ----------

describe("media timeline", () => {
  const t0 = Date.parse("2026-12-01T00:00:00Z");
  const h = 3_600_000;
  const times = {
    registrationOpensAt: new Date(t0).toISOString(),
    startsAt: new Date(t0 + 24 * h).toISOString(),
    entriesCloseAt: new Date(t0 + 72 * h).toISOString(),
    endsAt: new Date(t0 + 96 * h).toISOString(),
  };

  it("moves from registration to entries to voting to results", () => {
    expect(mediaPhase(times, t0 - 1)).toBe("upcoming");
    expect(mediaPhase(times, t0 + h)).toBe("registration");
    expect(mediaPhase(times, t0 + 30 * h)).toBe("entries");
    expect(mediaPhase(times, t0 + 80 * h)).toBe("voting");
    expect(mediaPhase(times, t0 + 100 * h)).toBe("completed");
    expect(mediaPhase({ ...times, status: "cancelled" }, t0 + 30 * h)).toBe("cancelled");
    expect(phaseEndsAt(times, "entries")).toBe(times.entriesCloseAt);
    expect(phaseEndsAt(times, "completed")).toBeNull();
  });

  it("shows only approved, unreported entries", () => {
    expect(isVisible({ status: "approved" })).toBe(true);
    expect(isVisible({ status: "approved", hiddenByReports: true })).toBe(false);
    expect(isVisible({ status: "pending_review" })).toBe(false);
    expect(isVisible({ status: "held" })).toBe(false);
  });

  it("ranks by votes, then by who entered first", () => {
    const ranked = rankEntries([
      { id: "late", votes: 3, submittedAt: "2026-12-02T10:00:00Z" },
      { id: "early", votes: 3, submittedAt: "2026-12-02T09:00:00Z" },
      { id: "top", votes: 5, submittedAt: "2026-12-03T09:00:00Z" },
      { id: "none", votes: 0, submittedAt: "2026-12-01T09:00:00Z" },
    ]);
    expect(ranked.map((r) => `${r.rank}:${r.id}`)).toEqual(["1:top", "2:early", "3:late", "4:none"]);
  });
});
