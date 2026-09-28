import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";

const EXPECTED_IDS = [
  "BH001", "BH002", "BH003", "BH004", "BH005",
  "BH006", "BH007", "BH008", "BH009", "BH010",
];

const ALL_IDS = new Set(EXPECTED_IDS);

const MAT_ACTIVITIES = new Set(["BH007", "BH008", "BH009", "BH010"]);
const AUDIO_REQUIRED_IDS = new Set(["BH001", "BH002", "BH006"]);
const PLACEHOLDER_PATTERNS = [/\bTODO\b/i, /\bTBD\b/i, /\bplaceholder\b/i, /\bFIXME\b/i];
const EXPECTED_FPS: Record<string, number> = {
  BH001: 3,
  BH002: 3,
  BH003: 3,
  BH004: 3,
  BH005: 2,
  BH006: 3,
  BH007: 3,
  BH008: 2,
  BH009: 2,
  BH010: 1,
};
const REQUIRED_PROMPT_SECTIONS = [
  /ACTIVITY ID/i,
  /ACTIVITY TITLE/i,
  /EXPECTED START STATE/i,
  /VISIBLE CHECKPOINT/i,
  /RECORDING SETUP/i,
  /REQUIRED REFERENCES/i,
  /AUDIO RULE/i,
  /FPS/i,
  /CLIP-DURATION RANGE/i,
  /ORDERED VISIBLE ACTIONS/i,
  /PASS CRITERIA/i,
  /FAIL CRITERIA/i,
  /NEEDS_REVIEW CRITERIA|NEEDS REVIEW CRITERIA/i,
  /OUT-OF-SCOPE CLAIMS|FORBIDDEN INFERENCES/i,
  /SAFETY NOTES/i,
  /JSON-ONLY RESPONSE INSTRUCTION/i,
];

function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(text));
}

