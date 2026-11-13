import {
  BATCH_LIMITS,
  LEAVE_NOTE,
  POSE_RESPONSE_SCHEMA,
  REFERENCE_CRITERIA,
  buildDiscoveryRequest,
  buildReferenceRequest,
  clampCount,
  dedupe,
  extractImage,
  fingerprint,
  isRepeat,
  parseDiscovery,
  screenSafety,
  validateEdit,
  validatePose,
  type PoseConcept,
} from "../../supabase/functions/media/poses";
import { recommendPoses, type LibraryPose } from "@/features/photoPose/recommend";

/** A complete, valid idea in the pose-concept-v1 shape Gemini is asked for. */
const raw = (overrides: Record<string, unknown> = {}) => ({
  id: "matching-head-tilt",
  title: "Matching Head Tilt",
  short_description: "You and your dog tilt your heads the same way at the camera.",
  pose_category: "matching",
  difficulty: "easy",
  estimated_setup_time: 3,
  required_participants: 1,
  required_objects: [],
  dog_requirements: [],
  owner_position: "Kneeling beside the dog, shoulder to shoulder",
  dog_position: "Sitting, facing the camera",
  camera_angle: "Eye level with the dog",
  framing_instructions: "Both faces fill most of the frame",
  step_by_step_instructions: ["Kneel next to your dog", "Make a squeaky sound", "Tilt your head the same way"],
  objective_verification_criteria: [{ label: "Both heads tilt the same way", kind: "pose" }],
  safety_considerations: ["Keep sessions short"],
  visual_reference_prompt: "A smiling owner and a happy dog side by side, both tilting their heads to the left",
  shareability_rationale: "Mirror poses read instantly in a feed",
  trend_source: null,
  trend_verified_at: null,
  review_status: "suggested",
  ...overrides,
});

const valid = (overrides: Record<string, unknown> = {}) => {
  const v = validatePose(raw(overrides));
  if (!v.ok) throw new Error((v as { reasons: string[] }).reasons.join(", "));
  return (v as { pose: PoseConcept }).pose;
};

describe("pose schema validation", () => {
  it("accepts a complete idea and normalises it", () => {
    const p = valid();
    expect(p.title).toBe("Matching Head Tilt");
    expect(p.setupMinutes).toBe(3);
    expect(p.reviewStatus).toBe("suggested");
    // The three base checks always come first, then the pose's own.
    expect(p.criteria.map((c) => c.kind)).toEqual(["dog_visible", "owner_visible", "same_frame", "pose"]);
    expect(p.criteria[3].id).toBe("pose_both_heads_tilt_the_same_way");
    // The dog can always walk away.
    expect(p.safetyNotes).toContain(LEAVE_NOTE);
  });

  it("rejects ideas with missing or malformed fields, with reasons", () => {
    const missing = validatePose(raw({ title: undefined, step_by_step_instructions: ["Only one"] }));
    expect(missing.ok).toBe(false);
    expect((missing as { reasons: string[] }).reasons).toEqual(expect.arrayContaining(["invalid title", "invalid step_by_step_instructions"]));
    expect(validatePose(raw({ pose_category: "viral" })).ok).toBe(false);
    expect(validatePose(raw({ difficulty: "extreme" })).ok).toBe(false);
    expect(validatePose(raw({ estimated_setup_time: 90 })).ok).toBe(false);
    expect(validatePose(raw({ objective_verification_criteria: [] })).ok).toBe(false);
    expect(validatePose(raw({ objective_verification_criteria: [{ label: "A dog", kind: "dog_visible" }] })).ok).toBe(false);
    expect(validatePose(null).ok).toBe(false);
    expect(validatePose("a string").ok).toBe(false);
  });

  it("accepts setup time written as text", () => {
    expect(valid({ estimated_setup_time: "about 5 minutes" }).setupMinutes).toBe(5);
  });

  it("refuses poses that need more than the owner in the photo", () => {
    const v = validatePose(raw({ required_participants: 2 }));
    expect(v.ok).toBe(false);
    expect((v as { reasons: string[] }).reasons).toContain("needs more than one person");
  });

  it("never stores a trend claim or a review status from the model", () => {
    const p = valid({ trend_source: "TikTok", trend_verified_at: "2026-11-01", review_status: "published" });
    expect(p.trendSource).toBeNull();
    expect(p.trendVerifiedAt).toBeNull();
    expect(p.reviewStatus).toBe("suggested");
  });

  it("asks Gemini for structured JSON with the versioned schema", () => {
    const body = buildDiscoveryRequest({ theme: "funny", difficulty: "easy", count: 7, avoid: ["Matching Head Tilt"] });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema).toBe(POSE_RESPONSE_SCHEMA);
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toMatch(/Suggest 7 original photo poses/);
    expect(prompt).toMatch(/do not claim any idea is currently trending/);
    expect(prompt).toMatch(/- Matching Head Tilt/);
    const required = POSE_RESPONSE_SCHEMA.properties.poses.items.required as readonly string[];
    for (const f of ["title", "objective_verification_criteria", "safety_considerations", "visual_reference_prompt", "review_status"]) expect(required).toContain(f);
  });

  it("asks for 5 to 10 ideas", () => {
    expect(clampCount(2)).toBe(BATCH_LIMITS.min);
    expect(clampCount(40)).toBe(BATCH_LIMITS.max);
    expect(clampCount(Number.NaN)).toBe(BATCH_LIMITS.min);
    expect(clampCount(7)).toBe(7);
  });
});

