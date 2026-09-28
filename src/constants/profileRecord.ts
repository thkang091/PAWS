export type StateKey = "settled" | "learning" | "hard";

export type StateRow = {
  label: string;
  state: StateKey;
  detail?: string;
};

export type FactRow = readonly [label: string, value: string];

export type EntryRow = {
  title: string;
  meta: string;
  trailing?: string;
};

export type MeterRow = {
  label: string;
  strong: number;
  total: number;
};

export type Block =
  | { kind: "prose"; text: string }
  | { kind: "facts"; title?: string; rows: readonly FactRow[]; collapseAfter?: number }
  | {
      kind: "states";
      title?: string;
      note?: string;
      rows: readonly StateRow[];
      collapseAfter?: number;
      labels?: Partial<Record<StateKey, string>>;
    }
  | { kind: "chips"; title: string; note?: string; items: readonly string[] }
  | {
      kind: "entries";
      title?: string;
      note?: string;
      rows: readonly EntryRow[];
      collapseAfter?: number;
    }
  | { kind: "meters"; title?: string; note?: string; rows: readonly MeterRow[] }
  | { kind: "link"; label: string; hint: string; href: string };

export type ProfileSection = {
  key: string;
  title: string;
  summary: string;
  lede: string;
  blocks: readonly Block[];
};

export type SectionCluster = {
  label: string;
  keys: readonly string[];
};

export type ProfileTab = {
  key: string;
  label: string;
  headTitle: string;
  headHref: string;
  doors: readonly string[];
  panel: ProfilePanel;
};

export type ProfilePanel = {
  spotlight?: {
    chip: string;
    glyph: string;
    title: string;
    meta: string;
    progress?: number;
    progressNote?: string;
    href: string;
  };
  band?: readonly { key: string; glyph: string; value: string; label: string }[];
  rail?: {
    title: string;
    cards: readonly { key: string; title: string; chip?: string; meta: string }[];
  };
  traits?: {
    title: string;
    rows: readonly { key: string; value: string; label: string; level: number; phrase: string }[];
  };
  meters?: { title: string; rows: readonly { key: string; label: string; strong: number; total: number }[] };
  tilesTitle: string;
};

export const bori: {
  name: string;
  nickname: string;
  breed: string;
  sex: string;
  age: string;
  weight: string;
  gotchaDay: string;
  dogTag: string;
} = {
  name: "Bori",
  nickname: "Bo",
  breed: "Golden Retriever",
  sex: "Male, neutered",
  age: "3y 2m",
  weight: "28.4 kg",
  gotchaDay: "4 July 2022",
  dogTag: "Our Good Boy",
};

export const together: {
  streakDays: number;
  bestStreakDays: number;
  skillsLearned: number;
  skillsLearning: number;
  skillsStrong: number;
  pawPoints: number;
  bondLevel: number;
  bondXpInLevel: number;
  bondXpPerLevel: number;
} = {
  streakDays: 12,
  bestStreakDays: 21,
  skillsLearned: 9,
  skillsLearning: 3,
  skillsStrong: 6,
  pawPoints: 2480,
  bondLevel: 7,
  bondXpInLevel: 640,
  bondXpPerLevel: 1000,
};

const about: ProfileSection = {
  key: "about",
  title: "About Bori",
  summary: "Golden Retriever · 3y 2m · 28.4 kg · neutered",
  lede: "The things that stay true about Bori.",
  blocks: [
    {
      kind: "facts",
      title: "Basics",
      rows: [
        ["Full name", "Bori"],
        ["Nickname", "Bo"],
        ["Breed", "Golden Retriever"],
        ["Sex", "Male, neutered"],
        ["Date of birth", "18 June 2022"],
        ["Age", "3 years, 2 months"],
        ["Gotcha day", "4 July 2022"],
        ["Size", "Large"],
      ],
    },
    {
      kind: "facts",
      title: "Body",
      rows: [
        ["Current weight", "28.4 kg"],
        ["Ideal weight", "27–29 kg"],
        ["Coat", "Double, medium length"],
        ["Colour", "Golden, white blaze on chest"],
      ],
    },
    {
      kind: "facts",
      title: "Identification",
      rows: [
        ["Microchip", "985 141 000 482 117"],
        ["Registration", "Seoul · SL-2022-88412"],
        ["Insurance", "Not recorded"],
      ],
    },
  ],
};

