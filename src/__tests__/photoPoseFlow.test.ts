import { actionFor, featuredOf, timingLine, until } from "@/features/photoPose/flow";
import * as copy from "@/features/photoPose/copy";
import type { MediaChallenge, MyEntry } from "@/services/mediaService";

const NOW = Date.parse("2026-12-10T12:00:00Z");
const H = 3_600_000;
const iso = (h: number) => new Date(NOW + h * H).toISOString();

const challenge = (over: Partial<MediaChallenge> = {}): MediaChallenge => ({
  challengeId: "c1",
  tournamentId: "t1",
  name: "Pose week",
  title: "Matching Head Tilt",
  brief: "",
  instructions: {},
  requiresOwner: true,
  referencePath: "concepts/x/ref.png",
  phase: "entries",
  registrationOpensAt: iso(-72),
  startsAt: iso(-48),
  entriesCloseAt: iso(48),
  endsAt: iso(96),
  joined: false,
  entries: 0,
  myEntry: null,
  myVote: null,
  serverNow: new Date(NOW).toISOString(),
  ...over,
});
const entry = (status: MyEntry["status"]): MyEntry => ({ id: "e", status, heldReason: null, mediaPath: "u/c/e.jpg", reviewRequested: false, rejectionReason: null, hiddenByReports: false });

describe("Photo Pose screens", () => {
  it("leads with the challenge taking photos, then voting, then the next one", () => {
    const list = [
      challenge({ challengeId: "done", phase: "completed", endsAt: iso(-10) }),
      challenge({ challengeId: "vote", phase: "voting" }),
      challenge({ challengeId: "soon", phase: "registration" }),
      challenge({ challengeId: "open", phase: "entries" }),
    ];
    expect(featuredOf(list)?.challengeId).toBe("open");
    expect(featuredOf(list.filter((c) => c.challengeId !== "open"))?.challengeId).toBe("vote");
    expect(featuredOf([challenge({ phase: "cancelled" })])).toBeNull();
  });

  it("says when the current step ends", () => {
    expect(timingLine(challenge(), NOW)).toBe("Entries close in 2 days");
    expect(timingLine(challenge({ phase: "voting", endsAt: iso(5) }), NOW)).toBe("Voting closes in 5h");
    expect(timingLine(challenge({ phase: "completed" }), NOW)).toBe("Results are in");
    expect(until(iso(0.2), NOW)).toBe("within the hour");
    expect(until(iso(24), NOW)).toBe("tomorrow");
    expect(until(iso(-1), NOW)).toBeNull();
  });

  it("offers the right next step for each phase and entry", () => {
    expect(actionFor(challenge(), NOW)).toMatchObject({ label: "Try this pose", kind: "enter", sub: "Free to enter" });
    // Voting with nothing entered: no button into an empty gallery.
    expect(actionFor(challenge({ phase: "voting", entries: 0 }), NOW)).toMatchObject({ kind: "none", label: "No photos this time" });
    expect(actionFor(challenge({ phase: "voting", entries: 3 }), NOW)).toMatchObject({ kind: "vote" });
    expect(actionFor(challenge({ joined: true, myEntry: entry("approved") }), NOW)).toMatchObject({ label: "Change your photo", kind: "retake", tone: "white" });
    expect(actionFor(challenge({ joined: true, myEntry: entry("held") }), NOW)).toMatchObject({ label: "Retake your photo", tone: "yellow" });
    expect(actionFor(challenge({ joined: true, myEntry: entry("rejected") }), NOW)?.kind).toBe("enter");
    expect(actionFor(challenge({ phase: "voting", entries: 4 }), NOW)?.label).toBe("Vote for a favourite");
    expect(actionFor(challenge({ phase: "voting", entries: 4, myVote: "x" }), NOW)?.label).toBe("Change your vote");
    expect(actionFor(challenge({ phase: "completed" }), NOW)?.kind).toBe("results");
    expect(actionFor(challenge({ phase: "registration" }), NOW)?.kind).toBe("none");
  });

  it("explains every error the server can send, and falls back politely", () => {
    for (const code of ["entries_closed", "own_entry", "not_joined", "image_too_small", "unsupported_image", "ai_unavailable", "image_generation_unavailable", "reference_not_approved", "safety_unchecked", "not_deployed"]) {
      expect(copy.poseError(code)).not.toMatch(/Something went wrong/);
    }
    expect(copy.poseError("anything_else")).toBe("Something went wrong. Try again.");
  });

  it("writes copy without em dashes", () => {
    const strings: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === "string") strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(Object.values(copy).filter((v) => typeof v !== "function"));
    ["entries_closed", "own_entry", "ai_unavailable", "x"].forEach((c) => strings.push(copy.poseError(c)));
    expect(strings.length).toBeGreaterThan(40);
    expect(strings.filter((s) => s.includes("—"))).toEqual([]);
  });
});
