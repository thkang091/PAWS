export type SeedActivity = {
  id: string;
  category: "BETTER_BEHAVIOR_AT_HOME" | "SAFETY_AND_OBEDIENCE" | "BETTER_WALKS" | "COOL_TRICKS_AND_GAMES" | "HELPFUL_SKILLS_AROUND_THE_HOUSE" | "CALM_ALONE_TIME";
  sequenceNumber: number;
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  skillFamily: string;
  questContentType: "AI_VERIFIED_MAIN_QUEST" | "GUIDED_SIDE_QUEST" | "HYBRID_QUEST" | "REFERENCE_SETUP";
  lessonGoal: string;
  whyItMatters: string;
  tutorialSteps: string[];
  visibleCheckpoint: string;
  prerequisites: string[];
  regressionActivityId: string | null;
  harderActivityId: string | null;
  requiredReferenceAssets: string[];
  recordingRequirements: {
    cameraAngle: string;
    fullDogBodyRequired: boolean;
    pawsRequired: boolean;
    hipsRequired: boolean;
    ownerRequiredInFrame: boolean;
    audioRequired: boolean;
    targetObjectRequiredInFrame: boolean;
    destinationRequiredInFrame: boolean;
    setupInstructions: string[];
  };
  startStateCriteria: string[];
  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];
  outOfScopeClaims: string[];
  safetyNotes: string[];
  minimumAutoPassConfidence: number;
  minimumAutoFailConfidence: number;
  verificationStatus: "BETA" | "DRAFT";
  xpReward: number;
  coinReward: number;
  starsAvailable: number;
  vlmPrompt: string;
  recommendedFps: number;
  minClipSeconds: number;
  maxClipSeconds: number;
};

export type CompletedSeedActivity = SeedActivity & {
  orderIndex: number;
  recordingSetup: SeedActivity["recordingRequirements"];
  audioRequired: boolean;
  fps: number;
  prerequisiteActivityId: string | null;
  nextActivityId: string | null;
};