const personality: ProfileSection = {
  key: "personality",
  title: "Personality",
  summary: "High energy · confident · works for food",
  lede: "How Bori tends to meet the world.",
  blocks: [
    {
      kind: "entries",
      title: "Temperament",
      note: "How Bori usually is, not how he should be.",
      rows: [
        { title: "Energy", meta: "Needs a real outlet every day", trailing: "High" },
        { title: "Confidence", meta: "Settles quickly in new places", trailing: "Confident" },
        { title: "Sociability", meta: "Seeks people out", trailing: "Very social" },
        { title: "Playfulness", meta: "Will always take a game", trailing: "Playful" },
        { title: "Independence", meta: "Prefers company; follows room to room", trailing: "Low" },
        { title: "Sensitivity", meta: "Startles at sudden noise, recovers fast", trailing: "Medium" },
      ],
    },
    {
      kind: "states",
      title: "What works as a reward",
      labels: { settled: "Reliable", learning: "Sometimes", hard: "Rarely" },
      rows: [
        { label: "Food", state: "settled", detail: "First choice, every time" },
        { label: "Praise", state: "settled", detail: "Works well once he already knows the cue" },
        { label: "Toys", state: "learning", detail: "Good outdoors, distracting indoors" },
        { label: "Attention", state: "learning", detail: "Can tip into over-arousal" },
      ],
    },
    {
      kind: "chips",
      title: "Loves",
      items: [
        "Freeze-dried liver",
        "Tennis balls",
        "Sniff walks",
        "The river path",
        "Tug",
        "Children",
        "Car rides",
      ],
    },
    {
      kind: "chips",
      title: "Finds hard",
      note: "Not faults. Just things worth planning around.",
      items: ["Nail trims", "Thunder", "Crowded markets", "Being brushed on the tail", "The vacuum"],
    },
    {
      kind: "facts",
      title: "Settling",
      rows: [
        ["What helps", "A chew and a closed door"],
        ["Favourite spot", "The rug by the balcony"],
        ["Best reward after work", "A slow sniff walk"],
      ],
    },
  ],
};

const social: ProfileSection = {
  key: "social",
  title: "Social & places",
  summary: "Easy with people · still learning the city",
  lede: "Where Bori is comfortable, and where he is still building up.",
  blocks: [
    {
      kind: "states",
      title: "People",
      rows: [
        { label: "Adults", state: "settled", detail: "Greets calmly with four paws down" },
        { label: "Children", state: "settled", detail: "Gentle, keeps his own space" },
        { label: "Strangers", state: "settled" },
        { label: "Visitors at the door", state: "hard", detail: "Barks, takes a minute to settle" },
      ],
    },
    {
      kind: "states",
      title: "Dogs",
      rows: [
        { label: "Familiar dogs", state: "settled" },
        { label: "Puppies", state: "settled", detail: "Tolerant, self-handicaps" },
        { label: "Unfamiliar dogs", state: "learning", detail: "Fine off-lead, pulls on-lead" },
        { label: "Small dogs", state: "learning" },
        { label: "Large dogs", state: "settled" },
      ],
    },
    {
      kind: "states",
      title: "Other animals",
      rows: [
        { label: "Cats", state: "learning", detail: "Curious, will chase if they run" },
        { label: "Birds", state: "learning" },
      ],
    },
    {
      kind: "states",
      title: "Places",
      collapseAfter: 4,
      rows: [
        { label: "Home", state: "settled" },
        { label: "Park", state: "settled" },
        { label: "Car", state: "settled", detail: "Sleeps through the drive" },
        { label: "City streets", state: "learning", detail: "Copes; tires quickly" },
        { label: "Vet", state: "learning", detail: "Happy in the waiting room, tense on the table" },
        { label: "Groomer", state: "hard", detail: "Needs a slow start and a break halfway" },
        { label: "Crowded places", state: "hard" },
      ],
    },
    {
      kind: "chips",
      title: "Known triggers",
      items: ["Doorbell", "Vacuum", "Thunder", "Bikes passing close"],
    },
  ],
};

