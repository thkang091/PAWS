import type { Size } from "@/features/care/intel/careIntel";

/**
 * The parts of a dog's long-term care that are not shots, medicine or vet checks: regular weigh-ins, grooming,
 * identification, and spay or neuter timing for young dogs. Each gives one status line and whether it needs a look.
 */
export type Status = { text: string; attention: boolean };

const daysBetween = (from: string, to: string) => {
  const [a, b] = [from, to].map((d) => {
    const [y, m, day] = d.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  });
  return Math.round((b - a) / 86_400_000);
};

const ago = (days: number) => (days < 1 ? "today" : days < 14 ? `${days} ${days === 1 ? "day" : "days"} ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`);

/** Growing puppies every two weeks, everyone else every two months. */
export const weightStatus = (lastWeighed: string | null, stage: "puppy" | "adult" | "senior", today: string, shown: string | null): Status => {
  if (!lastWeighed) return { text: "No weigh-in yet", attention: true };
  const days = daysBetween(lastWeighed, today);
  const every = stage === "puppy" ? 14 : 60;
  return { text: `${shown ? `${shown}, ` : ""}weighed ${ago(days)}`, attention: days > every };
};

const GROOM: Record<string, { label: string; every: number }> = {
  nail_trim: { label: "Nails", every: 21 },
  bath: { label: "Bath", every: 30 },
  ear_clean: { label: "Ears", every: 14 },
};

export const groomingStatus = (logs: readonly { groomingType: string; doneDate: string; nextDueDate: string | null }[], today: string): Status => {
  const due = Object.entries(GROOM)
    .map(([key, g]) => {
      const last = logs.filter((l) => l.groomingType === key).sort((a, b) => (a.doneDate < b.doneDate ? 1 : -1))[0];
      if (!last) return null;
      const next = last.nextDueDate ?? null;
      const overdue = next ? daysBetween(next, today) > 0 : daysBetween(last.doneDate, today) > g.every;
      return overdue ? g.label : null;
    })
    .filter((x): x is string => Boolean(x));
  if (!logs.length) return { text: "Nothing logged yet", attention: false };
  if (!due.length) return { text: "Up to date", attention: false };
  return { text: due.length === 1 ? `${due[0]} due` : `${due.slice(0, -1).join(", ")} and ${due[due.length - 1].toLowerCase()} due`, attention: true };
};

export const idStatus = (microchip: string | null): Status =>
  microchip ? { text: `Microchip ${microchip.length > 6 ? `ending ${microchip.slice(-4)}` : microchip}`, attention: false } : { text: "No microchip on file", attention: true };

/** When vets usually talk about spaying or neutering, by size (bigger dogs often wait until growth is done). */
export const FIX_MONTHS: Record<Size, [number, number]> = { small: [5, 6], medium: [5, 6], large: [9, 15], giant: [12, 18] };

/** Only for dogs under two that are not known to be fixed. Null means the row is not shown. */
export const fixStatus = (fixed: string, ageMonths: number | null, size: Size): Status | null => {
  if (fixed === "Yes" || ageMonths == null || ageMonths >= 24) return null;
  const [from, to] = FIX_MONTHS[size];
  if (ageMonths < from - 1) return { text: `Usually discussed at ${from} to ${to} months`, attention: false };
  return { text: "Worth asking your vet about timing", attention: true };
};