describe("safety screen", () => {
  it.each([
    ["jumping", { step_by_step_instructions: ["Hold a treat high", "Your dog jumps to catch it"] }],
    ["balancing", { dog_position: "Balancing a cookie on its nose" }],
    ["standing on hind legs", { dog_position: "Standing on hind legs next to you" }],
    ["lifting or holding the dog", { owner_position: "Lifting your dog onto your shoulders" }],
    ["restraint", { step_by_step_instructions: ["Tie up the lead to a post", "Step back"] }],
    ["raised or unsafe surface", { dog_position: "Sitting on the kitchen counter" }],
    ["food that is toxic to dogs", { required_objects: ["A bunch of grapes"] }],
  ])("rejects %s", (reason, overrides) => {
    const s = screenSafety(valid(overrides));
    expect(s.verdict).toBe("reject");
    expect(s.reasons).toContain(reason);
  });

  it("flags accessories, costumes, water and tricks for the organizer to check", () => {
    expect(screenSafety(valid({ title: "Matching Bandanas", required_objects: ["Two bandanas"] })).verdict).toBe("flag");
    expect(screenSafety(valid({ dog_position: "Wearing a little costume" })).reasons[0]).toMatch(/costume/);
    expect(screenSafety(valid({ dog_requirements: ["Can roll over on cue"] })).reasons).toContain("needs a trained trick");
    expect(screenSafety(valid({ difficulty: "hard" })).reasons.some((r) => r.startsWith("hard"))).toBe(true);
  });

  it("passes plain, natural poses", () => {
    expect(screenSafety(valid())).toEqual({ verdict: "ok", reasons: [] });
    expect(screenSafety(valid({ title: "Paw and Fist Bump", dog_requirements: ["Offers a paw"] })).verdict).toBe("ok");
  });
});

describe("repeats", () => {
  it("spots the same idea worded differently", () => {
    expect(fingerprint("Matching Head Tilts")).toBe(fingerprint("Head tilt, matching"));
    const p = valid();
    expect(isRepeat(p, { title: "Head Tilt Match" })).toBe(true);
    expect(isRepeat(p, { title: "Back to Back Besties" })).toBe(false);
    // Same arrangement under a new name.
    expect(isRepeat({ ...p, title: "Tilty Twins" }, { title: "Tilty Pals", dogPosition: p.dogPosition, ownerPosition: p.ownerPosition })).toBe(true);
  });

  it("drops repeats within a batch and of the library, keeping the first", () => {
    const a = valid();
    const b = valid({ title: "Head Tilt Matching" });
    const c = valid({ title: "Peek a Boo Doorway", owner_position: "Peeking from behind a door", dog_position: "Peeking from the other side" });
    const out = dedupe([a, b, c], [{ title: "Back to Back Besties" }]);
    expect(out.kept.map((p) => p.title)).toEqual(["Matching Head Tilt", "Peek a Boo Doorway"]);
    expect(out.dropped).toEqual([{ title: "Head Tilt Matching", reasons: ["repeat of an existing idea"] }]);
    expect(dedupe([c], [{ title: "Peek-a-Boo Doorway" }]).kept).toHaveLength(0);
  });
});

describe("a whole Gemini batch", () => {
  const batch = (poses: unknown[]) => JSON.stringify({ poses });

  it("keeps valid, safe, new ideas and explains every rejection", () => {
    const out = parseDiscovery(
      batch([
        raw(),
        raw({ title: "Sky High", step_by_step_instructions: ["Throw a ball", "Your dog leaps to catch it"] }),
        raw({ title: "" }),
        raw({ title: "Head Tilt Matching" }),
        raw({ title: "Matching Bandanas", owner_position: "Sitting cross-legged", dog_position: "Lying down beside you", required_objects: ["Two bandanas"] }),
      ]),
      [],
    );
    expect(out.ok).toBe(true);
    expect(out.accepted.map((p) => p.title)).toEqual(["Matching Head Tilt", "Matching Bandanas"]);
    expect(out.accepted[1].safetyFlags.length).toBeGreaterThan(0);
    expect(out.rejected.map((r) => r.reasons[0])).toEqual(["unsafe: jumping", "invalid title", "repeat of an existing idea"]);
  });

  it("drops ideas PAWS already has", () => {
    const out = parseDiscovery(batch([raw()]), [{ title: "Matching Head Tilt", fingerprint: fingerprint("Matching Head Tilt") }]);
    expect(out.accepted).toHaveLength(0);
  });

  it("keeps to the difficulty asked for, and never hard in a mixed batch", () => {
    const out = parseDiscovery(batch([raw({ difficulty: "medium" }), raw({ title: "Copy My Dog", difficulty: "easy", owner_position: "Lying on the floor", dog_position: "Lying down" })]), [], "easy");
    expect(out.accepted.map((p) => p.title)).toEqual(["Copy My Dog"]);
    expect(parseDiscovery(batch([raw({ difficulty: "hard" })]), [], "mixed").accepted).toHaveLength(0);
  });

  it("rejects a response that isn't the schema", () => {
    expect(parseDiscovery("Here are some ideas!", [])).toMatchObject({ ok: false, error: "invalid_json" });
    expect(parseDiscovery(JSON.stringify({ ideas: [] }), [])).toMatchObject({ ok: false, error: "schema_mismatch" });
    expect(parseDiscovery(null, [])).toMatchObject({ ok: false });
  });
});