const routine: ProfileSection = {
  key: "routine",
  title: "A normal day",
  summary: "Wakes 7:00 · walks twice · bed by 22:30",
  lede: "Bori's usual shape of a day. What is actually happening today lives in Care.",
  blocks: [
    {
      kind: "facts",
      title: "Typical timings",
      rows: [
        ["Wakes", "07:00"],
        ["First potty", "07:10"],
        ["Breakfast", "07:30"],
        ["Morning walk", "08:00 · 30 min"],
        ["Training", "10:00, short and early"],
        ["Evening walk", "18:30 · 40 min"],
        ["Dinner", "19:00"],
        ["Last potty", "22:00"],
        ["Bed", "22:30"],
      ],
    },
    {
      kind: "facts",
      title: "Patterns",
      rows: [
        ["Potty", "4–5 times a day, reliable"],
        ["Naps", "Long one after the morning walk"],
        ["Alone time", "Up to 4 hours, settled"],
      ],
    },
    { kind: "link", label: "Today's care", hint: "What is due right now", href: "/care" },
  ],
};

const training: ProfileSection = {
  key: "training",
  title: "Training profile",
  summary: "Intermediate · 6 strong, 3 practising",
  lede: "What Bori knows, what he is working on, and how he learns best.",
  blocks: [
    {
      kind: "facts",
      title: "How Bori trains",
      rows: [
        ["Experience", "Intermediate"],
        ["Current focus", "Calm manners"],
        ["Primary reward", "Treats"],
        ["Secondary reward", "Praise"],
        ["Session length", "5–8 minutes"],
        ["Best time", "Morning, before the walk"],
        ["Best environment", "Kitchen, then the garden"],
        ["Distraction tolerance", "Low outdoors, good indoors"],
      ],
    },
    {
      kind: "meters",
      title: "By category",
      note: "Skills marked strong, out of the skills Bori has started.",
      rows: [
        { label: "Communication", strong: 2, total: 2 },
        { label: "Calmness", strong: 1, total: 3 },
        { label: "Leash skills", strong: 1, total: 2 },
        { label: "Social skills", strong: 1, total: 2 },
        { label: "Real-world skills", strong: 1, total: 2 },
        { label: "Handling", strong: 0, total: 1 },
      ],
    },
    {
      kind: "states",
      title: "Skills",
      collapseAfter: 5,
      labels: { settled: "Strong", learning: "Practising", hard: "Learning" },
      rows: [
        { label: "Sit", state: "settled", detail: "Strong · practised 2 days ago · no lure" },
        { label: "Name response", state: "settled", detail: "Strong · practised yesterday" },
        { label: "Down", state: "settled", detail: "Strong · practised 4 days ago" },
        { label: "Loose-lead walking", state: "settled", detail: "Strong on quiet streets" },
        { label: "Wait at the door", state: "settled", detail: "Strong · review due Friday" },
        { label: "Place / settle on a mat", state: "settled", detail: "Strong indoors" },
        { label: "Recall in the park", state: "learning", detail: "Practising · lure still helps" },
        { label: "Leave it", state: "learning", detail: "Practising · learned 3 weeks ago" },
        { label: "Settle when the doorbell goes", state: "hard", detail: "Learning · next review Monday" },
      ],
    },
    { kind: "link", label: "Open training", hint: "Lessons and this week's plan", href: "/train" },
  ],
};