describe("Count and identity", () => {
  it("seeds exactly 10 activities", () => {
    expect(BH001_BH010).toHaveLength(10);
  });

  it("all IDs are unique", () => {
    const ids = BH001_BH010.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("IDs are exactly BH001–BH010", () => {
    const ids = new Set(BH001_BH010.map((a) => a.id));
    for (const expected of EXPECTED_IDS) {
      expect(ids.has(expected)).toBe(true);
    }
    expect(ids.size).toBe(EXPECTED_IDS.length);
  });

  it("all activities have category BETTER_BEHAVIOR_AT_HOME", () => {
    for (const a of BH001_BH010) {
      expect(a.category).toBe("BETTER_BEHAVIOR_AT_HOME");
    }
  });

  it("sequence numbers are 1–10 without gaps", () => {
    const seqNums = BH001_BH010.map((a) => a.sequenceNumber).sort((x, y) => x - y);
    expect(seqNums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("MVP orderIndex values are 1–10 without gaps", () => {
    const orderIndexes = BH001_BH010.map((a) => a.orderIndex).sort((x, y) => x - y);
    expect(orderIndexes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe("Reference assets", () => {
  it("all activities include DOG_PROFILE in required reference assets", () => {
    for (const a of BH001_BH010) {
      expect(a.requiredReferenceAssets).toContain("DOG_PROFILE");
    }
  });

  it("BH007–BH010 include TARGET_MAT in required reference assets", () => {
    for (const a of BH001_BH010.filter((x) => MAT_ACTIVITIES.has(x.id))) {
      expect(a.requiredReferenceAssets).toContain("TARGET_MAT");
    }
  });

  it("BH001–BH006 do not include TARGET_MAT", () => {
    for (const a of BH001_BH010.filter((x) => !MAT_ACTIVITIES.has(x.id))) {
      expect(a.requiredReferenceAssets).not.toContain("TARGET_MAT");
    }
  });

  it("recordingRequirements.targetObjectRequiredInFrame is true for mat activities", () => {
    for (const a of BH001_BH010.filter((x) => MAT_ACTIVITIES.has(x.id))) {
      expect(a.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
    }
  });
});

describe("Duration values", () => {
  it("min_clip_seconds is always less than max_clip_seconds", () => {
    for (const a of BH001_BH010) {
      expect(a.minClipSeconds).toBeLessThan(a.maxClipSeconds);
    }
  });

  it("BH008 (3s hold) has min clip >= 10 seconds", () => {
    const bh008 = BH001_BH010.find((a) => a.id === "BH008")!;
    expect(bh008.minClipSeconds).toBeGreaterThanOrEqual(10);
  });

  it("BH009 (10s hold) has min clip >= 18 seconds", () => {
    const bh009 = BH001_BH010.find((a) => a.id === "BH009")!;
    expect(bh009.minClipSeconds).toBeGreaterThanOrEqual(18);
  });

  it("BH010 (30s hold) has min clip >= 38 seconds", () => {
    const bh010 = BH001_BH010.find((a) => a.id === "BH010")!;
    expect(bh010.minClipSeconds).toBeGreaterThanOrEqual(38);
  });

  it("BH010 uses 1 FPS (low frame rate for 30s hold)", () => {
    const bh010 = BH001_BH010.find((a) => a.id === "BH010")!;
    expect(bh010.recommendedFps).toBeLessThanOrEqual(2);
  });

  it("BH008 and BH009 use reduced FPS (<=2) for duration holds", () => {
    for (const id of ["BH008", "BH009"]) {
      const a = BH001_BH010.find((x) => x.id === id)!;
      expect(a.recommendedFps).toBeLessThanOrEqual(2);
    }
  });

  it("all min_clip_seconds are positive", () => {
    for (const a of BH001_BH010) {
      expect(a.minClipSeconds).toBeGreaterThan(0);
    }
  });

  it("FPS values match the MVP contract exactly", () => {
    for (const a of BH001_BH010) {
      expect(a.recommendedFps).toBe(EXPECTED_FPS[a.id]);
      expect(a.fps).toBe(EXPECTED_FPS[a.id]);
    }
  });
});

describe("VLM prompt quality", () => {
  it("all prompts are non-empty", () => {
    for (const a of BH001_BH010) {
      expect(a.vlmPrompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("all prompts are substantive (>= 500 characters)", () => {
    for (const a of BH001_BH010) {
      expect(a.vlmPrompt.length).toBeGreaterThanOrEqual(500);
    }
  });

  it("all prompts contain a PASS CRITERIA section", () => {
    for (const a of BH001_BH010) {
      expect(a.vlmPrompt).toMatch(/PASS CRITERIA/i);
    }
  });

  it("all prompts contain a FAIL CRITERIA section", () => {
    for (const a of BH001_BH010) {
      expect(a.vlmPrompt).toMatch(/FAIL CRITERIA/i);
    }
  });

  it("all prompts contain a NEEDS REVIEW section", () => {
    for (const a of BH001_BH010) {
      expect(a.vlmPrompt).toMatch(/NEEDS REVIEW/i);
    }
  });

  it("all prompts contain a scorable video gate section", () => {
    for (const a of BH001_BH010) {
      expect(a.vlmPrompt).toMatch(/SCORABLE VIDEO GATE|scorable.*gate/i);
    }
  });

  it("no prompt contains placeholder strings", () => {
    for (const a of BH001_BH010) {
      expect(hasPlaceholder(a.vlmPrompt)).toBe(false);
    }
  });

  it("audio-required activity prompts mention audio", () => {
    for (const id of AUDIO_REQUIRED_IDS) {
      const a = BH001_BH010.find((x) => x.id === id)!;
      expect(a.vlmPrompt).toMatch(/audio/i);
    }
  });

  it("mat activity prompts reference TARGET_MAT", () => {
    for (const id of MAT_ACTIVITIES) {
      const a = BH001_BH010.find((x) => x.id === id)!;
      expect(a.vlmPrompt).toMatch(/TARGET_MAT/);
    }
  });

  it("all prompts include required MVP verifier sections", () => {
    for (const a of BH001_BH010) {
      for (const section of REQUIRED_PROMPT_SECTIONS) {
        expect(a.vlmPrompt).toMatch(section);
      }
    }
  });

  it("all prompts include strict JSON-only response instructions", () => {
    for (const a of BH001_BH010) {
      expect(a.vlmPrompt).toMatch(/Return strict JSON only/i);
      expect(a.vlmPrompt).toMatch(/PASS, FAIL, or NEEDS_REVIEW/i);
    }
  });
});

describe("Criteria fields", () => {
  it("all activities have at least 2 pass criteria", () => {
    for (const a of BH001_BH010) {
      expect(a.passCriteria.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("all activities have at least 2 fail criteria", () => {
    for (const a of BH001_BH010) {
      expect(a.failCriteria.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("all activities have at least 2 needs-review criteria", () => {
    for (const a of BH001_BH010) {
      expect(a.needsReviewCriteria.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("no pass criterion is empty or whitespace-only", () => {
    for (const a of BH001_BH010) {
      for (const criterion of a.passCriteria) {
        expect(criterion.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("no fail criterion is empty or whitespace-only", () => {
    for (const a of BH001_BH010) {
      for (const criterion of a.failCriteria) {
        expect(criterion.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("no needs-review criterion is empty or whitespace-only", () => {
    for (const a of BH001_BH010) {
      for (const criterion of a.needsReviewCriteria) {
        expect(criterion.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("no criterion contains placeholder strings", () => {
    for (const a of BH001_BH010) {
      const all = [...a.passCriteria, ...a.failCriteria, ...a.needsReviewCriteria];
      for (const c of all) {
        expect(hasPlaceholder(c)).toBe(false);
      }
    }
  });

  it("all activities have non-empty start state criteria", () => {
    for (const a of BH001_BH010) {
      expect(a.startStateCriteria.length).toBeGreaterThan(0);
    }
  });

  it("all activities have non-empty out-of-scope claims", () => {
    for (const a of BH001_BH010) {
      expect(a.outOfScopeClaims.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("Prerequisite and progression links", () => {
  it("BH001 has no prerequisites", () => {
    const bh001 = BH001_BH010.find((a) => a.id === "BH001")!;
    expect(bh001.prerequisites).toHaveLength(0);
  });

  it("BH002–BH010 each require exactly the previous ordered activity", () => {
    for (const a of BH001_BH010.filter((activity) => activity.id !== "BH001")) {
      const currentNum = parseInt(a.id.replace("BH", ""), 10);
      const expectedPrereq = `BH${String(currentNum - 1).padStart(3, "0")}`;
      expect(a.prerequisites).toEqual([expectedPrereq]);
      expect(a.prerequisiteActivityId).toBe(expectedPrereq);
    }
  });

  it("all prerequisite IDs resolve within planned BH catalog or are empty", () => {
    for (const a of BH001_BH010) {
      for (const prereq of a.prerequisites) {
        expect(prereq).toMatch(/^BH\d{3}$/);
        const prereqNum = parseInt(prereq.replace("BH", ""), 10);
        const currentNum = parseInt(a.id.replace("BH", ""), 10);
        expect(prereqNum).toBeLessThan(currentNum);
      }
    }
  });

  it("all regressionActivityId values resolve to existing IDs or are null", () => {
    for (const a of BH001_BH010) {
      if (a.regressionActivityId !== null) {
        expect(ALL_IDS.has(a.regressionActivityId)).toBe(true);
      }
    }
  });

  it("all harderActivityId values resolve to existing IDs or are null", () => {
    for (const a of BH001_BH010) {
      if (a.harderActivityId !== null) {
        expect(ALL_IDS.has(a.harderActivityId)).toBe(true);
      }
    }
  });

  it("BH001–BH010 unlock exactly the next ordered activity", () => {
    for (const a of BH001_BH010) {
      const currentNum = parseInt(a.id.replace("BH", ""), 10);
      const expectedNext = currentNum === 10
        ? null
        : `BH${String(currentNum + 1).padStart(3, "0")}`;
      expect(a.harderActivityId).toBe(expectedNext);
      expect(a.nextActivityId).toBe(expectedNext);
    }
  });

  it("BH002–BH010 regress to the previous ordered activity", () => {
    for (const a of BH001_BH010) {
      const currentNum = parseInt(a.id.replace("BH", ""), 10);
      const expectedRegression = currentNum === 1
        ? null
        : `BH${String(currentNum - 1).padStart(3, "0")}`;
      expect(a.regressionActivityId).toBe(expectedRegression);
    }
  });
});

describe("Required MVP field aliases", () => {
  it("every activity exposes MVP field names alongside database field names", () => {
    for (const a of BH001_BH010) {
      expect(a.orderIndex).toBe(a.sequenceNumber);
      expect(a.recordingSetup).toBe(a.recordingRequirements);
      expect(a.audioRequired).toBe(a.recordingRequirements.audioRequired);
      expect(a.fps).toBe(a.recommendedFps);
      expect(a.prerequisiteActivityId).toBe(a.prerequisites[0] ?? null);
      expect(a.nextActivityId).toBe(a.harderActivityId);
    }
  });
});

describe("Activity-specific MVP expectations", () => {
  it("BH002 uses a 2-second name-response window", () => {
    const bh002 = BH001_BH010.find((a) => a.id === "BH002")!;
    expect(bh002.lessonGoal).toMatch(/within 2 seconds/i);
    expect(bh002.visibleCheckpoint).toMatch(/within 2 seconds/i);
    expect(bh002.passCriteria.join(" ")).toMatch(/within 2 seconds/i);
    expect(bh002.failCriteria.join(" ")).toMatch(/within 2 seconds/i);
    expect(bh002.vlmPrompt).toMatch(/within 2 seconds/i);
    expect(bh002.vlmPrompt).toMatch(/2-second timeout/i);
  });

  it("BH007 verifies at least two paws inside the registered mat boundary", () => {
    const bh007 = BH001_BH010.find((a) => a.id === "BH007")!;
    expect(bh007.lessonGoal).toMatch(/at least two paws/i);
    expect(bh007.visibleCheckpoint).toMatch(/At least two paws/i);
    expect(bh007.passCriteria.join(" ")).toMatch(/At least two paws/i);
    expect(bh007.failCriteria.join(" ")).toMatch(/fewer than two paws/i);
    expect(bh007.vlmPrompt).toMatch(/at least two paws/i);
  });

  it("requested out-of-scope claims are present", () => {
    const expectations: Record<string, RegExp> = {
      BH001: /marker conditioning has been learned/i,
      BH002: /generalized attention/i,
      BH003: /jumping is solved/i,
      BH004: /emotional calmness/i,
      BH005: /physical fitness/i,
      BH006: /generalized impulse control/i,
      BH007: /relaxation/i,
    };
    for (const [id, pattern] of Object.entries(expectations)) {
      const a = BH001_BH010.find((activity) => activity.id === id)!;
      expect(a.outOfScopeClaims.join(" ")).toMatch(pattern);
      expect(a.vlmPrompt).toMatch(pattern);
    }
  });
});

describe("MVP reference-photo decision rules", () => {
  it("mat mismatch or ambiguous mat identity is a NEEDS_REVIEW condition, not FAIL", () => {
    for (const id of MAT_ACTIVITIES) {
      const a = BH001_BH010.find((x) => x.id === id)!;
      expect(a.needsReviewCriteria.join(" ")).toMatch(/does not match|confidently matched/i);
      expect(a.failCriteria.join(" ")).not.toMatch(/mat.*does not match|does not match.*TARGET_MAT/i);
      expect(a.vlmPrompt).toMatch(/verdict=NEEDS_REVIEW/i);
    }
  });

  it("audio-required activities route missing or unusable audio to NEEDS_REVIEW", () => {
    for (const id of AUDIO_REQUIRED_IDS) {
      const a = BH001_BH010.find((x) => x.id === id)!;
      expect(a.needsReviewCriteria.join(" ")).toMatch(/audio/i);
      expect(a.vlmPrompt).toMatch(/audio.*NEEDS_REVIEW|NEEDS_REVIEW.*audio/i);
    }
  });
});

describe("Audio requirements", () => {
  it("BH001 (marker) requires audio", () => {
    const bh001 = BH001_BH010.find((a) => a.id === "BH001")!;
    expect(bh001.recordingRequirements.audioRequired).toBe(true);
  });

  it("BH002 (name response) requires audio", () => {
    const bh002 = BH001_BH010.find((a) => a.id === "BH002")!;
    expect(bh002.recordingRequirements.audioRequired).toBe(true);
  });

  it("BH006 (release cue) requires audio", () => {
    const bh006 = BH001_BH010.find((a) => a.id === "BH006")!;
    expect(bh006.recordingRequirements.audioRequired).toBe(true);
  });

  it("BH003–BH005 and BH007–BH010 do not require audio", () => {
    const nonAudioIds = ["BH003", "BH004", "BH005", "BH007", "BH008", "BH009", "BH010"];
    for (const id of nonAudioIds) {
      const a = BH001_BH010.find((x) => x.id === id)!;
      expect(a.recordingRequirements.audioRequired).toBe(false);
    }
  });
});

describe("Confidence thresholds", () => {
  it("minimumAutoPassConfidence is between 0 and 1 for all activities", () => {
    for (const a of BH001_BH010) {
      expect(a.minimumAutoPassConfidence).toBeGreaterThan(0);
      expect(a.minimumAutoPassConfidence).toBeLessThanOrEqual(1);
    }
  });

  it("minimumAutoFailConfidence is between 0 and 1 for all activities", () => {
    for (const a of BH001_BH010) {
      expect(a.minimumAutoFailConfidence).toBeGreaterThan(0);
      expect(a.minimumAutoFailConfidence).toBeLessThanOrEqual(1);
    }
  });

  it("minimumAutoFailConfidence >= minimumAutoPassConfidence for all activities", () => {
    for (const a of BH001_BH010) {
      expect(a.minimumAutoFailConfidence).toBeGreaterThanOrEqual(
        a.minimumAutoPassConfidence,
      );
    }
  });
});

describe("Reward values", () => {
  it("coinReward is 0 for all activities (reserved for CERTIFIED only)", () => {
    for (const a of BH001_BH010) {
      expect(a.coinReward).toBe(0);
    }
  });

  it("starsAvailable is 3 for all activities", () => {
    for (const a of BH001_BH010) {
      expect(a.starsAvailable).toBe(3);
    }
  });

  it("xpReward is positive for all activities", () => {
    for (const a of BH001_BH010) {
      expect(a.xpReward).toBeGreaterThan(0);
    }
  });

  it("BH010 (most advanced in batch) has higher XP than BH001", () => {
    const bh001 = BH001_BH010.find((a) => a.id === "BH001")!;
    const bh010 = BH001_BH010.find((a) => a.id === "BH010")!;
    expect(bh010.xpReward).toBeGreaterThan(bh001.xpReward);
  });
});

describe("Verification status", () => {
  it("all BH001–BH010 activities are BETA status", () => {
    for (const a of BH001_BH010) {
      expect(a.verificationStatus).toBe("BETA");
    }
  });
});

describe("Recording requirements completeness", () => {
  it("all activities have a cameraAngle", () => {
    for (const a of BH001_BH010) {
      expect(a.recordingRequirements.cameraAngle.length).toBeGreaterThan(0);
    }
  });

  it("all activities have at least one setup instruction", () => {
    for (const a of BH001_BH010) {
      expect(a.recordingRequirements.setupInstructions.length).toBeGreaterThan(0);
    }
  });

  it("mat activities use VISIBLE_TARGET_ZONE camera angle", () => {
    for (const id of MAT_ACTIVITIES) {
      const a = BH001_BH010.find((x) => x.id === id)!;
      expect(a.recordingRequirements.cameraAngle).toBe("VISIBLE_TARGET_ZONE");
    }
  });
});
