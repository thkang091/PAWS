import { APPETITE, DRINKING, ENERGY, UNUSUAL } from "@/features/care/components/DailyHealthCheckSheet";
import type { DailyCheckIn } from "@/features/care/state/dailyCheckIn";

export type StatKey = "appetite" | "energy" | "bathroom" | "drinking" | "unusual";

export type Stat = { key: StatKey; label: string; value: string; ok: boolean };

export const STAT_LABELS: readonly { key: StatKey; label: string }[] = [
  { key: "appetite", label: "Appetite" },
  { key: "energy", label: "Energy" },
  { key: "bathroom", label: "Bathroom" },
  { key: "drinking", label: "Drinking" },
  { key: "unusual", label: "Anything unusual?" },
];

const labelOf = <T extends string>(list: readonly { key: T; label: string }[], key: T | null) =>
  list.find((item) => item.key === key)?.label ?? "Not answered";

const STOOL_WORDS: Record<string, string> = { soft: "Soft stool", diarrhea: "Diarrhea", hard: "Constipated" };
const PEE_WORDS: Record<string, string> = { more: "Peeing more", less: "Peeing less", difficulty: "Trouble peeing" };

export const summarize = (entry: DailyCheckIn): Stat[] => {
  const bathroomOff = [
    entry.stool && entry.stool !== "normal" ? STOOL_WORDS[entry.stool] : null,
    entry.urination && entry.urination !== "normal" ? PEE_WORDS[entry.urination] : null,
  ].filter((part): part is string => Boolean(part));

  const unusual = entry.unusual.map((key) =>
    key === "other" && entry.unusualNote.trim() ? entry.unusualNote.trim() : labelOf(UNUSUAL, key),
  );

  return [
    { key: "appetite", label: "Appetite", value: labelOf(APPETITE, entry.appetite), ok: entry.appetite === "normal" },
    { key: "energy", label: "Energy", value: labelOf(ENERGY, entry.energy), ok: entry.energy === "normal" },
    { key: "bathroom", label: "Bathroom", value: bathroomOff.length ? bathroomOff.join(", ") : "Normal", ok: bathroomOff.length === 0 },
    { key: "drinking", label: "Drinking", value: labelOf(DRINKING, entry.drinking), ok: entry.drinking === "normal" },
    {
      key: "unusual",
      label: "Anything unusual?",
      value: unusual.length ? unusual.join(", ") : "Nothing unusual",
      ok: unusual.length === 0,
    },
  ];
};

export const offCount = (entry: DailyCheckIn) => summarize(entry).filter((stat) => !stat.ok).length;

export const verdictOf = (entry: DailyCheckIn, dogName: string) => {
  const off = summarize(entry).filter((stat) => !stat.ok);
  if (off.length === 0) return { title: "All normal", line: `${dogName} had a steady day.` };
  if (off.length === 1) return { title: "One thing to watch", line: `${off[0].label.replace("?", "")}: ${off[0].value.toLowerCase()}.` };
  return { title: `${off.length} things to watch`, line: "If it carries on tomorrow, call the vet." };
};