const behaviour: ProfileSection = {
  key: "behaviour",
  title: "Behaviour notes",
  summary: "3 improving · 1 being worked on",
  lede: "What PAWS has noticed, so the plan can account for it.",
  blocks: [
    {
      kind: "states",
      title: "Currently working on",
      labels: { settled: "Settled", learning: "Improving", hard: "Working on" },
      rows: [
        {
          label: "Barking at the door",
          state: "hard",
          detail: "Daily · triggered by the bell · improving slowly",
        },
      ],
    },
    {
      kind: "states",
      title: "Improving",
      labels: { settled: "Settled", learning: "Improving", hard: "Working on" },
      rows: [
        { label: "Pulling on lead", state: "learning", detail: "Only near other dogs now" },
        { label: "Jumping to greet", state: "learning", detail: "Weekly · better with visitors he knows" },
        { label: "Recall when distracted", state: "learning", detail: "Reliable unless there is a squirrel" },
      ],
    },
    {
      kind: "states",
      title: "Settled",
      collapseAfter: 3,
      labels: { settled: "Settled", learning: "Improving", hard: "Working on" },
      rows: [
        { label: "House training", state: "settled", detail: "No accidents in 14 months" },
        { label: "Chewing", state: "settled", detail: "Only his own toys" },
        { label: "Mouthing", state: "settled", detail: "Grew out of it at ~10 months" },
        { label: "Separation", state: "settled", detail: "Settles within 5 minutes" },
        { label: "Resource guarding", state: "settled", detail: "None observed" },
        { label: "Reactivity", state: "settled", detail: "None observed" },
        { label: "Fear responses", state: "learning", detail: "Thunder only" },
      ],
    },
    { kind: "link", label: "Open training", hint: "The plan that works on these", href: "/train" },
  ],
};

const health: ProfileSection = {
  key: "health",
  title: "Medical record",
  summary: "No conditions · rabies due Mar 2026",
  lede: "Bori's standing health record. Today's medications live in Care.",
  blocks: [
    {
      kind: "facts",
      title: "General",
      rows: [
        ["Known conditions", "None recorded"],
        ["Allergies", "None recorded"],
        ["Sensitivities", "Mild. Rich food upsets his stomach"],
        ["Surgeries", "Neutered, Nov 2023"],
        ["Injuries", "None recorded"],
        ["Mobility", "No concerns"],
        ["Dental", "Cleaned Aug 2023 · mild tartar"],
        ["Skin & coat", "Seasonal shedding, no irritation"],
      ],
    },
    {
      kind: "entries",
      title: "Vaccinations",
      rows: [
        { title: "Rabies", meta: "City Vet · 12 Mar 2025", trailing: "Due Mar 2026" },
        { title: "DHPP", meta: "City Vet · 12 Mar 2025", trailing: "Due Mar 2026" },
        { title: "Kennel cough", meta: "City Vet · 3 Aug 2025", trailing: "Due Aug 2026" },
      ],
    },
    {
      kind: "entries",
      title: "Medications",
      rows: [
        {
          title: "Flea and tick: Simparica",
          meta: "One chew, monthly · with food",
          trailing: "Ongoing",
        },
      ],
    },
    {
      kind: "entries",
      title: "Vet history",
      collapseAfter: 3,
      rows: [
        { title: "Annual wellness", meta: "City Vet · 12 Mar 2025", trailing: "All clear" },
        { title: "Dental check", meta: "City Vet · 3 Aug 2023", trailing: "Mild tartar" },
        { title: "Neutering", meta: "City Vet · 21 Nov 2023", trailing: "Recovered" },
        { title: "Ear infection", meta: "City Vet · 8 Feb 2023", trailing: "Resolved" },
      ],
    },
    {
      kind: "facts",
      title: "Measurements",
      rows: [
        ["Weight", "28.4 kg · up 0.3 kg since May"],
        ["Body condition", "4 of 9, ideal"],
        ["Last measured", "2 September 2025"],
      ],
    },
    { kind: "link", label: "Care records", hint: "Weight log, vaccinations, medications", href: "/care" },
  ],
};

