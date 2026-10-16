import { useEffect, useMemo, useState } from "react";

import { minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import type { CarePlanChoice } from "@/features/care/state/careOnboarding";
import type { CareRoutine } from "@/types/domain";

export type TodayItem = {
  key: string;
  routineId: string | null;
  iconKey: string;
  title: string;
  detail: string;
  time: string | null;
  done: boolean;
};

export type TodayPosition = "past" | "next" | "later" | "anytime";

const namedPair = (times: readonly string[], index: number, one: string, first: string, second: string) =>
  times.length === 1 ? one : index === 0 ? first : index === times.length - 1 ? second : one;

const walkItems = (choice: CarePlanChoice, times: readonly string[]) =>
  times.map((time, index) => ({
    time,
    title: namedPair(times, index, "Walk", "Morning walk", "Evening walk"),
    detail: `${Math.round(choice.exerciseMinutes / Math.max(1, times.length))} min`,
  }));

const mealItems = (choice: CarePlanChoice, times: readonly string[]) =>
  times.map((time, index) => ({
    time,
    title: namedPair(times, index, "Meal", "Breakfast", "Dinner"),
    detail: `${choice.portionGrams} g`,
  }));

const byTime = (a: TodayItem, b: TodayItem) => {
  if (a.time && b.time) return minutesOf(a.time) - minutesOf(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return 0;
};

export const buildToday = (
  routines: readonly CareRoutine[],
  doneIds: ReadonlySet<string>,
  choice: CarePlanChoice | null,
): TodayItem[] => {
  const plan = choice ?? null;
  const walks = plan?.walkTimes ?? [];
  const meals = plan?.mealTimes ?? [];
  const meds = plan?.medTimes ?? [];

  const items: TodayItem[] = [];

  if (routines.length > 0) {
    for (const routine of routines) {
      const done = doneIds.has(routine.id);
      const base = { routineId: routine.id, iconKey: routine.iconKey, done };
      const planned =
        plan && routine.iconKey === "walk" && walks.length > 0
          ? walkItems(plan, walks)
          : plan && routine.iconKey === "bowl-mix" && meals.length > 0
            ? mealItems(plan, meals)
            : null;

      if (planned) {
        planned.forEach((entry) =>
          items.push({ ...base, key: `${routine.id}-${entry.time}`, ...entry }),
        );
      } else {
        items.push({
          ...base,
          key: routine.id,
          title: routine.title,
          detail: routine.description,
          time: routine.reminderTime ? routine.reminderTime.slice(0, 5) : null,
        });
      }
    }
  } else if (plan) {
    walkItems(plan, walks).forEach((entry) =>
      items.push({ ...entry, key: `walk-${entry.time}`, routineId: null, iconKey: "walk", done: false }),
    );
    mealItems(plan, meals).forEach((entry) =>
      items.push({ ...entry, key: `meal-${entry.time}`, routineId: null, iconKey: "bowl-mix", done: false }),
    );
  }

  meds.forEach((time) =>
    items.push({
      key: `med-${time}`,
      routineId: null,
      iconKey: "pill",
      title: plan?.medName?.trim() || "Medication",
      detail: "As prescribed",
      time,
      done: false,
    }),
  );

  return items.sort(byTime);
};

export const nowMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

export const positionsFor = (items: readonly TodayItem[], now: number): TodayPosition[] => {
  let nextTaken = false;
  return items.map((item) => {
    if (!item.time) return "anytime";
    if (minutesOf(item.time) < now) return "past";
    if (!nextTaken && !item.done) {
      nextTaken = true;
      return "next";
    }
    return "later";
  });
};

export const splitTime = (time: string) => {
  const [clock, meridiem] = prettyTime(time).split(" ");
  return { clock, meridiem };
};

export const untilLabel = (time: string, now: number) => {
  const minutes = minutesOf(time) - now;
  if (minutes <= 1) return "Now";
  if (minutes < 60) return `In ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `In ${hours} h` : `In ${hours} h ${rest} min`;
};

export const useNow = (intervalMs = 30_000) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export const useTodayCare = (
  routines: readonly CareRoutine[] | undefined,
  doneIds: ReadonlySet<string>,
  choice: CarePlanChoice | null,
) =>
  useMemo(
    () =>
      buildToday(
        [...(routines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
        doneIds,
        choice,
      ),
    [routines, doneIds, choice],
  );
