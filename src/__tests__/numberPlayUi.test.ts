/**
 * Number Trail practice and online screens (phases P2 and P4): the pure logic they draw from. Nothing here is
 * official; the server decides. These check the phone never shows more than the server said.
 */
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined), removeItem: jest.fn(async () => undefined) }));

import { directionsUrl, kmText, nextRadius, numberEntry, practiceSummary, searchOutcome, searchStages, typeKey } from "@/features/numberTrail/practiceFlow";
import { courseRows, handInPhase, onlineView, stageOf } from "@/features/numberTrail/raceView";
import { GLYPH_SINGLE, digitSingle } from "@/features/numberTrail/glyphGeometry";
import { NUMBER_ERRORS, PHASE_LABELS, eventLine } from "@/features/numberTrail/raceCopy";
import type { PracticeResult, RaceState } from "../../supabase/functions/tournament/numberContract";

describe("typing a number", () => {
  it("takes up to two digits and never corrects what was typed", () => {
    let t = "";
    for (const k of ["4", "2", "7"]) t = typeKey(t, k);
    expect(t).toBe("42");
    expect(typeKey("42", "back")).toBe("4");
    expect(typeKey("4", "clear")).toBe("");
    expect(typeKey("", "x")).toBe("");
    expect(typeKey("0", "7")).toBe("07");
  });
  it("says what's wrong in one line, and nothing while empty", () => {
    expect(numberEntry("")).toEqual({ ok: false, number: null, line: null });
    expect(numberEntry("07")).toMatchObject({ ok: false, line: "No leading zero. Type 7, not 07." });
    // Since L1, 0 is a number (one digit); 00 is a leading zero.
    expect(numberEntry("0")).toMatchObject({ ok: true, number: "0", line: "One digit" });
    expect(numberEntry("00")).toMatchObject({ ok: false, line: "No leading zero. Type 7, not 07." });
    expect(numberEntry("7")).toMatchObject({ ok: true, number: "7", line: "One digit" });
    expect(numberEntry("42")).toMatchObject({ ok: true, number: "42", line: "Two digits" });
    for (let v = 0; v <= 99; v++) expect(numberEntry(String(v)).ok).toBe(true);
  });
});

describe("searching outward", () => {
  it("500 m, 1 km, 2 km in order; stops at the first find; never shows found before the server", () => {
    expect(nextRadius([], false)).toBe(500);
    expect(nextRadius([{ radiusM: 500, found: false }], false)).toBe(1_000);
    expect(nextRadius([{ radiusM: 500, found: true }], false)).toBeNull();
    const s = searchStages([{ radiusM: 500, found: false }], 1_000, false);
    expect(s.map((x) => x.state)).toEqual(["none", "searching", "waiting"]);
    expect(searchOutcome([{ radiusM: 500, found: false }], false)).toBe("searching");
  });
  it("offers 3 km only after 2 km found nothing, then says no plainly", () => {
    const none = [500, 1_000, 2_000].map((radiusM) => ({ radiusM: radiusM as 500, found: false }));
    expect(searchOutcome(none, false)).toBe("offer_wider");
    expect(nextRadius(none, true)).toBe(3_000);
    expect(searchOutcome([...none, { radiusM: 3_000 as const, found: false }], true)).toBe("none");
    expect(searchOutcome([{ radiusM: 500, found: false, error: true }], false)).toBe("error");
  });
  it("directions link carries only the destination", () => {
    expect(directionsUrl({ latitude: 45.4661234, longitude: -122.6531 })).toBe("https://www.google.com/maps/dir/?api=1&destination=45.466123,-122.653100&travelmode=walking");
    expect(kmText(1_512)).toBe("1.5 km");
    expect(kmText(320)).toBe("320 m");
  });
});

describe("the course, one or two digits and a finish stretch", () => {
  it("rows in walking order", () => {
    expect(courseRows({ number: "7", digits: [{}] }).map((r) => r.key)).toEqual(["one"]);
    expect(courseRows({ number: "42", digits: [{}, {}] }).map((r) => r.key)).toEqual(["one", "link", "two"]);
    expect(courseRows({ number: "42", digits: [{}, {}], finish: [{}] }).map((r) => r.label)).toEqual(["Digit 4", "Link", "Digit 2", "Finish"]);
    expect(courseRows({ number: "7", digits: [{}], finish: [{}] }).map((r) => r.label)).toEqual(["Digit 7", "Finish"]);
  });
  it("stages and hand-in for single digits and the finish stretch", () => {
    expect(stageOf("DIGIT_1_IN_PROGRESS", 1).label).toBe("Your digit");
    expect(stageOf("NUMBER_COMPLETE", 1).label).toBe("Number complete");
    expect(stageOf("FINISH_IN_PROGRESS", 2)).toEqual({ label: "Finish stretch", focus: 1 });
    expect(handInPhase("NUMBER_COMPLETE")).toBe(true);
    expect(handInPhase("FINISH_IN_PROGRESS")).toBe(false);
    expect(PHASE_LABELS.FINISH_IN_PROGRESS).toBeTruthy();
  });
  it("a single digit draws as one glyph", () => {
    for (const d of "123456789") expect(digitSingle(d).length).toBeGreaterThan(0);
    expect(GLYPH_SINGLE.width).toBeLessThan(2);
  });
});

