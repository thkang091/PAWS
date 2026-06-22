import type { CompletedSeedActivity, SeedActivity } from "./bh001_bh010";

type BatchActivity = CompletedSeedActivity & {
  orderedVisibleActions: string[];
};

type ActivitySpec = {
  id: string;
  title: string;
  orderIndex: number;
  lessonGoal: string;
  visibleCheckpoint: string;
  tutorialSteps: string[];
  cameraAngle: string;
  setupInstructions: string[];
  requiredReferenceAssets: string[];
  audioRequired: boolean;
  fps: number;
  minClipSeconds: number;
  maxClipSeconds: number;
  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];
  outOfScopeClaims: string[];
  safetyNotes: string[];
  prerequisiteActivityId: string | null;
  nextActivityId: string | null;
  orderedVisibleActions: string[];
  skillFamily: string;
  level: 1 | 2 | 3 | 4 | 5;
  fullDogBodyRequired: boolean;
  pawsRequired: boolean;
  ownerRequiredInFrame: boolean;
  targetObjectRequiredInFrame: boolean;
  destinationRequiredInFrame: boolean;
};

const list = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");

const promptFor = (spec: ActivitySpec): string => `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

ACTIVITY ID
${spec.id}

ACTIVITY TITLE
${spec.title}

EXPECTED START STATE
${spec.prerequisiteActivityId ? `Prerequisite activity ${spec.prerequisiteActivityId} has been passed when that branch applies. ` : ""}${spec.orderedVisibleActions[0]}

VISIBLE CHECKPOINT
${spec.visibleCheckpoint}

RECORDING SETUP
- Camera angle: ${spec.cameraAngle}
- Full dog body required: ${spec.fullDogBodyRequired ? "YES" : "NO"}
- Paws required: ${spec.pawsRequired ? "YES" : "NO"}
- Owner or handler in frame required: ${spec.ownerRequiredInFrame ? "YES" : "NO"}
- Target object in frame required: ${spec.targetObjectRequiredInFrame ? "YES" : "NO"}
- Destination in frame required: ${spec.destinationRequiredInFrame ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCE PHOTOS
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the required cue, doorbell, or timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional for this activity. Do not fail solely because audio is absent; return NEEDS_REVIEW only if the submitted attempt depends on release timing that cannot be judged without audio."}

FPS
${spec.fps}

CLIP-DURATION RANGE
${spec.minClipSeconds}-${spec.maxClipSeconds} seconds

ORDERED VISIBLE ACTIONS
${spec.orderedVisibleActions.map((action, index) => `${index + 1}. ${action}`).join("\n")}

PASS CRITERIA
${list(spec.passCriteria)}

FAIL CRITERIA
${list(spec.failCriteria)}

NEEDS_REVIEW CRITERIA
${list(spec.needsReviewCriteria)}

OUT-OF-SCOPE CLAIMS
${list(spec.outOfScopeClaims)}

SAFETY NOTES
${list(spec.safetyNotes)}

JSON-ONLY RESPONSE INSTRUCTION
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: spec.fullDogBodyRequired,
    pawsRequired: spec.pawsRequired,
    hipsRequired: false,
    ownerRequiredInFrame: spec.ownerRequiredInFrame,
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: spec.targetObjectRequiredInFrame,
    destinationRequiredInFrame: spec.destinationRequiredInFrame,
    setupInstructions: spec.setupInstructions,
  };
  const activity: SeedActivity = {
    id: spec.id,
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity builds one small, observable household behavior without claiming broader reliability outside the submitted clip.",
    tutorialSteps: spec.tutorialSteps,
    visibleCheckpoint: spec.visibleCheckpoint,
    prerequisites: spec.prerequisiteActivityId ? [spec.prerequisiteActivityId] : [],
    regressionActivityId: spec.prerequisiteActivityId,
    harderActivityId: spec.nextActivityId,
    requiredReferenceAssets: spec.requiredReferenceAssets,
    recordingRequirements,
    startStateCriteria: [spec.orderedVisibleActions[0]],
    passCriteria: spec.passCriteria,
    failCriteria: spec.failCriteria,
    needsReviewCriteria: spec.needsReviewCriteria,
    outOfScopeClaims: spec.outOfScopeClaims,
    safetyNotes: spec.safetyNotes,
    minimumAutoPassConfidence: 0.8,
    minimumAutoFailConfidence: 0.9,
    verificationStatus: "BETA",
    xpReward: spec.orderIndex >= 26 ? 95 : spec.orderIndex >= 23 ? 90 : 85,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: spec.fps,
    minClipSeconds: spec.minClipSeconds,
    maxClipSeconds: spec.maxClipSeconds,
    vlmPrompt: promptFor(spec),
  };
  return {
    ...activity,
    orderIndex: spec.orderIndex,
    recordingSetup: recordingRequirements,
    audioRequired: spec.audioRequired,
    fps: spec.fps,
    prerequisiteActivityId: spec.prerequisiteActivityId,
    nextActivityId: spec.nextActivityId,
    orderedVisibleActions: spec.orderedVisibleActions,
  };
};

const SPECS: ActivitySpec[] = [
  {
    id: "BH021",
    title: "Four Paws on Floor",
    orderIndex: 21,
    lessonGoal: "Teach the dog to keep all four paws on the floor during a visible challenge interval.",
    visibleCheckpoint: "The dog keeps all four paws on the floor continuously during the visible challenge interval.",
    tutorialSteps: [
      "Set up a full-body view where all four paws stay visible.",
      "Begin recording before the challenge interval starts.",
      "Create a mild greeting or attention challenge without touching the dog.",
      "Keep the interval short and observable.",
      "Reward after the dog keeps all four paws on the floor.",
    ],
    cameraAngle: "FULL_BODY_DOG_VIEW",
    setupInstructions: [
      "Full dog body and all paws must remain visible.",
      "Challenge interval must be clear from start to finish.",
      "No leash tension, hand blocking, or physical restraint may prevent jumping.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Dog remains visible during the challenge interval.",
      "All four paws remain on the floor continuously.",
      "No jump occurs.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog visibly jumps.",
      "Front paws visibly leave the floor and contact a person.",
      "Owner physically restrains dog to prevent jumping.",
    ],
    needsReviewCriteria: [
      "Paws cropped.",
      "Dog hidden.",
      "Challenge interval unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim jumping is permanently solved.",
      "Do not claim generalized greeting manners.",
    ],
    safetyNotes: [
      "Use a low-intensity challenge.",
      "Avoid provoking repeated jumping.",
      "Reward calmly after the interval.",
    ],
    prerequisiteActivityId: null,
    nextActivityId: "BH022",
    orderedVisibleActions: [
      "Target dog is visible in a full-body view before the challenge interval starts.",
      "A mild visible challenge interval begins.",
      "All four paws remain on the floor throughout the interval.",
      "The interval ends without jumping or physical restraint.",
    ],
    skillFamily: "Greeting Manners",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH022",
    title: "Calm Greeting with Familiar Person",
    orderIndex: 22,
    lessonGoal: "Teach the dog to keep all four paws on the floor while a familiar person approaches.",
    visibleCheckpoint: "A visible familiar person approaches and the dog keeps all four paws on the floor during the greeting interval.",
    tutorialSteps: [
      "Use a wide view with the dog, paws, and approaching familiar person visible.",
      "Begin recording before the person approaches.",
      "Have the familiar person approach calmly.",
      "Keep the greeting interval short.",
      "Reward after the dog keeps all four paws on the floor.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog, all paws, and approaching person must be visible.",
      "Greeting interval must be visible from approach through completion.",
      "No leash tension, hand blocking, holding, or physical restraint may prevent jumping.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Person approach is visible.",
      "Dog keeps all four paws on the floor during the greeting interval.",
      "No restraint occurs.",
    ],
    failCriteria: [
      "Dog visibly jumps.",
      "Dog places paws on the person.",
      "Dog is physically restrained.",
    ],
    needsReviewCriteria: [
      "Approaching person cropped.",
      "Dog paws cropped.",
      "Greeting interval unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized greeting manners.",
      "Do not claim the dog will greet unfamiliar people the same way.",
    ],
    safetyNotes: [
      "Use a familiar person and low excitement level.",
      "Pause if the dog becomes over-aroused.",
      "Keep greetings brief.",
    ],
    prerequisiteActivityId: "BH021",
    nextActivityId: "BH023",
    orderedVisibleActions: [
      "Target dog is visible before the familiar person approaches.",
      "A familiar person visibly approaches.",
      "Dog keeps all four paws on the floor during the greeting interval.",
      "Greeting interval ends without jumping or physical restraint.",
    ],
    skillFamily: "Greeting Manners",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH023",
    title: "Doorbell Sound to Mat",
    orderIndex: 23,
    lessonGoal: "Teach the dog to travel to the registered mat after one audible doorbell sound.",
    visibleCheckpoint: "One audible doorbell sound occurs and the dog then travels to the registered TARGET_MAT.",
    tutorialSteps: [
      "Use the registered TARGET_MAT from the place-mat activities.",
      "Position the camera so the mat and dog movement path are visible.",
      "Begin recording before the doorbell sound.",
      "Play or ring one doorbell sound.",
      "Reward after at least two paws enter the mat boundary.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Mat must be fully visible.",
      "Dog path to the mat must remain visible.",
      "Doorbell sound must be audible.",
      "Begin recording before the doorbell sound occurs.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 18,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Doorbell is audible.",
      "Visible mat matches TARGET_MAT reference photos.",
      "Dog moves to mat after the sound.",
      "At least two paws enter the mat boundary.",
    ],
    failCriteria: [
      "Dog travels elsewhere.",
      "Dog does not enter mat.",
      "Movement occurs only before the doorbell sound.",
    ],
    needsReviewCriteria: [
      "Doorbell inaudible.",
      "Mat cropped.",
      "Mat identity unclear.",
      "Dog path hidden.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim barking is solved.",
      "Do not claim generalized doorbell reliability.",
    ],
    safetyNotes: [
      "Use a low-volume doorbell sound at first.",
      "Avoid repeated doorbell stress.",
      "Reward quietly on the mat.",
    ],
    prerequisiteActivityId: "BH007",
    nextActivityId: "BH024",
    orderedVisibleActions: [
      "Target dog and registered TARGET_MAT are visible before the doorbell sound.",
      "One doorbell sound is audible.",
      "Dog moves toward the registered mat after the sound.",
      "At least two paws enter the visible mat boundary.",
    ],
    skillFamily: "Doorbell to Mat",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH024",
    title: "Doorbell to Mat + 5-Second Hold",
    orderIndex: 24,
    lessonGoal: "Teach the dog to enter the registered mat after a doorbell sound and remain there for 5 seconds.",
    visibleCheckpoint: "Audible doorbell, dog enters TARGET_MAT, and dog remains inside mat boundary for at least 5 seconds.",
    tutorialSteps: [
      "Keep the registered mat fully visible.",
      "Begin recording before the doorbell sound.",
      "Play or ring one doorbell sound.",
      "Allow the dog to travel to the mat.",
      "Reward after the dog remains inside the mat boundary for 5 seconds.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Mat boundary must remain fully visible.",
      "Doorbell sound must be audible.",
      "Dog entry and full 5-second hold must be visible.",
      "Begin recording before the doorbell sound occurs.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 12,
    maxClipSeconds: 25,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Doorbell is audible.",
      "Registered mat matches TARGET_MAT reference photos.",
      "Dog enters mat after the sound.",
      "Dog completes a continuous 5-second hold inside the mat boundary.",
    ],
    failCriteria: [
      "Dog never enters mat.",
      "Dog leaves mat before 5 seconds.",
      "Dog is restrained on mat.",
    ],
    needsReviewCriteria: [
      "Audio unclear.",
      "Mat boundary cropped.",
      "Hold duration unclear.",
      "Mat identity unclear.",
      "Dog hidden during entry or hold.",
    ],
    outOfScopeClaims: [
      "Do not claim barking is solved.",
      "Do not claim relaxation on the mat.",
    ],
    safetyNotes: [
      "Keep the doorbell sound low enough for the dog to work comfortably.",
      "Release and reset if the dog leaves the mat.",
      "Avoid physically holding the dog on the mat.",
    ],
    prerequisiteActivityId: "BH023",
    nextActivityId: "BH025",
    orderedVisibleActions: [
      "Target dog and registered TARGET_MAT are visible before the doorbell sound.",
      "One doorbell sound is audible.",
      "Dog enters the registered mat after the sound.",
      "Dog remains inside the mat boundary continuously for at least 5 seconds.",
    ],
    skillFamily: "Doorbell to Mat",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH025",
    title: "Doorbell to Mat + Release",
    orderIndex: 25,
    lessonGoal: "Teach the dog to enter the registered mat after a doorbell sound, hold, and exit only after release.",
    visibleCheckpoint: "Audible doorbell, mat entry, mat hold, audible release cue, and dog exits only after release.",
    tutorialSteps: [
      "Keep the full registered mat visible.",
      "Begin recording before the doorbell sound.",
      "Play or ring one doorbell sound.",
      "Let the dog enter and hold on the mat.",
      "Give one audible release cue.",
      "Reward after the dog exits only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full mat boundary must remain visible.",
      "Doorbell sound and release cue must be audible.",
      "Dog must be visible during entry, hold, release cue, and exit.",
      "Begin recording before the doorbell sound occurs.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 28,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Doorbell is audible.",
      "Visible mat matches TARGET_MAT reference photos.",
      "Dog holds on the mat.",
      "Release cue is audible.",
      "Dog exits after release only.",
    ],
    failCriteria: [
      "Dog exits before release.",
      "Dog never enters mat.",
      "Dog is physically removed from mat.",
    ],
    needsReviewCriteria: [
      "Audio unclear.",
      "Timing unclear.",
      "Mat cropped.",
      "Dog hidden.",
      "Mat identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim barking is solved.",
      "Do not claim the dog can hold at the doorbell in other rooms.",
    ],
    safetyNotes: [
      "Keep the hold short enough to succeed.",
      "Use one clear release cue.",
      "Do not pull or lift the dog off the mat.",
    ],
    prerequisiteActivityId: "BH024",
    nextActivityId: "BH026",
    orderedVisibleActions: [
      "Target dog and full registered TARGET_MAT are visible before the doorbell sound.",
      "One doorbell sound is audible.",
      "Dog enters and holds on the registered mat.",
      "One release cue is audible.",
      "Dog exits the mat only after the release cue.",
    ],
    skillFamily: "Doorbell to Mat",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH026",
    title: "Drop Low-Value Toy",
    orderIndex: 26,
    lessonGoal: "Teach the dog to release a registered low-value toy after one audible drop cue.",
    visibleCheckpoint: "The dog visibly releases the registered low-value TARGET_TOY after one audible drop cue.",
    tutorialSteps: [
      "Register the low-value toy before recording.",
      "Use a close view of the dog mouth and toy.",
      "Begin recording while the dog has the toy.",
      "Give one audible drop cue.",
      "Reward after the toy is released without forced removal.",
    ],
    cameraAngle: "CLOSE_DOG_MOUTH_AND_OBJECT",
    setupInstructions: [
      "Dog mouth and toy must stay visible.",
      "Owner hand may be visible but must not force the toy out.",
      "Drop cue must be audible.",
      "Begin recording before the drop cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "TARGET_TOY matches saved reference photos.",
      "Drop cue is audible.",
      "Dog releases toy after the cue.",
      "Release visibly occurs without forced removal.",
    ],
    failCriteria: [
      "Dog does not release toy.",
      "Toy releases only before cue.",
      "Owner forcibly removes toy.",
    ],
    needsReviewCriteria: [
      "Toy hidden.",
      "Dog mouth cropped.",
      "Cue inaudible.",
      "Release obscured.",
      "Toy identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim resource guarding improvement.",
      "Do not claim generalized drop reliability.",
    ],
    safetyNotes: [
      "Use a low-value toy.",
      "Avoid pulling the toy from the dog's mouth.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityId: null,
    nextActivityId: "BH027",
    orderedVisibleActions: [
      "Target dog is visible with the registered low-value TARGET_TOY in or near the mouth.",
      "One drop cue is audible.",
      "Dog releases the toy after the cue.",
      "Release occurs without forced removal.",
    ],
    skillFamily: "Drop and Trade",
    level: 2,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH027",
    title: "Drop Exciting Toy",
    orderIndex: 27,
    lessonGoal: "Teach the dog to release a registered higher-value toy after one audible drop cue.",
    visibleCheckpoint: "The dog visibly releases a registered higher-value TARGET_TOY after one audible drop cue.",
    tutorialSteps: [
      "Use a registered higher-value toy.",
      "Keep the dog mouth and toy visible.",
      "Begin recording while the dog has the toy.",
      "Give one audible drop cue.",
      "Reward the voluntary release without forced removal.",
    ],
    cameraAngle: "CLOSE_DOG_MOUTH_AND_OBJECT",
    setupInstructions: [
      "Dog mouth and toy must remain visible.",
      "Drop cue must be audible.",
      "Owner hand may be visible but must not force the toy out.",
      "Begin recording before the drop cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Toy matches TARGET_TOY reference photos.",
      "Cue is audible.",
      "Voluntary release occurs after the cue.",
      "No forced removal occurs.",
    ],
    failCriteria: [
      "No release occurs.",
      "Forced removal occurs.",
      "Wrong toy is used.",
    ],
    needsReviewCriteria: [
      "Dog mouth hidden.",
      "Toy identity unclear.",
      "Release obscured.",
      "Cue inaudible.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not infer guarding treatment.",
      "Do not claim generalized drop reliability.",
    ],
    safetyNotes: [
      "Use a toy that is exciting but safe.",
      "Do not pry the toy from the dog's mouth.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityId: "BH026",
    nextActivityId: "BH028",
    orderedVisibleActions: [
      "Target dog is visible with the registered higher-value TARGET_TOY in or near the mouth.",
      "One drop cue is audible.",
      "Dog voluntarily releases the toy after the cue.",
      "No forced removal occurs.",
    ],
    skillFamily: "Drop and Trade",
    level: 2,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH028",
    title: "Trade One Toy for Another",
    orderIndex: 28,
    lessonGoal: "Teach the dog to voluntarily release a registered toy in exchange for another toy or visible reward.",
    visibleCheckpoint: "The dog visibly releases registered toy A and receives visible toy B or a reward exchange.",
    tutorialSteps: [
      "Register the original toy before recording.",
      "Keep the dog mouth, original toy, exchange item, and owner hand visible.",
      "Begin recording while the dog has the original toy.",
      "Give the trade cue if one is used.",
      "Deliver the exchange item or reward after the voluntary release.",
    ],
    cameraAngle: "CLOSE_DOG_MOUTH_AND_OBJECT",
    setupInstructions: [
      "Dog mouth, original toy, exchange item, and owner hand must be visible.",
      "Audio is required when trade cue timing is judged.",
      "Original toy must match TARGET_TOY reference photos.",
      "Begin recording before the release and exchange.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Original toy matches TARGET_TOY reference photos.",
      "Voluntary release is visible.",
      "Exchange item or reward is visibly delivered.",
      "No forced removal occurs.",
    ],
    failCriteria: [
      "Toy is forcibly removed.",
      "No voluntary release occurs.",
      "Exchange item is not delivered.",
    ],
    needsReviewCriteria: [
      "Dog mouth hidden.",
      "Toy identity unclear.",
      "Exchange item cropped.",
      "Release obscured.",
      "Cue inaudible when cue timing is part of the attempt.",
    ],
    outOfScopeClaims: [
      "Do not claim resource guarding recovery.",
      "Do not claim generalized trade reliability.",
    ],
    safetyNotes: [
      "Use a fair exchange item.",
      "Avoid grabbing or prying the original toy.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityId: "BH027",
    nextActivityId: "BH029",
    orderedVisibleActions: [
      "Target dog is visible with the registered original TARGET_TOY.",
      "Owner presents a visible exchange item or reward.",
      "Dog voluntarily releases the original toy.",
      "Exchange item or reward is delivered after release.",
    ],
    skillFamily: "Drop and Trade",
    level: 2,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH029",
    title: "Leave Closed Hand",
    orderIndex: 29,
    lessonGoal: "Teach the dog to disengage from the owner's closed hand and remain disengaged briefly.",
    visibleCheckpoint: "The dog visibly disengages from the owner's closed hand and remains disengaged briefly.",
    tutorialSteps: [
      "Use a close view of the dog nose and closed hand.",
      "Begin recording before the dog investigates the hand.",
      "Present the closed hand without pushing the dog away.",
      "Wait for the dog to disengage.",
      "Reward after brief visible disengagement.",
    ],
    cameraAngle: "CLOSE_DOG_NOSE_AND_HAND",
    setupInstructions: [
      "Dog nose and owner's closed hand must remain visible.",
      "Interaction must begin after recording starts.",
      "Owner must not push the dog away.",
      "Audio is optional.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Dog investigates or orients toward the closed hand.",
      "Dog visibly disengages.",
      "Brief disengagement remains visible.",
      "No pushing occurs.",
    ],
    failCriteria: [
      "Dog persistently paws, mouths, or presses into hand.",
      "Owner pushes dog away.",
    ],
    needsReviewCriteria: [
      "Dog nose hidden.",
      "Closed hand cropped.",
      "Interaction starts before recording.",
      "Timing unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized leave-it reliability.",
      "Do not infer food safety in other settings.",
    ],
    safetyNotes: [
      "Use a low-value item inside the closed hand if food is present.",
      "Keep the hand still and closed.",
      "Avoid pushing the dog's face away.",
    ],
    prerequisiteActivityId: null,
    nextActivityId: "BH030",
    orderedVisibleActions: [
      "Target dog nose and owner's closed hand are visible before interaction begins.",
      "Dog investigates or orients toward the closed hand.",
      "Dog visibly disengages from the hand.",
      "Brief disengagement remains visible without pushing.",
    ],
    skillFamily: "Leave It Foundations",
    level: 2,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH030",
    title: "Leave Covered Floor Food",
    orderIndex: 30,
    lessonGoal: "Teach the dog to disengage from visible covered floor food without accessing it before release.",
    visibleCheckpoint: "The dog visibly disengages from covered floor food and does not access it before release.",
    tutorialSteps: [
      "Stage covered floor food in a clearly visible setup.",
      "Position the camera so the covered food, dog nose, and dog path remain visible.",
      "Begin recording before the dog approaches the setup.",
      "Let the dog notice the covered food without physically blocking.",
      "Reward after the dog disengages and does not access the food.",
    ],
    cameraAngle: "VISIBLE_OBJECT_AND_DESTINATION",
    setupInstructions: [
      "Covered floor-food setup must be visible.",
      "Dog nose and path must remain visible.",
      "The cover must not hide whether the dog accesses the food.",
      "Audio is required only if release timing is part of the attempt.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Covered food setup is visible.",
      "Dog disengages from the covered food setup.",
      "Dog does not access food.",
      "No forced blocking occurs.",
    ],
    failCriteria: [
      "Dog accesses food.",
      "Dog repeatedly paws or mouths cover without disengaging.",
      "Owner physically pushes dog away.",
    ],
    needsReviewCriteria: [
      "Food setup hidden.",
      "Dog nose hidden.",
      "Cover hides relevant evidence.",
      "Timing unclear.",
      "Release cue inaudible when release timing is part of the attempt.",
    ],
    outOfScopeClaims: [
      "Do not infer food guarding status.",
      "Do not claim generalized leave-it reliability.",
    ],
    safetyNotes: [
      "Use safe food and a secure cover.",
      "Do not create conflict around food.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityId: "BH029",
    nextActivityId: "BH031",
    orderedVisibleActions: [
      "Target dog, dog nose path, and visible covered floor-food setup are in frame before the approach.",
      "Dog notices or approaches the covered food setup.",
      "Dog visibly disengages from the covered food setup.",
      "Dog does not access the food before any release.",
    ],
    skillFamily: "Leave It Foundations",
    level: 2,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
];

export const BH021_BH030: BatchActivity[] = SPECS.map(makeActivity);