describe("reference images", () => {
  it("asks the image model for a realistic PAWS-style photo of this exact pose", () => {
    const body = buildReferenceRequest({ title: "Matching Head Tilt", visualReferencePrompt: "Both tilting left", ownerPosition: "Kneeling", dogPosition: "Sitting", cameraAngle: "Eye level", framing: "Both faces" });
    const prompt = body.contents[0].parts[0].text;
    expect(prompt).toMatch(/Matching Head Tilt/);
    expect(prompt).toMatch(/Exactly one adult and exactly one dog/);
    expect(prompt).toMatch(/anatomically correct/);
    expect(body.generationConfig.responseModalities).toEqual(["IMAGE"]);
    expect(REFERENCE_CRITERIA.map((c) => c.id)).toEqual(["ref_one_dog", "ref_one_person"]);
  });

  it("only returns an image the response actually contains", () => {
    const image = "A".repeat(2000);
    expect(extractImage({ candidates: [{ content: { parts: [{ text: "Here you go" }, { inlineData: { mimeType: "image/png", data: image } }] } }] })).toEqual({ mimeType: "image/png", base64: image });
    // A text-only answer, an empty image or an odd type is no image, never a placeholder.
    expect(extractImage({ candidates: [{ content: { parts: [{ text: "I can't make images" }] } }] })).toBeNull();
    expect(extractImage({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "" } }] } }] })).toBeNull();
    expect(extractImage({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/gif", data: image } }] } }] })).toBeNull();
    expect(extractImage(null)).toBeNull();
  });
});

describe("organizer edits", () => {
  it("holds edited instructions to the same limits", () => {
    const ok = { title: "Head Tilt Twins", description: "Tilt your heads the same way.", framing: "Both faces", instructions: ["Kneel", "Tilt"], safetyNotes: [LEAVE_NOTE] };
    expect(validateEdit(ok)).toEqual([]);
    expect(validateEdit({ ...ok, instructions: ["Only one", "  "] })).toEqual(["instructions"]);
    expect(validateEdit({ ...ok, title: "Hi", safetyNotes: [] })).toEqual(["title", "safetyNotes"]);
  });
});

// ---------- Recommendations ----------

const NOW = Date.parse("2026-12-20T00:00:00Z");
const pose = (id: string, over: Partial<LibraryPose> = {}): LibraryPose => ({
  id,
  title: id,
  description: "",
  category: "funny",
  difficulty: "easy",
  setupMinutes: 3,
  requiredObjects: [],
  referencePath: null,
  publishedAt: "2026-12-10T00:00:00Z",
  entered: false,
  ...over,
});

describe("pose recommendations", () => {
  const library = [
    pose("funny1"),
    pose("funny2"),
    pose("funny3"),
    pose("cute1", { category: "cute" }),
    pose("match1", { category: "matching" }),
    pose("trick1", { category: "trick", difficulty: "medium" }),
    pose("props", { category: "creative", requiredObjects: ["A doorway"] }),
    pose("done", { category: "cute", entered: true }),
  ];

  it("varies the vibe instead of repeating one", () => {
    const picks = recommendPoses(library, { vibes: [], noProps: false, easyOnly: false }, NOW, 4);
    expect(new Set(picks.map((p) => p.category)).size).toBe(4);
  });

  it("puts poses you haven't done ahead of ones you have", () => {
    const picks = recommendPoses(library, { vibes: [], noProps: false, easyOnly: false }, NOW, 8);
    expect(picks[picks.length - 1].id).toBe("done");
  });

  it("follows your filters", () => {
    const noProps = recommendPoses(library, { vibes: [], noProps: true, easyOnly: false }, NOW, 10);
    expect(noProps.find((p) => p.id === "props")).toBeUndefined();
    const easy = recommendPoses(library, { vibes: [], noProps: false, easyOnly: true }, NOW, 10);
    expect(easy.every((p) => p.difficulty === "easy")).toBe(true);
    const cute = recommendPoses(library, { vibes: ["cute"], noProps: false, easyOnly: false }, NOW, 1);
    expect(cute[0].id).toBe("cute1");
  });

  it("can leave out the poses already on screen", () => {
    expect(recommendPoses(library, { vibes: [], noProps: false, easyOnly: false }, NOW, 10, ["funny1", "cute1"]).map((p) => p.id)).not.toContain("funny1");
  });
});