function list(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function orderedVisibleActions(activity: SeedActivity): string[] {
  switch (activity.id) {
    case "BH001":
      return [
        "Target dog is visible near the handler.",
        "One audible marker word or click occurs.",
        "Food reward is visibly delivered promptly to the target dog.",
      ];
    case "BH002":
      return [
        "Target dog starts from a neutral or away-facing orientation.",
        "Owner gives one audible name cue.",
        "Dog visibly orients toward the owner within 2 seconds.",
      ];
    case "BH003":
      return [
        "Dog starts standing before owner attention begins.",
        "Dog transitions into a sit with hips contacting the floor and front paws grounded.",
        "Dog holds the sit briefly.",
        "Owner attention begins only after the sit is established.",
      ];
    case "BH004":
      return [
        "Dog starts in a sit or stand beside the owner.",
        "Dog transitions into a down.",
        "Elbows and torso lower to the floor.",
        "Down posture holds briefly beside the owner.",
      ];
    case "BH005":
      return [
        "Dog establishes a four-paw standing posture.",
        "All four paws remain grounded.",
        "Standing posture remains stable for at least 3 seconds.",
      ];
    case "BH006":
      return [
        "Dog remains seated before the release cue.",
        "Owner gives one audible release cue.",
        "Dog exits the sit only after the release cue.",
      ];
    case "BH007":
      return [
        "Registered TARGET_MAT is visible and matched to reference photos.",
        "Dog starts outside the mat boundary.",
        "Dog voluntarily moves toward the mat.",
        "At least two paws enter the visible mat boundary.",
      ];
    case "BH008":
      return [
        "Registered TARGET_MAT is visible and matched to reference photos.",
        "Dog is inside the mat boundary.",
        "Dog remains inside the mat boundary continuously for at least 3 seconds.",
      ];
    case "BH009":
      return [
        "Registered TARGET_MAT is visible and matched to reference photos.",
        "Dog is inside the mat boundary.",
        "Dog remains inside the mat boundary continuously for at least 10 seconds.",
      ];
    case "BH010":
      return [
        "Registered TARGET_MAT is visible and matched to reference photos.",
        "Dog is inside the mat boundary.",
        "Dog remains inside the mat boundary continuously for at least 30 seconds.",
      ];
    default:
      return [];
  }
}

function completePrompt(activity: SeedActivity): string {
  const rr = activity.recordingRequirements;
  return `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

ACTIVITY ID
${activity.id}

ACTIVITY TITLE
${activity.title}

EXPECTED START STATE
${list(activity.startStateCriteria)}

VISIBLE CHECKPOINT
${activity.visibleCheckpoint}

RECORDING SETUP
- Camera angle: ${rr.cameraAngle}
- Full dog body required: ${rr.fullDogBodyRequired ? "YES" : "NO"}
- Paws required: ${rr.pawsRequired ? "YES" : "NO"}
- Hips required: ${rr.hipsRequired ? "YES" : "NO"}
- Owner in frame required: ${rr.ownerRequiredInFrame ? "YES" : "NO"}
- Target object in frame required: ${rr.targetObjectRequiredInFrame ? "YES" : "NO"}
- Destination in frame required: ${rr.destinationRequiredInFrame ? "YES" : "NO"}
${list(rr.setupInstructions)}

REQUIRED REFERENCES
${list(activity.requiredReferenceAssets)}

AUDIO RULE
${rr.audioRequired ? "Audio is required. Missing or unusable audio must return NEEDS_REVIEW." : "Audio is not required. Do not fail solely for missing audio."}

FPS
${activity.recommendedFps}

CLIP-DURATION RANGE
${activity.minClipSeconds}-${activity.maxClipSeconds} seconds

ORDERED VISIBLE ACTIONS
${orderedVisibleActions(activity).map((item, index) => `${index + 1}. ${item}`).join("\n")}

PASS CRITERIA
${list(activity.passCriteria)}

FAIL CRITERIA
${list(activity.failCriteria)}

NEEDS_REVIEW CRITERIA
${list(activity.needsReviewCriteria)}

OUT-OF-SCOPE CLAIMS
${list(activity.outOfScopeClaims)}

SAFETY NOTES
${list(activity.safetyNotes)}

JSON-ONLY RESPONSE INSTRUCTION
Return strict JSON only using verdict PASS, FAIL, or NEEDS_REVIEW. Do not include prose outside JSON. Missing evidence is NEEDS_REVIEW, not FAIL. Never fabricate observations, confidence, reference matches, URLs, or semantic accuracy.

ACTIVITY-SPECIFIC GEMINI VLM PROMPT
${activity.vlmPrompt}`;
}

const RAW_BH001_BH010: SeedActivity[] = [
  {
    id: "BH001",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 1,
    level: 1,
    title: "Marker and Reward Delivery",
    skillFamily: "Marker Conditioning",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog receives a food reward within 2 seconds of an audible marker sound (click or verbal \"Yes\") in at least one documented repetition.",
    whyItMatters:
      "The marker bridges the gap between the dog's correct action and the reward. Without a reliable marker, the dog cannot understand which exact moment earned the treat. Every advanced behavior in this curriculum builds on this timing.",
    tutorialSteps: [
      "Hold a treat in your closed fist behind your back or in a pouch — do not show it yet.",
      'Press the clicker or say "Yes" clearly and immediately open your hand or pouch to deliver the treat.',
      "Aim to get the treat to the dog within 1 second of the marker sound.",
      "Repeat 10–15 times per session. The dog does not need to do anything special — simply mark and reward.",
      "Test the conditioning: watch for the dog to look at you or anticipate the treat immediately after the marker sound.",
    ],
    visibleCheckpoint:
      "Audible marker is heard; a food treat reaches the dog's mouth or immediate reach within 2 seconds of the marker.",
    prerequisites: [],
    regressionActivityId: null,
    harderActivityId: "BH002",
    requiredReferenceAssets: ["DOG_PROFILE"],
    recordingRequirements: {
      cameraAngle: "CLOSE_HAND_AND_OBJECT",
      fullDogBodyRequired: false,
      pawsRequired: false,
      hipsRequired: false,
      ownerRequiredInFrame: true,
      audioRequired: true,
      targetObjectRequiredInFrame: false,
      destinationRequiredInFrame: false,
      setupInstructions: [
        "Position the camera so the handler's hand and the dog's head are both visible.",
        "Ensure the audio track can capture the clicker or verbal marker clearly.",
        "Shoot in a quiet indoor space to keep the marker sound clean on the recording.",
      ],
    },
    startStateCriteria: [
      "Dog is present and within treat-delivery range of the handler.",
      "Handler has food rewards loaded and ready before the clip begins.",
    ],
    passCriteria: [
      "An audible marker sound (click or verbal \"Yes\"/\"Good\") is clearly heard on the audio track.",
      "A food treat is visibly delivered to the dog's mouth or placed within the dog's immediate reach within 2 seconds of the marker.",
      "The dog accepts or investigates the treat at its delivery location.",
    ],
    failCriteria: [
      "No audible marker sound is present in the clip.",
      "A marker sound is present but no food reward is delivered within 2 seconds.",
      "Food is delivered without any preceding marker sound.",
      "The treat is offered but the dog does not engage with it and the handler does not re-deliver.",
    ],
    needsReviewCriteria: [
      "The audio track contains a sound that may be a marker but is too distorted to confirm.",
      "The treat appears to be delivered but falls out of frame before the dog can be seen receiving it.",
      "Multiple rapid marker sounds make it impossible to confirm each was paired with a reward.",
    ],
    outOfScopeClaims: [
      "Do not infer whether the marker conditioning has been learned or is working.",
      "Do not assess the dog's engagement, enthusiasm, or emotional state.",
      "Do not evaluate the treat type, value, or training method.",
      "Do not speculate about breed, age, or prior training history.",
    ],
    safetyNotes: [
      "Use small, pea-sized treats to avoid overfeeding during conditioning sessions.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.90,
    verificationStatus: "BETA",
    xpReward: 50,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 20,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH001: Marker and Reward Delivery.

ACTIVITY DEFINITION
This clip verifies a single pairing cycle: an audible marker sound followed by a food reward delivered to the dog within 2 seconds. The dog is not required to perform any specific position or behavior. The only scored elements are (1) the presence of an audible marker and (2) timely food delivery.

SCORABLE VIDEO GATE — evaluate before all else
1. Is at least one dog clearly visible in the frame? If not, set scorable=false and verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If multiple dogs are present and indistinguishable, set targetDogUnambiguous=false.
3. Is an audible marker sound present on the audio track (click or verbal "Yes" / "Good")? If audio is absent or fully inaudible, set audioAvailableWhenRequired=false and verdict=NEEDS_REVIEW.
4. Is the handler's hand and the dog's head simultaneously visible? If not, set framingSufficient=false.
5. Is lighting sufficient to observe the treat transfer? If not, set lightingSufficient=false.
6. Does the clip capture both the marker sound and the treat delivery before it ends? If either is missing because the clip cuts early, set actionCapturedFromStartToFinish=false.

START STATE
The dog may be in any position. The handler should have treats available but not yet visible to the dog. There is no required position for the dog before the marker.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. An audible marker sound is clearly heard on the audio track (click or verbal "Yes"/"Good") at an identifiable timestamp.
2. A food item is visibly delivered to or placed within immediate reach of the dog's mouth within 2 seconds of the audible marker. Delivery to the floor directly under the dog's nose is acceptable.
3. The dog is seen accepting or investigating the treat at its delivery location.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- No audible marker sound is present anywhere in the clip.
- An audible marker is present but no food is delivered within 2 seconds.
- Food is delivered but there is no preceding marker sound.
- The treat is offered but lands out of the dog's reach and the handler does not correct this.

NEEDS REVIEW CRITERIA
- The audio track contains a sound that may be a clicker or verbal marker but is distorted beyond confident identification.
- The treat visibly leaves the handler's hand but leaves the frame before the dog is seen receiving it.
- Multiple rapid marker sounds make one-to-one pairing verification impossible.
- The clip ends immediately after the marker, before delivery timing can be confirmed.

FORBIDDEN INFERENCES — never include these in output
- Do not state or imply that the dog has learned or is learning the marker meaning.
- Do not assess the dog's emotional state, enthusiasm, or engagement level.
- Do not evaluate the training method, treat type, clicker brand, or reward schedule.
- Do not speculate about the dog's breed, age, or prior training history.
- Do not comment on the handler's technique beyond what is directly required by the pass criteria.

JSON OUTPUT INSTRUCTION
Return a structured JSON result matching the DogTrainingVerificationResult schema.
In observedEvents, record: (a) the timestamp of each audible marker sound, (b) the timestamp of each visible treat delivery. Set confidence based on clarity of both the marker sound and the treat delivery timing. Populate satisfiedCriteria and failedCriteria using the exact criterion text from this prompt.`,
  },

  {
    id: "BH002",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 2,
    level: 1,
    title: "Name Response Indoors",
    skillFamily: "Attention and Recall Foundation",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog visibly turns its head or body toward the handler within 2 seconds of one audible name cue, starting from a neutral orientation.",
    whyItMatters:
      "A reliable name response is the master key to every safety and obedience behavior. If your dog reliably looks at you when called, every other recall and attention behavior becomes dramatically easier to build.",
    tutorialSteps: [
      "Wait until your dog is looking away or sniffing the environment — do not call when they are already watching you.",
      "Say your dog's name once, clearly, in a neutral tone.",
      "The instant your dog turns to look at you, immediately mark (click or \"Yes\") and deliver a treat.",
      "If your dog does not respond within 2 seconds, move closer and try again. Never repeat the name — it teaches the dog to ignore it.",
      "Build to 10 reliable responses per session before progressing to BH003.",
    ],
    visibleCheckpoint:
      "Dog's head or body visibly rotates toward the handler within 2 seconds of a single audible name cue, starting from a neutral or away-facing orientation.",
    prerequisites: ["BH001"],
    regressionActivityId: "BH001",
    harderActivityId: "BH003",
    requiredReferenceAssets: ["DOG_PROFILE"],
    recordingRequirements: {
      cameraAngle: "SIDE_FULL_BODY",
      fullDogBodyRequired: true,
      pawsRequired: false,
      hipsRequired: false,
      ownerRequiredInFrame: true,
      audioRequired: true,
      targetObjectRequiredInFrame: false,
      destinationRequiredInFrame: false,
      setupInstructions: [
        "Film from the side so the dog's initial orientation direction and subsequent head turn are both visible.",
        "Ensure audio captures the spoken name cue clearly.",
        "Start recording before calling the dog's name so the clip captures the neutral start state.",
      ],
    },
    startStateCriteria: [
      "Dog is facing away from or at an angle to the handler — not already making eye contact.",
      "Dog is not in the middle of another behavior that would naturally cause it to look at the handler.",
    ],
    passCriteria: [
      "Handler delivers the dog's name as a single, clearly audible verbal cue.",
      "Dog's head or body visibly rotates toward the handler's direction within 2 seconds of the name cue.",
      "The name cue was delivered only once before the orientation response occurred.",
      "Dog's gaze or body axis is directed toward the handler and not toward an environmental distraction.",
    ],
    failCriteria: [
      "Dog does not orient toward the handler within 2 seconds of the single name cue.",
      "Handler repeated the name more than once; dog only oriented after the second or later repetition.",
      "Dog's head turns but orients toward a different person, object, or sound, not the handler.",
      "Dog was already looking at the handler before the name cue was delivered.",
    ],
    needsReviewCriteria: [
      "Dog was partially facing the handler before the cue, making it unclear whether the turn constitutes a response.",
      "The audio cue is present but too quiet or distorted to confirm it was delivered only once before orientation.",
      "The dog's head movement is minimal (under 30 degrees) and it is ambiguous whether it constitutes an orientation response.",
      "The clip cuts within 2 seconds of the name cue before a clear response or non-response is established.",
    ],
    outOfScopeClaims: [
      "Do not infer whether the dog recognizes its name, understands the cue, or has generalized attention.",
      "Do not evaluate the dog's emotional state, engagement level, or desire to interact.",
      "Do not comment on the treat, lure, or reward used after the response.",
      "Do not assess the handler's vocal tone, volume, or training style.",
      "Do not speculate about breed predispositions or hearing ability.",
    ],
    safetyNotes: [
      "Never call the dog's name for anything negative — bath, nail trim, or scolding — as this poisons the response.",
    ],
    minimumAutoPassConfidence: 0.78,
    minimumAutoFailConfidence: 0.88,
    verificationStatus: "BETA",
    xpReward: 50,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH002: Name Response Indoors.

ACTIVITY DEFINITION
The dog must visibly orient toward the handler — turning its head or rotating its body in the handler's direction — within 2 seconds of a single audible name cue. The dog does not need to approach the handler; directional head or body orientation is the scored behavior.

SCORABLE VIDEO GATE — evaluate before all else
1. Is at least one dog clearly visible in frame? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the dog's head and neck visible? If the dog's head is outside the frame, set fullDogBodyVisibleWhenRequired=false; orientation cannot be assessed.
4. Is the handler's verbal name cue audible? audioRequired=true for this activity. If audio is absent or fully inaudible, set audioAvailableWhenRequired=false, verdict=NEEDS_REVIEW.
5. Does the clip start before the name cue is delivered and end at least 2 seconds after? If either boundary is missing, set actionCapturedFromStartToFinish=false.

START STATE
Before the name cue, the dog should be in a neutral position — not already looking at the handler. If the dog is making sustained eye contact with the handler before the cue, the start state is invalid. Note this in the result; the verdict should be NEEDS_REVIEW if a valid neutral start cannot be confirmed.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. A single audible name cue is delivered by the handler at an identifiable timestamp.
2. The dog's head or body visibly rotates toward the handler's direction within 2 seconds of that cue.
3. The name cue was given only once before the orientation response occurred.
4. The dog's resulting gaze or body axis is directed toward the handler and not toward a different target.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog does not orient toward the handler at any point within 2 seconds of the single name cue.
- Handler repeated the name more than once before the dog oriented.
- Dog's head turns but the resulting orientation is toward a different person, object, or sound.
- The dog was already continuously facing the handler before the cue was delivered (invalid start state — fail this attempt).

NEEDS REVIEW CRITERIA
- The dog was partially facing the handler before the cue; it is unclear whether the subsequent head movement is a response or continuation.
- The audio contains a name-like sound but it is too quiet or distorted to confirm it was a single delivery.
- The dog's head movement is less than approximately 30 degrees and whether it constitutes orientation is genuinely ambiguous.
- The clip cuts within 2 seconds of the cue before a clear response or clear non-response is established.

FORBIDDEN INFERENCES — never include these in output
- Do not infer whether the dog "recognizes" or "understands" its name or has generalized attention.
- Do not evaluate the dog's emotional state, engagement level, or training motivation.
- Do not assess the treat, lure, or reward used after the response.
- Do not comment on the handler's vocal tone or style.
- Do not speculate about breed predispositions or hearing characteristics.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In observedEvents, record: (a) timestamp of name cue, (b) timestamp of observed orientation or the 2-second timeout. In satisfiedCriteria and failedCriteria, use the exact criterion text from this prompt. Set confidence based on the clarity of the head or body turn and its timing relative to the single name cue.`,
  },

  {
    id: "BH003",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 3,
    level: 1,
    title: "Sit Before Receiving Attention",
    skillFamily: "Impulse Control and Polite Greetings",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog transitions into a sit and holds it before the handler delivers any visible petting, leaning, or verbal praise directed at the dog.",
    whyItMatters:
      "Teaching the dog to sit before receiving attention replaces jumping, pawing, and nudging with a calm, incompatible behavior. Every family member who practices this consistently builds a dog that defaults to polite greetings instead of demanding ones.",
    tutorialSteps: [
      "Stand in front of your dog with your arms at your sides. Do not give any verbal cue yet.",
      "If your dog sits spontaneously, immediately mark and deliver a calm reward.",
      "If your dog jumps or paws, turn your back silently and wait. When all four paws return to the floor, turn back.",
      "Once your dog is reliably offering a sit to get your attention, add the sit cue one second before you expect the behavior.",
      "Build to a clear sit before every petting session, meal delivery, and door approach.",
    ],
    visibleCheckpoint:
      "Dog's rear contacts the floor in a sit position before the handler's hand makes contact with the dog or the handler leans toward the dog.",
    prerequisites: ["BH002"],
    regressionActivityId: "BH002",
    harderActivityId: "BH004",
    requiredReferenceAssets: ["DOG_PROFILE"],
    recordingRequirements: {
      cameraAngle: "SIDE_FULL_BODY",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: true,
      ownerRequiredInFrame: true,
      audioRequired: false,
      targetObjectRequiredInFrame: false,
      destinationRequiredInFrame: false,
      setupInstructions: [
        "Film from the side so the dog's hip contact with the floor and the handler's hand position are simultaneously visible.",
        "Ensure the full dog body and the handler's torso are both in frame.",
        "Start the clip before the dog begins its sit so the transition from standing or moving to sitting is captured.",
      ],
    },
    startStateCriteria: [
      "Dog is standing or approaching the handler — not already in a sit.",
      "Handler is standing upright with arms at sides or neutral position — not already petting.",
    ],
    passCriteria: [
      "Dog's rear visibly contacts the floor, establishing a sit position with both haunches down and front legs straight.",
      "The sit position is established before any visible handler attention: before the handler's hand contacts the dog, and before the handler leans noticeably toward the dog.",
      "Dog maintains the sit while the handler delivers calm attention (petting or verbal praise).",
    ],
    failCriteria: [
      "Handler begins petting or leaning toward the dog before the dog's rear contacts the floor.",
      "Dog stands up, jumps, or paws at the handler during the attention delivery.",
      "Dog transitions into a down rather than a sit before receiving attention.",
      "The dog is placed into a sit by physical manipulation rather than sitting voluntarily or on cue.",
    ],
    needsReviewCriteria: [
      "Camera angle is from directly above, making it unclear whether the dog's rear contacts the floor.",
      "The handler's hand and the dog's sit transition happen within the same half-second, making sequencing ambiguous.",
      "The dog's haunches are partially lowered but it is unclear whether full sit floor contact was achieved.",
    ],
    outOfScopeClaims: [
      "Do not evaluate whether the dog's sit is straight or square.",
      "Do not claim jumping is solved.",
      "Do not comment on the duration of the sit hold — duration is not a criterion in this activity.",
      "Do not assess the handler's petting technique or emotional expression.",
      "Do not infer the dog's emotional state, desire for attention, or training history.",
    ],
    safetyNotes: [
      "Do not physically push the dog into a sit — this can cause anxiety around handling and undermine polite greeting behavior.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.88,
    verificationStatus: "BETA",
    xpReward: 60,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 20,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH003: Sit Before Receiving Attention.

ACTIVITY DEFINITION
The dog must transition into a sit position — rear on the floor, front legs straight — and the sit must be established before the handler delivers any visible attention (petting, leaning, or directed verbal praise). The sequence must be: dog sits → handler delivers attention. Reversed order fails.

SCORABLE VIDEO GATE — evaluate before all else
1. Is at least one dog clearly visible in frame? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the full dog body visible from head to tail base, including hip and floor contact? This is required to assess sit completion. Set fullDogBodyVisibleWhenRequired and hipsVisibleWhenRequired accordingly.
4. Is the handler's hand and upper torso in frame? ownerVisibleWhenRequired=true; if the handler is outside frame, it is impossible to confirm that attention was withheld before the sit.
5. Does the clip capture the moment before the sit begins through the moment attention is delivered? If either endpoint is missing, set actionCapturedFromStartToFinish=false.

START STATE
The dog should be standing or approaching — not already in a sit. The handler should be standing upright with no hand contact on the dog. If the dog is already sitting when the clip begins, set actionCapturedFromStartToFinish=false; the transition cannot be assessed.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The dog's rear clearly contacts the floor in a sit: both haunches lowered and weight shifted back, front legs straight and not folded.
2. The sit is fully established — rear on floor — before any visible handler attention begins. "Attention begins" means: the handler's hand makes contact with the dog, OR the handler's torso noticeably leans toward the dog, OR the handler delivers audible verbal praise directed at the dog while leaning in.
3. The dog maintains the sit position while the handler delivers at least one visible form of attention.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- The handler begins petting or leaning toward the dog before the dog's rear contacts the floor.
- The dog jumps on the handler or paws at the handler during the sequence.
- The dog transitions directly to a down rather than to a sit.
- The handler physically manipulates the dog into a sit.

NEEDS REVIEW CRITERIA
- The camera angle is overhead or from behind, making floor contact of the dog's rear ambiguous.
- The sit transition and the handler's hand movement toward the dog occur within the same half-second window, making the sequence order ambiguous.
- The dog's haunches are partially lowered but full sit floor contact is unclear.

FORBIDDEN INFERENCES — never include these in output
- Do not evaluate the quality, straightness, or squareness of the sit.
- Do not claim jumping is solved.
- Do not comment on the sit duration; duration is not a criterion here.
- Do not assess the handler's petting style, tone, or emotional expression.
- Do not infer the dog's emotional state, desire for attention, or training background.
- Do not evaluate whether the sit was cued or volunteered.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In observedEvents, record: (a) timestamp of sit initiation, (b) timestamp of sit completion (rear on floor), (c) timestamp of first visible handler attention. Sequence these to verify criterion 2. Use exact criterion text from this prompt in satisfiedCriteria and failedCriteria.`,
  },

  {
    id: "BH004",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 4,
    level: 1,
    title: "Down Beside Owner",
    skillFamily: "Calm Settle Positions",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog transitions into a down (sphinx or lateral) with elbows and hip bones visibly on the floor, positioned beside the standing or seated handler.",
    whyItMatters:
      "A down beside the owner is the foundation of all calm-settle behaviors. A dog that can lie down next to you is a dog that can join you at a café, sit through a TV evening, and stay calm while you work. This position is harder to maintain under excitement than a sit, making it more powerful for building genuine calm.",
    tutorialSteps: [
      "Ask for a sit. Hold a treat at the dog's nose and slowly move it straight down to the floor between the dog's paws.",
      "As the elbows touch the floor, mark and reward immediately. Do not wait for the full sphinx position at first.",
      "Build to the full sphinx: elbows on floor, chest down, hips on floor or rolled to one side.",
      "Once the dog is reliably downing, add the \"Down\" verbal cue just before the lure.",
      "Practice beside you while seated — on the sofa level, on a chair, or on the floor — so the dog learns to settle at your side.",
    ],
    visibleCheckpoint:
      "Dog's elbows and hip bones are both on the floor simultaneously; dog is positioned within 1 metre of the handler who is seated or standing.",
    prerequisites: ["BH003"],
    regressionActivityId: "BH003",
    harderActivityId: "BH005",
    requiredReferenceAssets: ["DOG_PROFILE"],
    recordingRequirements: {
      cameraAngle: "SIDE_FULL_BODY",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: true,
      ownerRequiredInFrame: true,
      audioRequired: false,
      targetObjectRequiredInFrame: false,
      destinationRequiredInFrame: false,
      setupInstructions: [
        "Film from the side so both the dog's elbows and hips are visible contacting the floor.",
        "Ensure both the handler and the dog fit in frame simultaneously.",
        "Capture the full transition from standing or sitting to the final down position.",
      ],
    },
    startStateCriteria: [
      "Dog is standing or sitting — not already in a down position.",
      "Handler is visible and positioned beside or slightly in front of the dog.",
    ],
    passCriteria: [
      "Dog's elbows are visibly on the floor — chest at or near floor level in sphinx or lateral down.",
      "Dog's hip bones are also on the floor or rolled to one side — the dog is not balanced on haunches alone.",
      "Dog is positioned within approximately 1 metre of the handler (adjacent or beside, not across the room).",
    ],
    failCriteria: [
      "Dog's elbows are on the floor but hips are raised — this is a play bow, not a down.",
      "Dog is in a sit rather than a down.",
      "Dog is lying down but is more than 2 metres from the handler.",
      "Handler physically pushes the dog's shoulders to the floor rather than the dog moving voluntarily or on cue.",
    ],
    needsReviewCriteria: [
      "Camera angle from behind the dog makes it impossible to confirm elbow contact with the floor.",
      "The dog begins to go down but the clip ends before elbows and hips simultaneously contact the floor.",
      "The dog's body is partially obscured, making elbow and hip contact ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not comment on whether the down is a sphinx versus lateral position — both are acceptable.",
      "Do not infer emotional calmness.",
      "Do not evaluate the duration of the hold — duration is not a criterion in this activity.",
      "Do not assess the handler's body language, lure technique, or reward method.",
      "Do not infer the dog's emotional state or comfort level on the floor.",
      "Do not evaluate breed-specific body proportions.",
    ],
    safetyNotes: [
      "Do not force a down by pulling the dog's front legs forward — this can cause joint stress and fear of handling.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.88,
    verificationStatus: "BETA",
    xpReward: 60,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 20,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH004: Down Beside Owner.

ACTIVITY DEFINITION
The dog must transition into a down position — both elbows on the floor AND hip bones on the floor simultaneously — while positioned beside the visible handler (within approximately 1 metre). Either sphinx (front paws forward, sternal) or lateral (rolled to one side) down is acceptable.

SCORABLE VIDEO GATE — evaluate before all else
1. Is at least one dog clearly visible in frame? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the full dog body visible from head to tail, including elbows, chest, and hips? fullDogBodyVisibleWhenRequired=true; without elbow and hip visibility, floor contact cannot be confirmed. Set hipsVisibleWhenRequired and pawsVisibleWhenRequired accordingly.
4. Is the handler visible in frame? ownerVisibleWhenRequired=true; proximity cannot be assessed without the handler.
5. Does the clip capture the full transition from the starting position to the completed down? If either endpoint is missing, set actionCapturedFromStartToFinish=false.

START STATE
The dog should be standing or sitting before the down cue or lure. If the dog is already lying down when the clip begins, set actionCapturedFromStartToFinish=false.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The dog's elbows are visibly on the floor — the chest is at or near floor level (sphinx) or the dog is rolled onto its side (lateral).
2. The dog's hip bones are also on the floor or rolled to one side. The dog must not be balanced on raised haunches. A play bow (elbows down, hindquarters up) does not qualify.
3. The dog is within approximately 1 metre of the handler, positioned beside or adjacent to them, not across the room.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog's elbows are on the floor but hips remain raised (play bow posture).
- Dog achieves a sit position only, not a down.
- Dog is lying down but is positioned more than approximately 2 metres from the handler.
- Handler physically pushes the dog's front end to the floor.

NEEDS REVIEW CRITERIA
- The camera angle is behind the dog, making elbow and hip floor contact ambiguous.
- The dog begins the down transition but the clip ends before elbows and hips are simultaneously on the floor.
- Partial body obstruction by furniture or handler makes complete floor contact assessment impossible.

FORBIDDEN INFERENCES — never include these in output
- Do not differentiate sphinx from lateral down — both are passing positions.
- Do not infer emotional calmness.
- Do not comment on hold duration; it is not a criterion in this activity.
- Do not assess the handler's technique, lure, or verbal cue quality.
- Do not infer the dog's emotional state or comfort level.
- Do not comment on breed-specific flexibility or body proportions.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In observedEvents, record: (a) timestamp of down cue or lure initiation, (b) timestamp of elbow contact with floor, (c) timestamp of hip contact with floor (these may be simultaneous). Set confidence based on how clearly elbow and hip floor contact are confirmed and how clearly handler proximity is visible.`,
  },

  {
    id: "BH005",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 5,
    level: 1,
    title: "Stand Calmly for 3 Seconds",
    skillFamily: "Cooperative Care Foundation",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog stands on all four paws without sitting, lying down, or shuffling for a continuous 3-second window after the handler's cue or hand signal.",
    whyItMatters:
      "The stand is required for grooming, vet examinations, drying off after walks, and measuring height. Dogs that fidget or immediately sit during handling are harder to care for safely. A solid stand saves time and reduces stress for both dog and handler at every wellness visit.",
    tutorialSteps: [
      "Ask for a sit. Hold a treat at the dog's nose and move it slowly forward and level — the dog's weight will shift to its front paws as it stands to follow the treat.",
      "The instant all four paws are on the floor and the dog is upright, mark and reward.",
      "Do not move the treat too fast or the dog will take steps forward. Hold it level with the dog's nose, just out of reach.",
      "Add the verbal cue \"Stand\" just before the lure movement once the dog is reliably rising from a sit.",
      "Build to a stationary 3-second stand by counting silently before marking and rewarding.",
    ],
    visibleCheckpoint:
      "All four paws are on the floor simultaneously, dog is upright (not sitting, not lying down), and dog does not shuffle or reposition for 3 continuous seconds.",
    prerequisites: ["BH004"],
    regressionActivityId: "BH004",
    harderActivityId: "BH006",
    requiredReferenceAssets: ["DOG_PROFILE"],
    recordingRequirements: {
      cameraAngle: "SIDE_FULL_BODY",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: true,
      ownerRequiredInFrame: false,
      audioRequired: false,
      targetObjectRequiredInFrame: false,
      destinationRequiredInFrame: false,
      setupInstructions: [
        "Film from the side so all four paws and the dog's hip and shoulder height are visible.",
        "The handler may be partially out of frame as long as the full dog body is captured.",
        "Record at least 10 seconds so the 3-second hold window is unambiguously captured.",
      ],
    },
    startStateCriteria: [
      "Dog is in a sit or moving — not already in a 4-paw stand before the cue.",
      "If starting from a sit, the dog should visibly transition from sit to stand within the clip.",
    ],
    passCriteria: [
      "All four paws are visibly on the floor simultaneously — dog is fully upright.",
      "Dog's hindquarters are not lowered into a sit and the dog is not lying down.",
      "Dog does not take any steps or shuffle during a continuous 3-second window.",
    ],
    failCriteria: [
      "Dog sits down before the 3-second hold is complete.",
      "Dog lies down before the 3-second hold is complete.",
      "Dog takes steps forward, backward, or sideways during the 3-second window, breaking the stationary requirement.",
      "Only 2 or fewer paws are on the floor at any point during the intended hold.",
    ],
    needsReviewCriteria: [
      "The clip is shorter than 3 seconds after the stand is established, making hold confirmation impossible.",
      "One rear paw briefly lifts (weight shifting) but it is unclear whether this breaks the stationary hold criterion.",
      "Camera angle is directly in front of the dog, making it impossible to confirm whether the dog's hips are up or settling into a sit.",
    ],
    outOfScopeClaims: [
      "Do not evaluate whether the stand is 'square' or conformation-quality.",
      "Do not infer physical fitness.",
      "Do not assess the dog's body condition, coat, or physical build.",
      "Do not comment on the handler's lure technique or treat placement.",
      "Do not infer the dog's mood or enthusiasm during the stand.",
    ],
    safetyNotes: [
      "Do not hold the treat so high that the dog raises its front paws off the ground — this becomes a beg, not a stand.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.90,
    verificationStatus: "BETA",
    xpReward: 60,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 2,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH005: Stand Calmly for 3 Seconds.

ACTIVITY DEFINITION
The dog must stand on all four paws simultaneously — upright, not sitting, not lying — and hold that stationary position without shuffling or repositioning for a continuous 3-second window. A single clip may show one or more stand attempts.

SCORABLE VIDEO GATE — evaluate before all else
1. Is at least one dog clearly visible in frame? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the full dog body visible from head to tail, including all four paws and the hip region? All four paws must be visible to confirm ground contact. Set fullDogBodyVisibleWhenRequired and pawsVisibleWhenRequired accordingly.
4. Is the clip at least 8 seconds long and does it capture the full 3-second hold? If the stand is established but the clip ends before 3 seconds elapse, set actionCapturedFromStartToFinish=false.
5. Is lighting sufficient to distinguish each paw's contact with the floor? If not, set lightingSufficient=false.

START STATE
The dog should transition from a sit or moving state into the stand within the clip. If the dog was already standing in a stationary 4-paw position when the clip began, note this; the 3-second timer should still be measurable if a later point of clear stand establishment is visible.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. All four paws are visibly on the floor simultaneously — the dog is upright with weight distributed across all four limbs.
2. The dog's hindquarters are not lowered into a sit and the dog is not in a down or bow.
3. The dog remains stationary — no shuffling, stepping, or weight shifting that moves a paw off the floor — for a continuous 3-second window.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog sits down before 3 seconds of stationary standing are completed.
- Dog lies down before 3 seconds are completed.
- Dog takes one or more steps during the 3-second window, breaking the stationary requirement.
- Fewer than four paws are on the floor at any point during the intended hold window.

NEEDS REVIEW CRITERIA
- The clip ends immediately after the stand is established; the 3-second timer cannot be confirmed.
- A rear paw briefly lifts (weight shift, scratch, or fidget) during the hold window; it is ambiguous whether this constitutes "shuffling."
- The camera angle is directly in front, making it impossible to confirm whether the dog's hips are up or descending into a sit.

FORBIDDEN INFERENCES — never include these in output
- Do not evaluate the conformation quality or squareness of the stand.
- Do not infer physical fitness.
- Do not comment on the dog's physical build, coat, or condition.
- Do not assess the handler's technique or the lure movement.
- Do not infer the dog's mood or energy level.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In observedEvents, record: (a) timestamp when all four paws first contact the floor in the stand, (b) the 3-second timer start, (c) the 3-second timer end or any break event. Set confidence based on how clearly all four paws and the 3-second hold window are visible.`,
  },

  {
    id: "BH006",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 6,
    level: 2,
    title: "Release Cue from Sit",
    skillFamily: "Impulse Control and Duration",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog holds a sit position until an audible release cue is delivered, then moves freely — demonstrating that the dog understands stays end by cue, not by the dog's own decision.",
    whyItMatters:
      "A release cue teaches the dog that behaviors end on your signal, not theirs. Without a release, the dog decides when a stay is over — which becomes dangerous at doors, curbs, and driveways. A clear release cue is the foundation of every duration and distance behavior.",
    tutorialSteps: [
      "Ask your dog to sit. Mark and reward the sit immediately (one treat) to confirm the position.",
      "Wait 2 seconds while the dog remains in the sit, then say your release word (\"Free\", \"Okay\", or \"Release\") and toss a treat on the floor to encourage movement.",
      "If the dog gets up before the release, calmly re-cue the sit without scolding. Shorten your wait time and build back up.",
      "Gradually increase the sit duration before the release: 2 seconds → 5 seconds → 10 seconds.",
      "Vary the wait time so the dog cannot predict exactly when the release is coming.",
    ],
    visibleCheckpoint:
      "Dog remains in sit position until the handler delivers an audible release cue, then moves freely from the sit.",
    prerequisites: ["BH005"],
    regressionActivityId: "BH005",
    harderActivityId: "BH007",
    requiredReferenceAssets: ["DOG_PROFILE"],
    recordingRequirements: {
      cameraAngle: "SIDE_FULL_BODY",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: true,
      ownerRequiredInFrame: true,
      audioRequired: true,
      targetObjectRequiredInFrame: false,
      destinationRequiredInFrame: false,
      setupInstructions: [
        "Film from the side so the dog's hip contact with the floor during the sit and the subsequent movement after the release cue are both visible.",
        "Ensure audio clearly captures the release cue word.",
        "Record at least 10 seconds to capture the hold period and the movement after the release.",
      ],
    },
    startStateCriteria: [
      "Dog is in a sit position with rear on floor before the timing portion of the clip begins.",
      "Handler has already cued the sit before the relevant portion starts.",
    ],
    passCriteria: [
      "Dog's rear remains on the floor during the entire hold period preceding the release cue.",
      "An audible release cue is clearly delivered by the handler at an identifiable timestamp.",
      "Dog visibly moves — stands, steps forward, or shifts weight — only after the release cue is delivered, not before.",
    ],
    failCriteria: [
      "Dog stands up or moves before the release cue is delivered.",
      "Dog remains seated and does not move after a clearly audible release cue is delivered.",
      "Dog breaks the sit and the handler does not re-cue — the behavior is abandoned.",
      "Dog moves sideways or lies down before the release cue.",
    ],
    needsReviewCriteria: [
      "The audio contains a sound that may be the release cue but is too quiet or distorted to confirm.",
      "The dog makes a small weight shift before the release cue; it is ambiguous whether this constitutes breaking the sit.",
      "The clip has no audible release cue or the audio track is missing entirely.",
      "The clip cuts immediately after the release cue before the dog's movement response is visible.",
    ],
    outOfScopeClaims: [
      "Do not evaluate the duration of the sit hold — any hold duration before the release is acceptable for this activity.",
      "Do not infer generalized impulse control.",
      "Do not assess the quality or speed of the dog's movement after the release.",
      "Do not comment on whether the dog's sit is straight or square during the hold.",
      "Do not infer the dog's enthusiasm or readiness to move after the release.",
    ],
    safetyNotes: [
      "Never use \"Okay\" as a release word if you use it in everyday conversation — the dog will break stays constantly.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.88,
    verificationStatus: "BETA",
    xpReward: 75,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 25,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH006: Release Cue from Sit.

ACTIVITY DEFINITION
The dog must maintain a sit position — rear on floor — during a hold period, then visibly move only after the handler delivers an audible release cue. The key scored sequence is: (1) dog sits and holds, (2) handler delivers audible release cue, (3) dog moves freely after and not before the cue. audioRequired=true because the release cue must be audible to score the sequence.

SCORABLE VIDEO GATE — evaluate before all else
1. Is at least one dog clearly visible in frame? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the dog's full body visible, including hips and rear? hipsVisibleWhenRequired=true; the sit hold cannot be confirmed without hip visibility.
4. Is the handler visible in frame? ownerVisibleWhenRequired=true.
5. Is the release cue audible on the audio track? audioAvailableWhenRequired=true; if audio is absent or fully inaudible, set audioAvailableWhenRequired=false, verdict=NEEDS_REVIEW.
6. Does the clip capture the sit hold period and the dog's movement after the release? If either is missing, set actionCapturedFromStartToFinish=false.

START STATE
The dog should already be in a sit when the relevant hold period begins. The clip must capture the dog holding the sit for some period before the release cue.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The dog's rear remains visibly on the floor (sit maintained) throughout the hold period before the release cue.
2. An audible release cue is delivered by the handler at an identifiable timestamp.
3. The dog visibly moves — stands up, steps forward, or lifts its rear from the floor — only after the release cue. Any movement before the cue fails this criterion.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog's rear leaves the floor (stand, step, or down) before the release cue is delivered.
- Dog remains seated and does not move after a clearly audible release cue is delivered.
- Dog breaks the sit and the clip ends without a release cue or re-cue.
- Dog shifts into a down position before the release cue.

NEEDS REVIEW CRITERIA
- The audio contains a sound that may be the release cue but volume or clarity is insufficient to confirm it.
- The clip has no audible release cue or the audio track is missing entirely.
- The dog makes a subtle weight shift before the release cue; it is genuinely ambiguous whether the rear left the floor.
- The clip ends immediately after the release cue before the dog's response movement is visible.

FORBIDDEN INFERENCES — never include these in output
- Do not evaluate the duration of the hold — any hold length before the release is acceptable.
- Do not infer generalized impulse control.
- Do not assess movement speed or style after the release.
- Do not comment on sit quality, squareness, or alignment during the hold.
- Do not infer the dog's anticipation level or desire to move.
- Do not assess the specific release word used.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In observedEvents, record: (a) timestamp of sit start, (b) timestamp of release cue delivery, (c) timestamp of dog's first movement after release. The sequencing of events (b) before (c) is the core verification criterion. Set confidence based on how clearly the release cue is audible and how clearly the dog's movement follows it rather than precedes it.`,
  },

  {
    id: "BH007",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 7,
    level: 1,
    title: "Place-Mat Entry",
    skillFamily: "Place and Settle",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog starts outside the registered TARGET_MAT and voluntarily places at least two paws inside the visible mat boundary within 5 seconds of the place cue.",
    whyItMatters:
      "A mat gives your dog a defined, portable calm zone. When your dog understands \"go to your mat,\" you can direct them away from the front door, away from the dinner table, and into a quiet spot in any room or environment. The mat becomes a mobile safe space your dog chooses to go to.",
    tutorialSteps: [
      "Place the mat on the floor near you and let your dog sniff it freely.",
      "Toss a treat onto the mat to draw the dog onto it. The moment at least two paws land inside the mat boundary, mark and reward.",
      "After 5 successful repetitions with tossed treats, point to the mat and say \"Place\" just before tossing.",
      "Gradually fade the toss: point to the mat, say \"Place,\" and wait for the dog to move toward it before rewarding.",
      "Build to a reliable two-paw-or-better entry from 1 metre away on the verbal cue alone.",
    ],
    visibleCheckpoint:
      "At least two paws are inside the visible TARGET_MAT boundary within 5 seconds of the place cue; the mat visible in this clip matches the TARGET_MAT reference photo.",
    prerequisites: ["BH006"],
    regressionActivityId: "BH006",
    harderActivityId: "BH008",
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    recordingRequirements: {
      cameraAngle: "VISIBLE_TARGET_ZONE",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: false,
      ownerRequiredInFrame: false,
      audioRequired: false,
      targetObjectRequiredInFrame: true,
      destinationRequiredInFrame: true,
      setupInstructions: [
        "Position the camera so the entire mat is visible in frame before the dog begins moving.",
        "Ensure the mat fills at least one-third of the frame so all four paws can be confirmed on its surface.",
        "Film from a slightly elevated angle to see all four paws relative to the mat edges.",
      ],
    },
    startStateCriteria: [
      "The TARGET_MAT is flat on the floor and fully visible in frame before the dog steps onto it.",
      "Dog is at least 0.5 metres from the mat before the cue.",
    ],
    passCriteria: [
      "The mat visible in the clip matches the TARGET_MAT reference photo — same color, shape, and texture.",
      "At least two paws are visibly inside the mat boundary within 5 seconds of the place cue.",
      "The dog moves onto the mat without being physically guided or placed there.",
    ],
    failCriteria: [
      "Dog places fewer than two paws inside the mat boundary.",
      "Dog does not reach the mat within 5 seconds of the cue.",
      "Handler physically guides or places the dog onto the mat.",
    ],
    needsReviewCriteria: [
      "The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.",
      "The mat visible in the clip is partially obscured, making it impossible to confirm a match with the TARGET_MAT reference.",
      "One paw appears to be on the mat edge; it is ambiguous whether it is on or off the mat surface.",
      "The dog's paws are partially outside frame, making a two-paw count impossible.",
    ],
    outOfScopeClaims: [
      "Do not evaluate the dog's position on the mat (stand, sit, or down) — only entry is assessed in this activity.",
      "Do not infer relaxation.",
      "Do not comment on the duration of time on the mat — duration is addressed in BH008–BH010.",
      "Do not assess the mat placement in the room or its distance from furniture.",
      "Do not infer the dog's enthusiasm or confidence on the mat.",
    ],
    safetyNotes: [
      "Ensure the mat has a non-slip backing to prevent it from sliding when the dog steps onto it quickly.",
    ],
    minimumAutoPassConfidence: 0.78,
    minimumAutoFailConfidence: 0.88,
    verificationStatus: "BETA",
    xpReward: 60,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 20,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH007: Place-Mat Entry.

ACTIVITY DEFINITION
The dog must start outside the TARGET_MAT — the specific mat photographed in the reference asset — and voluntarily place at least two paws inside the visible mat boundary within 5 seconds of the handler's place cue. The dog must do this without being physically guided. This activity assesses entry only; hold duration is not scored here.

REFERENCE ASSET CHECK — evaluate first
Before scoring behavior, compare the mat visible in this clip against the TARGET_MAT reference photo provided. Check: color match, texture match, shape match, approximate size match. If the mat in the clip clearly does not match the reference photo, set referenceAssetsAvailableWhenRequired=false and referenceObjectMatchedWhenRequired=false, and set verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE — evaluate after reference check
1. Is at least one dog clearly visible in frame? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the entire mat visible in frame before the dog begins moving? targetObjectVisibleWhenRequired=true and destinationVisibleWhenRequired=true. If the mat is only partially visible, it may be impossible to confirm two-paw entry.
4. Are the entering paws visible throughout the entry sequence? pawsVisibleWhenRequired=true. If paws are outside frame, entry cannot be confirmed.
5. Does the clip capture the full entry from start of movement to at least two paws inside the mat boundary? If not, set actionCapturedFromStartToFinish=false.

START STATE
The mat must be flat on the floor and fully in frame before the dog begins moving toward it. The dog should be at least 0.5 metres from the mat.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The mat in the clip matches the TARGET_MAT reference photo in color, texture, and shape.
2. At least two paws are inside the visible mat boundary within 5 seconds of the place cue.
3. The dog reached the mat under its own power — no physical guiding or placement by the handler.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog places fewer than two paws inside the mat boundary.
- Dog does not reach the mat within 5 seconds of the cue.
- Handler physically guides or places the dog onto the mat.

NEEDS REVIEW CRITERIA
- The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.
- The mat is partially out of frame; whether at least two paws are inside the mat boundary cannot be confirmed.
- One paw is on the mat edge and it is ambiguous whether it is on or off the mat surface.
- The dog's paws are cropped so the two-paw threshold cannot be confirmed.
- The mat reference photo is too similar in color to the floor to allow confident matching.

FORBIDDEN INFERENCES — never include these in output
- Do not evaluate the dog's position type on the mat (stand, sit, down) — only paw presence is scored.
- Do not infer relaxation.
- Do not comment on duration of time on the mat; this is assessed in BH008–BH010.
- Do not assess the mat placement in the room or its distance from walls.
- Do not speculate on the dog's confidence or enthusiasm.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In matchedReferenceAssets, include one entry for TARGET_MAT with matched=true/false and your confidence score. In observedEvents, record: (a) timestamp of place cue, (b) timestamp of first paw inside mat boundary, (c) timestamp of at least two paws inside mat boundary. Set overall confidence based on reference match confidence and paw placement clarity.`,
  },

  {
    id: "BH008",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 8,
    level: 2,
    title: "Place Hold: 3 Seconds",
    skillFamily: "Place and Settle",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog enters the TARGET_MAT and holds position — in any body posture with all four paws on the mat — for a continuous 3-second duration before receiving a reward or release.",
    whyItMatters:
      "Duration on the mat is what makes the place command useful in real life. Three seconds is the first duration milestone: long enough to require the dog to hold rather than bounce off immediately, short enough to succeed at high rates and build confidence.",
    tutorialSteps: [
      "Send the dog to the mat with your place cue (BH007 mastered).",
      "Count 1–2–3 silently before marking and rewarding. Do not count out loud.",
      "Reward while the dog is still on the mat — do not call the dog off the mat to get the treat.",
      "If the dog steps off before 3 seconds, calmly re-send without scolding.",
      "After 5 successful 3-second holds, begin adding the release cue (BH006) before calling the dog off.",
    ],
    visibleCheckpoint:
      "All four paws remain on the TARGET_MAT for 3 continuous seconds after the dog's entry; the mat in this clip matches the TARGET_MAT reference photo.",
    prerequisites: ["BH007"],
    regressionActivityId: "BH007",
    harderActivityId: "BH009",
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    recordingRequirements: {
      cameraAngle: "VISIBLE_TARGET_ZONE",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: false,
      ownerRequiredInFrame: false,
      audioRequired: false,
      targetObjectRequiredInFrame: true,
      destinationRequiredInFrame: true,
      setupInstructions: [
        "Position the camera so the entire mat and all four of the dog's paws are visible throughout the hold.",
        "Record at least 10 seconds so the 3-second hold window is unambiguously captured after entry.",
        "Film from slightly above mat level to see all paw positions relative to the mat edges.",
      ],
    },
    startStateCriteria: [
      "The TARGET_MAT is flat on the floor and fully visible before the dog enters.",
      "Dog is approaching the mat — not already on it — at the start of the clip.",
    ],
    passCriteria: [
      "The mat visible in the clip matches the TARGET_MAT reference photo.",
      "All four paws enter the mat zone (completing BH007-level entry).",
      "All four paws remain on the mat surface continuously for 3 seconds — no paw steps off the mat during this window.",
    ],
    failCriteria: [
      "Any paw steps off the mat before 3 continuous seconds of hold are completed.",
      "Dog does not enter the mat fully (fewer than 4 paws on the mat).",
      "Dog enters the mat but immediately exits before 3 seconds elapse.",
    ],
    needsReviewCriteria: [
      "The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.",
      "The mat is partially out of frame; whether all four paws remain on the mat cannot be confirmed.",
      "The clip is shorter than 3 seconds after mat entry, making hold confirmation impossible.",
      "A paw is on the mat edge and it is ambiguous whether it is inside or outside the mat boundary during the hold.",
    ],
    outOfScopeClaims: [
      "Do not evaluate the dog's body position on the mat — stand, sit, or down are all acceptable.",
      "Do not comment on behavior between the entry and the start of the 3-second hold window.",
      "Do not assess handler proximity or verbal cues after entry.",
    ],
    safetyNotes: [
      "Reward on the mat, not off it — rewarding off the mat teaches the dog that leaving the mat earns the reward.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.90,
    verificationStatus: "BETA",
    xpReward: 75,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 2,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH008: Place Hold 3 Seconds.

ACTIVITY DEFINITION
The dog must enter the TARGET_MAT (all four paws on the mat) and then remain on the mat continuously for 3 seconds. Any body position (stand, sit, down) is acceptable as long as all four paws stay within the mat boundary during the 3-second window.

REFERENCE ASSET CHECK — evaluate first
Compare the mat in this clip against the TARGET_MAT reference photo: color, shape, texture. If the mats clearly do not match, set referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Is at least one dog clearly visible? scorable check — if not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the entire mat visible in frame throughout the hold? targetObjectVisibleWhenRequired=true and destinationVisibleWhenRequired=true.
4. Are all four paws visible throughout the entry and hold? pawsVisibleWhenRequired=true. If paws leave frame, the hold cannot be confirmed.
5. Does the clip capture both the mat entry and a 3-second hold window? If not, set actionCapturedFromStartToFinish=false.

START STATE
The mat must be fully in frame and the dog must not yet be on the mat at the start of the clip. If the dog is already on the mat when the clip starts, the entry cannot be verified; the 3-second timer may still be assessable if the start of a clean stationary period is identifiable.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The mat in the clip matches the TARGET_MAT reference photo.
2. All four paws enter the mat zone fully at some point in the clip.
3. All four paws remain within the mat boundary continuously for a 3-second window. Any paw crossing the mat edge during this window resets the timer.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Any paw exits the mat boundary before 3 continuous seconds are completed.
- Dog never achieves a 4-paw entry.
- Dog enters the mat but immediately exits in under 3 seconds.

NEEDS REVIEW CRITERIA
- The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.
- The mat is partially outside frame; paw-edge boundary confirmation is impossible.
- The clip ends less than 3 seconds after mat entry.
- A paw is at the mat edge and whether it is inside or outside is genuinely ambiguous.

FORBIDDEN INFERENCES
- Do not assess body position type on the mat.
- Do not comment on hold behavior beyond the 3-second window.
- Do not evaluate handler behavior after the dog is on the mat.

JSON OUTPUT INSTRUCTION
In observedEvents, record: (a) timestamp of 4-paw mat entry, (b) 3-second timer start, (c) 3-second timer end or any paw-exit event. In matchedReferenceAssets, include one entry for TARGET_MAT. Set confidence based on reference match quality and paw boundary visibility.`,
  },

  {
    id: "BH009",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 9,
    level: 2,
    title: "Place Hold: 10 Seconds",
    skillFamily: "Place and Settle",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog enters the TARGET_MAT and holds position with all four paws on the mat for a continuous 10-second duration.",
    whyItMatters:
      "Ten seconds is long enough to be genuinely useful: the dog can hold the mat while you open the front door, answer a quick question, or set down groceries. This is the first duration milestone where the mat becomes a practical management tool rather than just a trick.",
    tutorialSteps: [
      "Send the dog to the mat and count silently to 10 before marking and rewarding on the mat.",
      "If the dog breaks before 10 seconds, reset calmly. Do not increase the time until 80% of attempts succeed.",
      "Vary the duration: sometimes reward at 5 seconds, sometimes at 10, so the dog cannot predict the exact moment.",
      "Begin stepping one pace away from the mat during the hold to add mild handler-movement distraction.",
      "Practice in multiple locations in the home with the same mat so the cue becomes mat-specific, not location-specific.",
    ],
    visibleCheckpoint:
      "All four paws remain on the TARGET_MAT for 10 continuous seconds; the mat in this clip matches the TARGET_MAT reference photo.",
    prerequisites: ["BH008"],
    regressionActivityId: "BH008",
    harderActivityId: "BH010",
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    recordingRequirements: {
      cameraAngle: "VISIBLE_TARGET_ZONE",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: false,
      ownerRequiredInFrame: false,
      audioRequired: false,
      targetObjectRequiredInFrame: true,
      destinationRequiredInFrame: true,
      setupInstructions: [
        "Position the camera so the entire mat and all four of the dog's paws are visible for the full hold duration.",
        "Record at least 18 seconds to capture both the entry and the 10-second hold.",
        "Recommended: film at 2 FPS to reduce file size while still capturing paw movement clearly.",
      ],
    },
    startStateCriteria: [
      "The TARGET_MAT is flat on the floor and fully visible before the dog enters.",
      "Dog approaches from outside the mat zone.",
    ],
    passCriteria: [
      "The mat visible in the clip matches the TARGET_MAT reference photo.",
      "All four paws enter the mat zone.",
      "All four paws remain on the mat surface continuously for 10 seconds — no paw steps off the mat during this window.",
    ],
    failCriteria: [
      "Any paw exits the mat boundary before 10 continuous seconds are completed.",
      "Dog does not achieve a full 4-paw entry.",
    ],
    needsReviewCriteria: [
      "The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.",
      "The mat is partially out of frame during the hold, preventing paw boundary confirmation.",
      "The clip ends before 10 seconds of uninterrupted hold are captured.",
      "A paw is on the mat edge for multiple seconds and it is ambiguous whether it is inside or outside the boundary.",
    ],
    outOfScopeClaims: [
      "Do not assess the dog's body position on the mat.",
      "Do not evaluate handler movement during the hold.",
      "Do not comment on behavior after the 10-second hold is complete.",
    ],
    safetyNotes: [
      "If the dog breaks repeatedly at the same duration, shorten the target time and rebuild gradually rather than repeating at the failing threshold.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.90,
    verificationStatus: "BETA",
    xpReward: 75,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 2,
    minClipSeconds: 18,
    maxClipSeconds: 40,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH009: Place Hold 10 Seconds.

ACTIVITY DEFINITION
The dog must enter the TARGET_MAT with all four paws and then hold position continuously for 10 seconds. Any body position is acceptable. The 10-second window begins once the 4-paw entry is complete and ends when all four paws have been on the mat for 10 continuous seconds.

REFERENCE ASSET CHECK — evaluate first
Compare the mat in the clip against the TARGET_MAT reference photo. Mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous check.
3. Entire mat visible throughout hold? targetObjectVisibleWhenRequired and destinationVisibleWhenRequired.
4. All four paws visible throughout? pawsVisibleWhenRequired.
5. Does the clip capture entry plus at least 10 seconds of uninterrupted hold? actionCapturedFromStartToFinish.

START STATE
Mat must be fully in frame and dog must approach from outside the mat zone.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The mat in the clip matches the TARGET_MAT reference photo.
2. All four paws achieve a complete mat entry.
3. All four paws remain within the mat boundary for a continuous 10-second window without any paw crossing the mat edge.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Any paw exits the mat boundary before 10 continuous seconds are completed.
- Dog does not achieve 4-paw entry.

NEEDS REVIEW CRITERIA
- The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.
- The mat moves partially out of frame during the hold.
- The clip ends before 10 seconds of clean hold are recorded.
- A paw is borderline on the mat edge for a sustained period; inside vs. outside is ambiguous.

FORBIDDEN INFERENCES
- Do not comment on body position type on the mat.
- Do not evaluate handler behavior during the hold.
- Do not assess whether 10 seconds is within or beyond the dog's current capability.

JSON OUTPUT INSTRUCTION
In observedEvents, record: (a) timestamp of 4-paw entry completion, (b) 10-second timer start, (c) 10-second timer end or first paw-exit event. In matchedReferenceAssets, include TARGET_MAT entry. Set confidence based on paw boundary clarity throughout the hold.`,
  },

  {
    id: "BH010",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 10,
    level: 3,
    title: "Place Hold: 30 Seconds",
    skillFamily: "Place and Settle",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal:
      "Dog enters the TARGET_MAT and holds position with all four paws on the mat for a continuous 30-second duration without handler prompting or repeated cuing.",
    whyItMatters:
      "Thirty seconds opens the door to real-life utility: the dog can hold the mat while a visitor enters, while you put away a delivery, or while you answer the door. It is the first duration where the place command provides genuine household management value rather than practice-only value.",
    tutorialSteps: [
      "Start from your 10-second reliable hold and add 5 seconds every few sessions.",
      "Practice the mat stay while you move naturally around the room — do not freeze in place; the dog must hold regardless of your movement.",
      "Begin introducing mild distractions: dropping a pen, opening a drawer, walking to another room briefly.",
      "If the dog breaks, re-send to the mat calmly and shorten the next duration target by 50%.",
      "When the dog holds reliably for 30 seconds, begin pairing with the release cue (BH006) to mark the end of the hold.",
    ],
    visibleCheckpoint:
      "All four paws remain on the TARGET_MAT for 30 continuous seconds; the mat in this clip matches the TARGET_MAT reference photo.",
    prerequisites: ["BH009"],
    regressionActivityId: "BH009",
    harderActivityId: null,
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    recordingRequirements: {
      cameraAngle: "VISIBLE_TARGET_ZONE",
      fullDogBodyRequired: true,
      pawsRequired: true,
      hipsRequired: false,
      ownerRequiredInFrame: false,
      audioRequired: false,
      targetObjectRequiredInFrame: true,
      destinationRequiredInFrame: true,
      setupInstructions: [
        "Position the camera so the entire mat and all four of the dog's paws are visible for the full 30-second hold.",
        "Record at least 38 seconds to capture both the entry and the full hold.",
        "Film at 1 FPS to manage file size while still capturing any paw-boundary events during the extended hold.",
      ],
    },
    startStateCriteria: [
      "The TARGET_MAT is flat on the floor and fully visible before the dog enters.",
      "Dog approaches from outside the mat zone.",
    ],
    passCriteria: [
      "The mat visible in the clip matches the TARGET_MAT reference photo.",
      "All four paws achieve a full mat entry.",
      "All four paws remain within the mat boundary continuously for 30 seconds — no paw exits during this window.",
    ],
    failCriteria: [
      "Any paw exits the mat boundary before 30 continuous seconds are completed.",
      "Dog does not achieve a 4-paw entry.",
    ],
    needsReviewCriteria: [
      "The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.",
      "The mat moves partially out of frame at any point during the 30-second hold.",
      "The clip ends before 30 seconds of clean hold are recorded.",
      "A paw is on the mat edge for a sustained period; inside vs. outside is ambiguous.",
      "Video compression artifacts or low frame rate make it unclear whether a brief paw lift occurred.",
    ],
    outOfScopeClaims: [
      "Do not assess the dog's body position on the mat.",
      "Do not comment on the dog's posture changes (sitting to lying, etc.) during the hold — all are acceptable.",
      "Do not evaluate the handler's movement during the hold.",
      "Do not infer the dog's calm state or anxiety level from posture.",
    ],
    safetyNotes: [
      "A mat hold should always be a positive experience — never use the mat as a timeout or punishment zone.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.90,
    verificationStatus: "BETA",
    xpReward: 100,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: 1,
    minClipSeconds: 38,
    maxClipSeconds: 75,
    vlmPrompt: `You are evaluating a dog-training video for PAWS activity BH010: Place Hold 30 Seconds.

ACTIVITY DEFINITION
The dog must enter the TARGET_MAT with all four paws and then maintain that position — all four paws continuously within the mat boundary — for 30 uninterrupted seconds. Any body position (stand, sit, down, or posture change during the hold) is acceptable. The 30-second timer begins when 4-paw entry is complete.

REFERENCE ASSET CHECK — evaluate first
Compare the mat in the clip against the TARGET_MAT reference photo: color, shape, texture. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Is at least one dog clearly visible? If not: scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous: targetDogUnambiguous=false.
3. Is the entire mat visible in frame for the duration of the hold? targetObjectVisibleWhenRequired=true and destinationVisibleWhenRequired=true. If the mat drifts out of frame at any point, the hold cannot be confirmed for that period.
4. Are all four paws visible throughout the hold? pawsVisibleWhenRequired=true. Low frame rate (1 FPS) is expected and acceptable; flag if paw-boundary events may have occurred between frames.
5. Does the clip capture the full 30-second hold after entry? actionCapturedFromStartToFinish=true only if a continuous 30-second window is documented.

START STATE
Mat fully in frame, dog outside mat zone before entry.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The mat in the clip matches the TARGET_MAT reference photo.
2. All four paws achieve a full mat entry.
3. All four paws remain within the mat boundary for a continuous 30-second window. Any paw crossing the mat edge resets the timer and requires a new 30-second window from that reset point.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Any paw exits the mat boundary before 30 continuous seconds are completed.
- Dog never achieves a 4-paw entry.

NEEDS REVIEW CRITERIA
- The mat visible in the clip is missing, does not match, or cannot be confidently matched to the TARGET_MAT reference photo.
- The mat moves partially out of frame at any point during the hold, creating a gap in paw-boundary visibility.
- The clip ends before 30 seconds of uninterrupted hold are recorded.
- A paw is at the mat edge for multiple frames at 1 FPS; inside vs. outside cannot be determined with confidence.
- Compression artifacts or motion blur at low frame rate make a brief paw-lift event ambiguous.

FORBIDDEN INFERENCES — never include these in output
- Do not comment on body position or posture type during the hold.
- Do not evaluate the handler's behavior, movement, or proximity during the hold.
- Do not infer the dog's emotional state, stress level, or comfort from posture.
- Do not assess breed-specific physical comfort on the mat surface.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In observedEvents, record: (a) timestamp of 4-paw mat entry, (b) 30-second timer start, (c) 30-second timer completion or first paw-exit event. At 1 FPS, timestamps will have ±1 second precision — note this in the notes field rather than marking as uncertain. In matchedReferenceAssets, include TARGET_MAT with your reference-match confidence. Set overall confidence based on reference match quality, paw boundary visibility over 30 seconds, and frame rate.`,
  },
];

export const BH001_BH010: CompletedSeedActivity[] = RAW_BH001_BH010.map((activity) => ({
  ...activity,
  orderIndex: activity.sequenceNumber,
  recordingSetup: activity.recordingRequirements,
  audioRequired: activity.recordingRequirements.audioRequired,
  fps: activity.recommendedFps,
  prerequisiteActivityId: activity.prerequisites[0] ?? null,
  nextActivityId: activity.harderActivityId,
  vlmPrompt: completePrompt(activity),
}));