const food: ProfileSection = {
  key: "food",
  title: "Food & nutrition",
  summary: "Brit Fresh Beef · 2 meals · 340 g a day",
  lede: "What Bori eats on a normal day.",
  blocks: [
    {
      kind: "facts",
      title: "Current food",
      rows: [
        ["Brand", "Brit"],
        ["Product", "Fresh Beef with Pumpkin"],
        ["Type", "Dry, complete"],
        ["Amount per meal", "170 g"],
        ["Meals per day", "2 at 07:30 and 19:00"],
        ["Daily total", "340 g"],
      ],
    },
    {
      kind: "facts",
      title: "Per 100 g",
      rows: [
        ["Calories", "352 kcal"],
        ["Protein", "26%"],
        ["Fat", "14%"],
        ["Carbohydrate", "38%"],
      ],
    },
    {
      kind: "chips",
      title: "Treats",
      note: "Training treats are counted against the daily total.",
      items: ["Freeze-dried liver", "Carrot sticks", "Cheese cubes (training only)"],
    },
    {
      kind: "facts",
      title: "Avoid",
      rows: [
        ["Allergies", "None recorded"],
        ["Intolerances", "Very rich or fatty food"],
        ["Never give", "Grapes, onion, chocolate, cooked bone"],
      ],
    },
    {
      kind: "facts",
      title: "Water",
      rows: [
        ["Typical intake", "~1.4 L a day"],
        ["Preference", "Fresh, bowl refilled twice"],
      ],
    },
  ],
};

const activity: ProfileSection = {
  key: "activity",
  title: "Activity & lifestyle",
  summary: "2 walks · about 70 min a day",
  lede: "How much Bori moves on a normal day, and what he likes doing.",
  blocks: [
    {
      kind: "facts",
      title: "Normal week",
      rows: [
        ["Daily walk goal", "60 minutes"],
        ["Typical walks", "2 a day"],
        ["Typical duration", "30 min and 40 min"],
        ["Typical distance", "3.4 km a day"],
        ["Exercise level", "High"],
        ["Play", "2–3 short sessions a day"],
      ],
    },
    {
      kind: "chips",
      title: "Favourites",
      items: ["Sniff walks", "Fetch", "Tug", "Swimming", "Hiking"],
    },
    {
      kind: "chips",
      title: "Not for Bori",
      items: ["Long runs on pavement", "Dog parks at peak hours"],
    },
    { kind: "link", label: "Exercise log", hint: "What Bori has actually done", href: "/care/exercise" },
  ],
};

const people: ProfileSection = {
  key: "people",
  title: "Bori's people",
  summary: "Taehoon, Jiwon and one sitter",
  lede: "Who looks after Bori, and what each of them can do in PAWS.",
  blocks: [
    {
      kind: "entries",
      title: "Household",
      rows: [
        { title: "Taehoon", meta: "Owner · everything", trailing: "You" },
        { title: "Jiwon", meta: "Co-owner · care, training, health", trailing: "Family" },
        { title: "Minseo", meta: "Can log care and walks", trailing: "Sitter" },
      ],
    },
    {
      kind: "facts",
      title: "What a person can be given",
      rows: [
        ["View", "See Bori's profile"],
        ["Log care", "Tick routines, log walks and meals"],
        ["Training", "Run sessions and mark practice"],
        ["Health", "See and add health records"],
        ["Edit profile", "Change Bori's information"],
      ],
    },
  ],
};