describe("practice result, from the server's check only", () => {
  const base: PracticeResult = { eligible: true, phase: "DIGIT_2_COMPLETE", reasons: [], digits: [], connector: null, finish: null, missing: [], walkedM: 1_480, activeMs: 25 * 60_000, gps: { jumps: 0, gapM: 0, ignored: 0, points: 300 }, atStart: true, version: "x" };
  it("complete", () => expect(practiceSummary(base, "42")).toMatchObject({ title: "Number complete", walked: "1.5 km", minutes: 25 }));
  it("names the digit still to walk", () => expect(practiceSummary({ ...base, eligible: false, missing: [{ digit: 2, segment: "E", share: 0.2 }] }, "42").line).toBe("Some of digit 2 is still to walk."));
  it("the start, GPS and the finish stretch", () => {
    expect(practiceSummary({ ...base, eligible: false, atStart: false }, "42").line).toMatch(/start flag/);
    expect(practiceSummary({ ...base, eligible: false, gps: { ...base.gps, jumps: 2 } }, "42").line).toMatch(/GPS/);
    expect(practiceSummary({ ...base, eligible: false, finish: { share: 0.2, reached: false, valid: null } }, "42").line).toMatch(/finish stretch/);
  });
});

describe("online lobby", () => {
  const state = (status: string, o: Partial<NonNullable<RaceState["online"]>>, host = true): RaceState =>
    ({
      match: { status, mode: "online" },
      me: { userId: "a", isHost: host },
      players: [
        { userId: "a", name: "Ari", isHost: true, inRoom: true },
        { userId: "b", name: "Bo", isHost: false, inRoom: true },
      ],
      online: { ranked: true, requestedNumber: "42", category: "standard", targetM: 1_500, spreadShare: 0.02, bandShare: 0.02, equivalence: null, players: [], ...o },
    }) as unknown as RaceState;
  const search = (s: string) => ({ status: s as "found", reason: null, candidates: 1 });
  it("host starts the search; then each player finds their own route", () => {
    expect(onlineView(state("waiting", {})).hostAction).toBe("start_search");
    expect(onlineView(state("waiting", {}, false)).hostAction).toBeNull();
    const v = onlineView(state("course_search", { players: [{ userId: "b", search: search("found"), officialM: 1_503, atStart: null }] }));
    expect(v.stage).toBe("searching");
    expect(v.myStep).toBe("search");
    expect(v.hostAction).toBeNull();
    expect(v.waitingFor).toBe(1);
  });
  it("match when everyone has searched; an unmatched verdict stays searching, never fair", () => {
    const both = [{ userId: "a", search: search("found"), officialM: 1_500, atStart: null }, { userId: "b", search: search("found"), officialM: 1_507, atStart: null }];
    expect(onlineView(state("course_search", { players: both })).hostAction).toBe("match");
    const eq = { status: "structure_mismatch", target_m: 1_500, spread_m: 7, tolerance_m: 30, checks: [{ name: "digit 1 length", ok: false, spread: 200, allowed: 90, unit: "m" as const }], unknown: ["elevation"], version: "v" };
    const u = onlineView(state("course_search", { players: both, equivalence: eq }));
    expect(u.stage).toBe("unmatched");
    expect(u.verdict?.failed).toEqual(["digit 1 length"]);
    expect(u.hostAction).toBe("match");
  });
  it("matched: check in at your own start; the host starts once everyone is there", () => {
    const eq = { status: "matched", target_m: 1_500, spread_m: 7, tolerance_m: 30, checks: [], unknown: ["street crossings", "elevation", "surface"], version: "v" };
    const away = onlineView(state("ready", { equivalence: eq, players: [{ userId: "a", search: search("found"), officialM: 1_500, atStart: false }, { userId: "b", search: search("found"), officialM: 1_507, atStart: true }] }));
    expect(away.stage).toBe("matched");
    expect(away.myStep).toBe("checkin");
    expect(away.hostAction).toBeNull();
    expect(away.spreadM).toBe(7);
    expect(away.verdict?.unknown).toHaveLength(3);
    const there = onlineView(state("ready", { equivalence: eq, players: [{ userId: "a", search: search("found"), officialM: 1_500, atStart: true }, { userId: "b", search: search("found"), officialM: 1_507, atStart: true }] }));
    expect(there.hostAction).toBe("start");
  });
  it("copy for the new events and errors", () => {
    expect(eventLine("COURSES_MATCHED", "x")).toBe("Routes matched");
    expect(eventLine("PLAYER_AT_START", "Bo")).toBe("Bo is at their start");
    expect(NUMBER_ERRORS.courses_not_matched).toBeTruthy();
  });
});
