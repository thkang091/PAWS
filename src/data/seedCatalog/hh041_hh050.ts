import type { CompletedSeedActivity, SeedActivity } from "./bh001_bh010";

type BatchActivity = CompletedSeedActivity & { orderedVisibleActions: string[] };

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
  conditionalReferenceRules: string[];
  audioRequired: boolean;
  fps: number;
  minClipSeconds: number;
  maxClipSeconds: number;
  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];
  outOfScopeClaims: string[];
  safetyNotes: string[];
  prerequisiteActivityIds: string[];
  nextActivityId: string | null;
  orderedVisibleActions: string[];
  skillFamily: string;
  level: 1 | 2 | 3 | 4 | 5;
};

const list = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");

const promptFor = (spec: ActivitySpec): string => `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

ACTIVITY ID
${spec.id}

ACTIVITY TITLE
${spec.title}

EXPECTED START STATE
${spec.prerequisiteActivityIds.length > 0 ? `Prerequisite activity or activities ${spec.prerequisiteActivityIds.join(", ")} have been passed. ` : ""}${spec.orderedVisibleActions[0]}

VISIBLE CHECKPOINT
${spec.visibleCheckpoint}

RECORDING SETUP
- Camera angle: ${spec.cameraAngle}
- Full dog body required: YES
- Owner or handler in frame required: ${spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")) ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the drop cue, bell ring, spoken cue, target cue, or required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If a spoken person cue, spoken toy-name cue, target cue, or cue timing is part of the submitted attempt and audio is unclear, return NEEDS_REVIEW."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching visible dog and objects, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies one visible household helper task without claiming generalized assistance outside the submitted clip.",
    tutorialSteps: spec.tutorialSteps,
    visibleCheckpoint: spec.visibleCheckpoint,
    prerequisites: spec.prerequisiteActivityIds,
    regressionActivityId: prerequisiteActivityId,
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
    xpReward: spec.orderIndex >= 48 ? 185 : spec.orderIndex >= 44 ? 180 : 175,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: spec.fps,
    minClipSeconds: spec.minClipSeconds,
    maxClipSeconds: spec.maxClipSeconds,
    vlmPrompt: promptFor(spec),
  };
  return { ...activity, orderIndex: spec.orderIndex, recordingSetup: recordingRequirements, audioRequired: spec.audioRequired, fps: spec.fps, prerequisiteActivityId, nextActivityId: spec.nextActivityId, orderedVisibleActions: spec.orderedVisibleActions };
};

const SPECS: ActivitySpec[] = [
  {
    id: "HH041",
    title: "Retrieve -> Carry -> Drop",
    orderIndex: 41,
    lessonGoal: "Teach the dog to retrieve the registered toy, carry it to owner area, and release it after an audible drop cue.",
    visibleCheckpoint: "Dog travels to registered TARGET_TOY, picks it up, carries it to owner area, and releases it after audible drop cue.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep toy, dog mouth, owner, and route visible.", "Begin recording before the dog travels to the toy.", "Give one audible drop cue after the dog reaches owner area.", "Reward release without forced removal."],
    cameraAngle: "TOY_DOG_MOUTH_OWNER_AND_ROUTE",
    setupInstructions: ["TARGET_TOY, dog mouth, owner, and route must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Audio is required for the drop cue.", "No forced toy removal may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    conditionalReferenceRules: ["If toy identity is unclear, return NEEDS_REVIEW."],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Pickup is visible.", "Carry is visible.", "Dog reaches owner area.", "Drop cue is audible.", "Release occurs after cue.", "No forced removal occurs."],
    failCriteria: ["Wrong toy is used.", "No pickup occurs.", "Toy is dropped before arrival.", "No release occurs after cue.", "Owner forcibly removes toy."],
    needsReviewCriteria: ["Pickup hidden.", "Dog mouth obscured.", "Audio unclear.", "Route cropped.", "Release hidden."],
    outOfScopeClaims: ["Do not claim generalized retrieve reliability.", "Do not infer resource guarding improvement."],
    safetyNotes: ["Use a safe toy.", "Do not pry the toy from the dog."],
    prerequisiteActivityIds: ["HH011"],
    nextActivityId: "HH042",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, owner, route, and dog mouth are visible.", "Dog travels to toy and picks it up.", "Dog carries toy to owner area.", "Audible drop cue occurs.", "Dog releases toy after cue without forced removal."],
    skillFamily: "Integrated Retrieve Tasks",
    level: 5,
  },
  {
    id: "HH042",
    title: "Retrieve -> Basket Cleanup",
    orderIndex: 42,
    lessonGoal: "Teach the dog to retrieve the registered toy and release it inside the registered basket.",
    visibleCheckpoint: "Dog retrieves registered TARGET_TOY, carries it to registered TARGET_BASKET, and releases it inside basket.",
    tutorialSteps: ["Use registered TARGET_TOY and TARGET_BASKET.", "Keep toy, basket, dog mouth, and route visible.", "Begin before pickup.", "Record pickup, carry, and release.", "Reward only after release inside basket."],
    cameraAngle: "TOY_BASKET_DOG_MOUTH_AND_ROUTE",
    setupInstructions: ["TARGET_TOY, TARGET_BASKET, dog mouth, and route must be visible.", "Toy and basket must match saved reference photos.", "Release inside basket must be visible.", "Owner must not place toy in basket."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    conditionalReferenceRules: ["If toy or basket identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Basket matches TARGET_BASKET.", "Pickup is visible.", "Carry is visible.", "Release inside basket is visible.", "No owner placement occurs."],
    failCriteria: ["Wrong toy is used.", "Toy is dropped outside basket.", "Basket mismatch occurs.", "Owner places toy away."],
    needsReviewCriteria: ["Pickup hidden.", "Basket cropped.", "Release hidden.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim full cleanup reliability.", "Do not infer object sorting."],
    safetyNotes: ["Use a stable basket.", "Use safe toys."],
    prerequisiteActivityIds: ["HH012", "HH013"],
    nextActivityId: "HH043",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, registered TARGET_BASKET, mouth, and route are visible.", "Dog picks up toy.", "Dog carries toy to basket.", "Dog releases toy inside basket without owner placement."],
    skillFamily: "Integrated Cleanup Tasks",
    level: 5,
  },
  {
    id: "HH043",
    title: "Find Person -> Deliver Toy",
    orderIndex: 43,
    lessonGoal: "Teach the dog to carry the registered toy to the specified family member.",
    visibleCheckpoint: "Dog locates specified family member and reaches that person while carrying registered TARGET_TOY.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep dog, toy, route, and target person visible when possible.", "Begin before the dog starts delivery.", "Use a person cue only if it is part of the attempt.", "Reward after the dog reaches the specified person with the toy."],
    cameraAngle: "DOG_TOY_ROUTE_AND_TARGET_PERSON",
    setupInstructions: ["Dog, TARGET_TOY, route, and target person must be visible when possible.", "Visible toy must match saved TARGET_TOY photos.", "Audio is required when person cue timing is judged.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    conditionalReferenceRules: ["No saved person reference is required; if the specified person is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Specified person is reached.", "Dog carries toy to person area.", "No physical guidance occurs."],
    failCriteria: ["Wrong person is reached.", "Toy is dropped before arrival.", "Wrong toy is used.", "Owner directs dog physically."],
    needsReviewCriteria: ["Target person unclear.", "Dog mouth hidden.", "Route cropped.", "Cue unclear when required."],
    outOfScopeClaims: ["Do not claim generalized person-name understanding.", "Do not infer generalized delivery reliability."],
    safetyNotes: ["Use a safe toy.", "Keep the route clear."],
    prerequisiteActivityIds: ["HH024"],
    nextActivityId: "HH044",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, route, and target person are visible when possible.", "Dog carries toy along route.", "Dog reaches the specified person area.", "Owner does not physically guide dog."],
    skillFamily: "Integrated Delivery Tasks",
    level: 5,
  },
  {
    id: "HH044",
    title: "Button -> Mat Routine",
    orderIndex: 44,
    lessonGoal: "Teach the dog to contact the registered button and then travel to the registered mat.",
    visibleCheckpoint: "Dog contacts registered TARGET_BUTTON, then travels to registered TARGET_MAT and enters mat boundary.",
    tutorialSteps: ["Use registered TARGET_BUTTON and TARGET_MAT.", "Keep button, mat, dog, and route visible.", "Begin before button contact.", "Record dog travel to mat after button contact.", "Reward after at least two paws enter mat boundary."],
    cameraAngle: "BUTTON_MAT_DOG_AND_ROUTE",
    setupInstructions: ["TARGET_BUTTON, TARGET_MAT, dog, and route must be visible.", "Button and mat must match saved reference photos.", "Use 5 FPS during button contact and 3 FPS during mat travel.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BUTTON", "TARGET_MAT"],
    conditionalReferenceRules: ["If button or mat identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Button matches TARGET_BUTTON.", "Dog contact is visible.", "Mat matches TARGET_MAT.", "Dog travels to mat.", "At least two paws enter mat boundary."],
    failCriteria: ["Button is not touched.", "Wrong object is touched.", "Dog does not reach mat.", "Owner physically guides dog."],
    needsReviewCriteria: ["Button hidden.", "Mat cropped.", "Contact unclear.", "Route hidden."],
    outOfScopeClaims: ["Do not claim button communication.", "Do not infer semantic button meaning."],
    safetyNotes: ["Use a stable safe button.", "Keep the route clear and mat stable."],
    prerequisiteActivityIds: ["HH028", "HH002"],
    nextActivityId: "HH045",
    orderedVisibleActions: ["Target dog, registered TARGET_BUTTON, registered TARGET_MAT, and route are visible.", "Dog contacts button.", "Dog travels from button area to mat.", "At least two paws enter mat boundary without physical guidance."],
    skillFamily: "Integrated Button Tasks",
    level: 5,
  },
  {
    id: "HH045",
    title: "Bell -> Doorway Routine",
    orderIndex: 45,
    lessonGoal: "Teach the dog to travel to the registered doorway and activate the registered bell.",
    visibleCheckpoint: "Dog travels to registered TARGET_DOORWAY area and rings registered TARGET_BELL.",
    tutorialSteps: ["Use registered TARGET_DOORWAY and TARGET_BELL.", "Keep doorway, bell, dog, and route visible.", "Begin before the dog travels to doorway.", "Capture bell activation audio.", "Reward after dog contact activates the bell."],
    cameraAngle: "DOORWAY_BELL_DOG_AND_ROUTE",
    setupInstructions: ["TARGET_DOORWAY, TARGET_BELL, dog, and route must be visible.", "Doorway and bell must match saved reference photos.", "Audio is required.", "Owner must not ring bell instead."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BELL", "TARGET_DOORWAY"],
    conditionalReferenceRules: ["If doorway or bell identity is unclear, return NEEDS_REVIEW."],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Doorway matches TARGET_DOORWAY.", "Bell matches TARGET_BELL.", "Dog reaches bell.", "Dog contacts bell.", "Audible ring or visible activation occurs."],
    failCriteria: ["Wrong object is contacted.", "No bell activation occurs.", "Dog does not reach doorway.", "Owner rings bell instead."],
    needsReviewCriteria: ["Bell hidden.", "Doorway cropped.", "Contact unclear.", "Audio unclear."],
    outOfScopeClaims: ["Do not claim generalized door-alert behavior.", "Do not infer service alert reliability."],
    safetyNotes: ["Use a stable safe bell.", "Keep bell volume comfortable."],
    prerequisiteActivityIds: ["HH031"],
    nextActivityId: "HH046",
    orderedVisibleActions: ["Target dog, registered TARGET_DOORWAY, registered TARGET_BELL, and route are visible.", "Dog travels to doorway area.", "Dog contacts bell.", "Audible ring or visible activation occurs without owner activation."],
    skillFamily: "Integrated Bell Tasks",
    level: 5,
  },
  {
    id: "HH046",
    title: "Toy-Cleanup Speed Challenge",
    orderIndex: 46,
    lessonGoal: "Teach the dog to retrieve configured registered toys and place them into the registered basket within a measurable visible interval.",
    visibleCheckpoint: "Dog retrieves configured registered toys and places them into registered TARGET_BASKET within a measurable visible interval.",
    tutorialSteps: ["Use configured registered TARGET_TOY items and TARGET_BASKET.", "Keep registered toys and basket visible across the clip or clip set.", "Begin before the first pickup.", "Record each pickup and basket release.", "Keep maximum combined duration to 60 seconds."],
    cameraAngle: "REGISTERED_TOYS_BASKET_AND_SEQUENCE",
    setupInstructions: ["Registered TARGET_TOY items and TARGET_BASKET must be visible as needed.", "Separate clips or one clear wide clip may be used.", "Elapsed interval must be measurable.", "Owner must not place toys into basket."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    conditionalReferenceRules: ["Each required toy must match saved TARGET_TOY references; unclear toy or basket identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 60,
    passCriteria: ["Dog matches DOG_PROFILE.", "Each required toy matches saved references.", "Each pickup is visible.", "Each basket release is visible.", "All required toys are placed inside basket.", "Elapsed time is measurable.", "No owner placement occurs."],
    failCriteria: ["Required toy is missing.", "Release occurs outside basket.", "Wrong toy is used.", "Owner places toy into basket."],
    needsReviewCriteria: ["Any pickup hidden.", "Basket cropped.", "Sequence incomplete.", "Elapsed time unclear.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim competition fairness outside submitted clip.", "Do not infer generalized cleanup reliability."],
    safetyNotes: ["Use safe toys.", "Keep basket stable.", "Stop before frustration."],
    prerequisiteActivityIds: ["HH015"],
    nextActivityId: "HH047",
    orderedVisibleActions: ["Target dog, configured registered TARGET_TOY items, TARGET_BASKET, and sequence area are visible as needed.", "Dog picks up each required toy.", "Dog carries each toy to basket.", "Dog releases each toy inside basket within measurable interval without owner placement."],
    skillFamily: "Integrated Cleanup Tasks",
    level: 5,
  },
  {
    id: "HH047",
    title: "Named-Object Challenge",
    orderIndex: 47,
    lessonGoal: "Teach the dog to select the configured named registered toy from multiple visible registered toy options.",
    visibleCheckpoint: "Dog selects the configured named registered toy from multiple visible registered toy options.",
    tutorialSteps: ["Use multiple visible registered TARGET_TOY options.", "Keep all options, dog, owner, and toy area visible.", "Give the spoken toy-name cue when judging cue timing.", "Record selection, pickup, or target contact.", "Reward only the configured target selection."],
    cameraAngle: "MULTIPLE_TOYS_DOG_OWNER_AND_TOY_AREA",
    setupInstructions: ["All registered toy options, dog, owner, and toy area must be visible.", "All visible toy options must be identifiable from saved TARGET_TOY references.", "Audio is required when spoken toy-name cue is judged.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    conditionalReferenceRules: ["Multiple registered TARGET_TOY options must be visible; if any toy identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Multiple registered toys are visible.", "Target cue is audible when required.", "Dog selects correct TARGET_TOY.", "Pickup or target contact is visible.", "No physical guidance occurs."],
    failCriteria: ["Wrong toy is selected.", "Dog does not select a toy.", "Owner directs dog physically."],
    needsReviewCriteria: ["Toy identities unclear.", "One option hidden.", "Audio unclear.", "Selection obscured."],
    outOfScopeClaims: ["Do not claim broad language comprehension.", "Do not infer generalized named-object reliability."],
    safetyNotes: ["Use safe toys.", "Keep choices spaced to avoid confusion or conflict."],
    prerequisiteActivityIds: ["HH017"],
    nextActivityId: "HH048",
    orderedVisibleActions: ["Target dog, owner, and multiple registered TARGET_TOY options are visible.", "Target cue occurs when used.", "Dog selects the configured toy by pickup or target contact.", "Owner does not physically guide selection."],
    skillFamily: "Named Object Tasks",
    level: 5,
  },
  {
    id: "HH048",
    title: "Bring Leash -> Owner",
    orderIndex: 48,
    lessonGoal: "Teach the dog to pick up a visible registered leash and bring it to owner area.",
    visibleCheckpoint: "Dog travels to visible registered leash, picks it up, carries it, and reaches owner area.",
    tutorialSteps: ["Place the leash in a visible location.", "Register the leash as CUSTOM_OBJECT when the saved-object flow is used.", "Keep leash, dog mouth, owner, and route visible.", "Begin before the dog travels to leash.", "Reward after dog reaches owner area with the leash."],
    cameraAngle: "LEASH_DOG_MOUTH_OWNER_AND_ROUTE",
    setupInstructions: ["Leash, dog mouth, owner, and route must be visible.", "Leash must match registered CUSTOM_OBJECT reference when required.", "Pickup, carry, and arrival must be visible.", "Owner must not place leash in dog mouth."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required when the leash is registered as a saved object; if registered leash identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Leash matches registered reference when required.", "Dog travels to leash.", "Pickup is visible.", "Dog carries leash.", "Dog reaches owner area."],
    failCriteria: ["Wrong object is selected.", "No pickup occurs.", "Leash is dropped before arrival.", "Owner places leash in dog mouth."],
    needsReviewCriteria: ["Leash hidden.", "Pickup obscured.", "Route cropped.", "Arrival hidden."],
    outOfScopeClaims: ["Do not claim the dog is requesting a walk.", "Do not infer service-task reliability."],
    safetyNotes: ["Use a safe lightweight leash.", "Avoid leash entanglement."],
    prerequisiteActivityIds: ["HH035"],
    nextActivityId: "HH049",
    orderedVisibleActions: ["Target dog, visible leash, dog mouth, owner, and route are visible.", "Dog travels to leash.", "Dog picks up leash visibly.", "Dog carries leash and reaches owner area."],
    skillFamily: "Object Carry Tasks",
    level: 5,
  },
  {
    id: "HH049",
    title: "Find Object -> Deliver",
    orderIndex: 49,
    lessonGoal: "Teach the dog to locate a registered object, pick it up, carry it, and reach owner or configured destination.",
    visibleCheckpoint: "Dog locates registered CUSTOM_OBJECT, picks it up, carries it, and reaches owner or configured destination.",
    tutorialSteps: ["Use a registered CUSTOM_OBJECT.", "Keep object area, dog, route, and destination visible.", "Begin before search or approach.", "Record pickup, carry, and destination arrival.", "Reward after the dog reaches the configured destination with the object."],
    cameraAngle: "OBJECT_AREA_DOG_ROUTE_AND_DESTINATION",
    setupInstructions: ["CUSTOM_OBJECT area, dog, route, and destination must be visible.", "Visible object must match saved CUSTOM_OBJECT photos.", "Pickup, carry, and destination arrival must be visible.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: ["If CUSTOM_OBJECT identity or destination is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object matches registered reference.", "Search or approach is visible.", "Pickup is visible.", "Carry is visible.", "Destination is reached.", "No physical guidance occurs."],
    failCriteria: ["Wrong object is used.", "No pickup occurs.", "Wrong destination is reached.", "Owner physically directs dog."],
    needsReviewCriteria: ["Object hidden.", "Identity unclear.", "Pickup cropped.", "Route hidden.", "Destination unclear."],
    outOfScopeClaims: ["Do not claim generalized search ability.", "Do not infer broad object-name understanding."],
    safetyNotes: ["Use a lightweight safe object.", "Keep the route clear."],
    prerequisiteActivityIds: ["HH036"],
    nextActivityId: "HH050",
    orderedVisibleActions: ["Target dog, registered CUSTOM_OBJECT area, route, and destination are visible.", "Dog searches for or approaches object.", "Dog picks up and carries object.", "Dog reaches owner or configured destination without physical guidance."],
    skillFamily: "Integrated Delivery Tasks",
    level: 5,
  },
  {
    id: "HH050",
    title: "Helpful-Skills Final Routine",
    orderIndex: 50,
    lessonGoal: "Verify a narrow helpful-skills routine made from selected registered household components.",
    visibleCheckpoint: "A clearly segmented single clip or short clip set includes one mat or crate send, one object retrieve, one object carry, one release into basket or near owner, and one button, bell, person-delivery, or leash-delivery component.",
    tutorialSteps: ["Choose a narrow routine using registered components already practiced.", "Keep each component visible in a clearly segmented clip or clip set.", "Use activity-specific saved references for every selected object or destination.", "Capture audio where cue timing matters.", "Keep maximum combined duration to 60 seconds."],
    cameraAngle: "SEGMENTED_HELPFUL_SKILLS_ROUTINE",
    setupInstructions: ["Clearly segmented single clip or short clip set is required.", "Activity-specific object references must be visible for selected routine components.", "Use component-appropriate FPS and audio where cue timing matters.", "Maximum combined duration is 60 seconds."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["Selected mat components require TARGET_MAT.", "Selected crate components require TARGET_CRATE.", "Selected toy components require TARGET_TOY.", "Selected basket components require TARGET_BASKET.", "Selected button components require TARGET_BUTTON.", "Selected bell or doorway components require TARGET_BELL and TARGET_DOORWAY.", "Selected custom object or leash components require CUSTOM_OBJECT when registered.", "If any selected component reference is missing or unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 60,
    passCriteria: ["Dog matches DOG_PROFILE.", "Every required visible component passes.", "All registered object references match.", "Dog identity remains clear.", "No unsafe handling occurs.", "No forced object placement occurs."],
    failCriteria: ["Any required component clearly fails.", "Wrong object is used.", "Wrong destination is reached.", "Forced placement occurs.", "Unsafe object handling occurs."],
    needsReviewCriteria: ["Required component missing.", "Object identity unclear.", "Route cropped.", "Audio unclear when required.", "Sequence too ambiguous."],
    outOfScopeClaims: ["Do not claim service-dog ability.", "Do not claim medical assistance ability.", "Do not claim generalized household reliability."],
    safetyNotes: ["Use only safe household objects.", "Keep routes clear.", "Stop if the sequence becomes confusing or unsafe."],
    prerequisiteActivityIds: ["HH042", "HH045", "HH049"],
    nextActivityId: null,
    orderedVisibleActions: ["Target dog and selected routine component references are visible in a clearly segmented clip or clip set.", "Dog completes one mat or crate send.", "Dog completes one object retrieve and one object carry.", "Dog releases into basket or near owner.", "Dog completes one button, bell, person-delivery, or leash-delivery component without unsafe handling."],
    skillFamily: "Helpful Skills Routine",
    level: 5,
  },
];

export const HH041_HH050: BatchActivity[] = SPECS.map(makeActivity);