const careTeam: ProfileSection = {
  key: "care-team",
  title: "Care team",
  summary: "City Vet, a trainer and a groomer",
  lede: "The people outside the house who look after Bori.",
  blocks: [
    {
      kind: "entries",
      rows: [
        { title: "City Vet", meta: "Dr. Han Soyeon · 02-555-0148", trailing: "Primary vet" },
        { title: "Riverside Animal ER", meta: "Open 24h · 02-555-0900", trailing: "Emergency" },
        { title: "Good Dog Studio", meta: "Park Jaemin · 010-2200-4417", trailing: "Trainer" },
        { title: "Fluff & Co.", meta: "Every 8 weeks · 02-555-2211", trailing: "Groomer" },
        { title: "Minseo", meta: "Weekday afternoons", trailing: "Walker" },
        { title: "Happy Tails Boarding", meta: "Used twice · 02-555-7788", trailing: "Boarding" },
      ],
    },
  ],
};

const records: ProfileSection = {
  key: "records",
  title: "Records",
  summary: "14 documents · last added 12 Mar 2025",
  lede: "Everything with a date and a piece of paper behind it.",
  blocks: [
    {
      kind: "entries",
      rows: [
        { title: "Vaccination certificates", meta: "4 documents", trailing: "Mar 2025" },
        { title: "Vet reports", meta: "5 documents", trailing: "Mar 2025" },
        { title: "Prescriptions", meta: "1 document", trailing: "Feb 2025" },
        { title: "Lab results", meta: "2 documents", trailing: "Mar 2025" },
        { title: "Microchip registration", meta: "1 document", trailing: "Jul 2022" },
        { title: "Adoption papers", meta: "1 document", trailing: "Jul 2022" },
        { title: "Insurance", meta: "Nothing yet", trailing: "None" },
        { title: "Training records", meta: "Exported from PAWS", trailing: "Sep 2025" },
      ],
    },
  ],
};

export const PROFILE_SECTIONS: readonly ProfileSection[] = [
  about,
  personality,
  social,
  routine,
  training,
  behaviour,
  health,
  food,
  activity,
  people,
  careTeam,
  records,
];

export const PROFILE_CLUSTERS: readonly SectionCluster[] = [
  { label: "About Bori", keys: ["about", "personality", "social", "routine"] },
  { label: "Training", keys: ["training", "behaviour"] },
  { label: "Health & care", keys: ["health", "food", "activity", "care-team"] },
  { label: "People & records", keys: ["people", "records"] },
];

export const PROFILE_TABS: readonly ProfileTab[] = [
  {
    key: "bori",
    label: "About",
    headTitle: "About Bori",
    headHref: "/profile/about",
    doors: ["personality", "social", "routine", "people", "records"],
    panel: {
      traits: {
        title: "How Bori meets the world",
        rows: [
          { key: "energy", value: "High", label: "Energy", level: 4, phrase: "high-energy" },
          { key: "confidence", value: "Confident", label: "Confidence", level: 4, phrase: "confident" },
          { key: "sociability", value: "Very social", label: "With people", level: 5, phrase: "very social" },
          { key: "play", value: "Playful", label: "Play", level: 4, phrase: "playful" },
          { key: "independence", value: "Low", label: "Independence", level: 2, phrase: "independent" },
          { key: "sensitivity", value: "Medium", label: "Sensitivity", level: 3, phrase: "sensitive" },
        ],
      },
      band: [
        { key: "gender", glyph: "gender", value: "Male, neutered", label: "Sex" },
        { key: "since", glyph: "calendar", value: "Jul 2022", label: "Together since" },
        { key: "records", glyph: "folder", value: "14", label: "Documents" },
      ],
      tilesTitle: "Bori's world",
    },
  },
  {
    key: "training",
    label: "Training",
    headTitle: "How training is going",
    headHref: "/profile/training",
    doors: ["training", "behaviour"],
    panel: {
      spotlight: {
        chip: "Working on",
        glyph: "target",
        title: "Calm manners",
        meta: "Mornings, before the walk · treats first, then praise",
        progress: 6 / 12,
        progressNote: "6 of 12 skills strong",
        href: "/profile/training",
      },
      meters: {
        title: "By category",
        rows: [
          { key: "communication", label: "Communication", strong: 2, total: 2 },
          { key: "calmness", label: "Calmness", strong: 1, total: 3 },
          { key: "leash", label: "Leash skills", strong: 1, total: 2 },
          { key: "social", label: "Social skills", strong: 1, total: 2 },
          { key: "world", label: "Real world", strong: 1, total: 2 },
          { key: "handling", label: "Handling", strong: 0, total: 1 },
        ],
      },
      tilesTitle: "Training in detail",
    },
  },
  {
    key: "health",
    label: "Health",
    headTitle: "Health at a glance",
    headHref: "/profile/health",
    doors: ["health", "food", "activity", "care-team"],
    panel: {
      spotlight: {
        chip: "Next up",
        glyph: "syringe",
        title: "Rabies booster",
        meta: "Due Mar 2026 · last given 12 Mar 2025 at City Vet",
        href: "/profile/health",
      },
      band: [
        { key: "conditions", glyph: "heart", value: "None", label: "Conditions" },
        { key: "allergies", glyph: "sensitivity", value: "None", label: "Allergies" },
        { key: "vaccines", glyph: "syringe", value: "3", label: "Vaccines" },
      ],
      rail: {
        title: "Recent checkups",
        cards: [
          { key: "wellness", title: "Annual wellness", chip: "All clear", meta: "12 Mar 2025" },
          { key: "dental", title: "Dental check", chip: "Mild tartar", meta: "3 Aug 2023" },
          { key: "neuter", title: "Neutering", chip: "Recovered", meta: "21 Nov 2023" },
          { key: "ear", title: "Ear infection", chip: "Resolved", meta: "8 Feb 2023" },
        ],
      },
      tilesTitle: "Health in detail",
    },
  },
];

