import type { Booking } from "@/services/vetDirectory";

export type AreaKey = "walks" | "meals" | "grooming" | "meds" | "vaccines";

export const AREAS: readonly {
  key: AreaKey;
  label: string;
  hint: string;
  glyph: string;
}[] = [
  { key: "walks", label: "Walks", hint: "Daily outings", glyph: "walk" },
  { key: "meals", label: "Meals", hint: "Breakfast, dinner", glyph: "food" },
  { key: "grooming", label: "Grooming", hint: "Baths, nails, teeth", glyph: "scissors" },
  { key: "meds", label: "Medication", hint: "Daily or monthly", glyph: "pill" },
  { key: "vaccines", label: "Vaccines", hint: "What is due next", glyph: "syringe" },
];

export type GroupKey = "daily" | "routine" | "health";

export const GROUPS: readonly {
  key: GroupKey;
  label: string;
  hint: string;
  glyph: string;
  areas: readonly AreaKey[];
}[] = [
  { key: "daily", label: "Daily care", hint: "Walks, meals, water", glyph: "sun", areas: ["walks", "meals"] },
  { key: "routine", label: "Routine care", hint: "Grooming, recurring care", glyph: "cycle", areas: ["grooming"] },
  { key: "health", label: "Health", hint: "Medication, vaccinations", glyph: "heart", areas: ["meds", "vaccines"] },
];

export const groupOn = (areas: readonly AreaKey[], key: GroupKey) =>
  GROUPS.find((group) => group.key === key)?.areas.every((area) => areas.includes(area)) ?? false;

export const toggleGroup = (areas: readonly AreaKey[], key: GroupKey): AreaKey[] => {
  const members = GROUPS.find((group) => group.key === key)?.areas ?? [];
  return groupOn(areas, key)
    ? areas.filter((area) => !members.includes(area))
    : [...new Set([...areas, ...members])];
};

const slot = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;

export const TIME_SLOTS: readonly string[] = Array.from({ length: 34 }, (_, i) =>
  slot(6 * 60 + i * 30),
);

export const PERIODS = [
  { key: "morning", label: "Morning", from: 6 * 60, to: 11 * 60 + 30 },
  { key: "midday", label: "Midday", from: 12 * 60, to: 16 * 60 + 30 },
  { key: "evening", label: "Evening", from: 17 * 60, to: 22 * 60 + 30 },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export const slotsIn = (period: PeriodKey): readonly string[] => {
  const band = PERIODS.find((item) => item.key === period) ?? PERIODS[0];
  const count = (band.to - band.from) / 30 + 1;
  return Array.from({ length: count }, (_, i) => slot(band.from + i * 30));
};

export const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const periodOf = (time: string): PeriodKey => {
  const minutes = minutesOf(time);
  return minutes < 12 * 60 ? "morning" : minutes < 17 * 60 ? "midday" : "evening";
};

export const prettyTime = (slot: string) => {
  const [h, m] = slot.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

export const VACCINE_RECENCY = [
  { key: "recent", label: "This year" },
  { key: "old", label: "Over a year ago" },
  { key: "unsure", label: "Not sure" },
] as const;

export type WorkWindow = { leave: string; home: string };

export const DEFAULT_WORK: WorkWindow = { leave: "09:00", home: "18:00" };

const clampSlot = (minutes: number) =>
  slot(Math.min(22 * 60 + 30, Math.max(6 * 60, Math.round(minutes / 30) * 30)));

export const optimiseDay = (work: WorkWindow) => {
  const leave = minutesOf(work.leave);
  const home = minutesOf(work.home);

  const morningWalk = clampSlot(leave - 60);
  const breakfast = clampSlot(leave - 90);
  const eveningWalk = clampSlot(home + 30);
  const dinner = clampSlot(home + 90);

  return {
    walkTimes: [morningWalk, eveningWalk],
    mealTimes: [breakfast, dinner],
    medTimes: [clampSlot(minutesOf(dinner) + 60)],
  };
};

export type Answers = {
  areas: AreaKey[];
  walkTimes: string[];
  mealTimes: string[];
  grooming: string[];
  onMeds: boolean | null;
  meds: string[];
  medName: string;
  medTimes: string[];
  vaccines: string[];
  vaccineRecency: string;
  kitOwned: string[];
  kitHowTo: string[];
  postcode: string;
  booked: Booking | null;
  medKeys: string[];
  medCustom: string;
  medFilter: string | null;
  work: WorkWindow;
  checkinTime: string | null;
};

export const initialAnswers = (): Answers => ({
  areas: ["walks", "meals"],
  walkTimes: [],
  mealTimes: [],
  grooming: [],
  onMeds: null,
  meds: [],
  medName: "",
  medTimes: [],
  vaccines: [],
  vaccineRecency: "recent",
  kitOwned: [],
  kitHowTo: [],
  postcode: "",
  booked: null,
  work: DEFAULT_WORK,
  medKeys: [],
  medCustom: "",
  medFilter: null,
  checkinTime: null,
});

export type ScreenKey =
  | "areas"
  | "walks"
  | "meals"
  | "grooming"
  | "kit"
  | "meds"
  | "vaccines"
  | "vet-where"
  | "vet-book"
  | "checkin";

export const screensFor = (a: {
  areas: readonly AreaKey[];
  grooming: readonly string[];
  needsVaccine: boolean;
}): readonly ScreenKey[] => {
  const out: ScreenKey[] = ["areas"];
  if (a.areas.includes("walks")) out.push("walks");
  if (a.areas.includes("meals")) out.push("meals");
  if (a.areas.includes("grooming")) {
    out.push("grooming");
    if (a.grooming.length > 0) out.push("kit");
  }
  if (a.areas.includes("meds")) out.push("meds");
  if (a.areas.includes("vaccines")) {
    out.push("vaccines");
    if (a.needsVaccine) out.push("vet-where", "vet-book");
  }
  if (a.areas.includes("meds") || a.areas.includes("vaccines")) out.push("checkin");
  return out;
};
