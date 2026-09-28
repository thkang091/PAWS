export type Urgency = "go" | "call" | "watch";

export type Situation = {
  key: string;
  label: string;
  urgency: Urgency;
  match: RegExp;
  steps: (name: string) => readonly string[];
  poison?: boolean;
};

export const URGENCY: Record<Urgency, { label: string; line: string }> = {
  go: { label: "Go now", line: "Head to the emergency vet. Call on the way so they are ready." },
  call: { label: "Call now", line: "Call before you do anything else. They will tell you whether to come in." },
  watch: { label: "Watch closely", line: "This can often wait for your usual vet, as long as none of the warning signs show up." },
};

export const SITUATIONS: readonly Situation[] = [
  {
    key: "toxin",
    label: "Ate something bad",
    urgency: "call",
    poison: true,
    match: /chocolate|grape|raisin|xylitol|\bgum\b|poison|toxic|ate |eaten|swallow|pill|medicine|rat bait|onion|lily/i,
    steps: (name) => [
      `Take away whatever is left and keep the packaging. The vet will ask what it was and how much.`,
      `Do not make ${name} vomit unless a vet tells you to. Some things do more harm coming back up.`,
      `Call poison control or the emergency vet now, even if ${name} seems fine. Some poisons act hours later.`,
    ],
  },
  {
    key: "breathing",
    label: "Struggling to breathe",
    urgency: "go",
    match: /breath|gasp|pant|blue gum|wheez/i,
    steps: (name) => [
      `Keep ${name} calm and still. Let them pick the position that is easiest.`,
      `Look in the mouth only if it is safe. Do not reach in blindly.`,
      `Keep the car cool and the collar loose on the way.`,
    ],
  },
  {
    key: "choking",
    label: "Choking",
    urgency: "go",
    match: /chok|stuck|gag|lodged/i,
    steps: (name) => [
      `If you can see the object and reach it easily, sweep it out to the side with a finger.`,
      `Never push straight in. That can lodge it deeper.`,
      `If it will not come out, or ${name} stops breathing, go now.`,
    ],
  },
  {
    key: "bleeding",
    label: "Bleeding",
    urgency: "go",
    match: /bleed|blood|cut|wound|gash|torn/i,
    steps: (name) => [
      `Press a clean cloth firmly on the wound. Keep the pressure on for 3 minutes without lifting it to check.`,
      `If blood soaks through, add another cloth on top. Leave the first one where it is.`,
      `Keep ${name} as still as you can while you get to the vet.`,
    ],
  },
  {
    key: "heat",
    label: "Overheated",
    urgency: "go",
    match: /heat|\bhot\b|overheat|sunstroke/i,
    steps: (name) => [
      `Move ${name} into shade or air conditioning right away.`,
      `Wet the body with cool water, not ice cold, and let air move over it.`,
      `Offer small sips of water. Go to the vet even if ${name} seems to recover.`,
    ],
  },
  {
    key: "seizure",
    label: "Seizure",
    urgency: "go",
    match: /seiz|convuls|\bfit\b|twitch/i,
    steps: (name) => [
      `Move furniture and stairs out of the way. Keep your hands away from ${name}'s mouth.`,
      `Time it. Over 5 minutes, or one after another, means go now.`,
      `Afterwards keep the room dim and quiet. ${name} may be confused for a while.`,
    ],
  },
  {
    key: "injury",
    label: "Hit, fell or hurt",
    urgency: "go",
    match: /hit|fell|fall|limp|broken|hurt|injur|accident|attack|bitten/i,
    steps: (name) => [
      `Even gentle dogs bite when they hurt. Approach slowly, and loosely cover ${name}'s mouth with a soft cloth if needed.`,
      `Slide ${name} onto a flat board or a blanket to move them, keeping the back straight.`,
      `Go in even if ${name} seems fine. Injuries can be inside.`,
    ],
  },
  {
    key: "collapse",
    label: "Collapsed",
    urgency: "go",
    match: /collaps|faint|unconscious|not respond|won't wake|wont wake|limp body/i,
    steps: (name) => [
      `Check that ${name} is breathing and look at the gums. Pale, grey or blue gums mean every minute counts.`,
      `Keep ${name} warm and flat, with the head in line with the body.`,
      `Go now, and have someone call ahead while you drive.`,
    ],
  },
  {
    key: "stomach",
    label: "Vomiting or diarrhea",
    urgency: "watch",
    match: /vomit|throw|puk|diarr|poop|stomach|bloat/i,
    steps: (name) => [
      `Hold food for a few hours and offer small sips of water.`,
      `Go now if there is blood, a hard swollen belly, retching with nothing coming up, or ${name} cannot keep water down.`,
      `Otherwise call your usual vet if it lasts past a day.`,
    ],
  },
];

const PRIORITY = ["collapse", "breathing", "choking", "seizure", "bleeding", "toxin", "heat", "injury", "stomach"];

export const matchSituation = (message: string) =>
  PRIORITY.map((key) => SITUATIONS.find((situation) => situation.key === key))
    .find((situation) => situation?.match.test(message)) ?? null;

export const POISON_CONTROL = { label: "Pet poison control", number: "+18884264435", display: "(888) 426-4435" };