export const findSection = (key: string) =>
  PROFILE_SECTIONS.find((section) => section.key === key);

export const gameRecords: readonly EntryRow[] = [
  { title: "Fastest sit", meta: "Challenge · 8 Sep", trailing: "0.9s" },
  { title: "Longest stay", meta: "Challenge · 2 Sep", trailing: "2m 14s" },
  { title: "Recall challenge", meta: "Challenge · 28 Aug", trailing: "94 pts" },
  { title: "Name response", meta: "Challenge · 21 Aug", trailing: "1.4s" },
];

export const gameHistory: readonly EntryRow[] = [
  { title: "Duels", meta: "11 played", trailing: "7 won" },
  { title: "Tournaments", meta: "3 entered", trailing: "Best: 2nd" },
  { title: "Daily challenges", meta: "Since July", trailing: "48 done" },
];

export const achievements: readonly EntryRow[] = [
  { title: "Two weeks together", meta: "Unlocked 6 Sep", trailing: "New" },
  { title: "First strong skill", meta: "Unlocked 14 Aug" },
  { title: "Ten walks logged", meta: "Unlocked 9 Aug" },
  { title: "Doorbell drills, five days running", meta: "Unlocked 2 Aug" },
  { title: "Clean vet check", meta: "Unlocked 12 Mar" },
];

export const settingsGroups: readonly {
  label: string;
  rows: readonly { key: string; title: string; hint: string; href?: string }[];
}[] = [
  {
    label: "PAWS",
    rows: [
      {
        key: "notifications",
        title: "Notifications",
        hint: "Reminders, streaks and nudges",
        href: "/notifications-settings",
      },
      { key: "account", title: "PAWS account", hint: "Email, password, subscription" },
      { key: "privacy", title: "Privacy", hint: "What PAWS stores and shares" },
      { key: "devices", title: "Connected devices", hint: "Collars, trackers, health apps" },
    ],
  },
  {
    label: "Bori",
    rows: [
      { key: "household", title: "Household permissions", hint: "Who can do what" },
      { key: "data", title: "Data & records", hint: "Export or delete Bori's record" },
    ],
  },
  {
    label: "Support",
    rows: [{ key: "help", title: "Help", hint: "Guides and getting in touch" }],
  },
];
