import { useMemo } from "react";
import { router } from "expo-router";

import { requestCheckIn } from "@/features/care/components/CheckInLock";
import { minutesOf } from "@/features/care/components/careSetupAnswers";
import { useTodayCare, type TodayItem } from "@/features/care/components/todayCare";
import { useCareOnboarding } from "@/features/care/state/careOnboarding";
import { useCheckInSettings, useTodayCheckIn } from "@/features/care/state/dailyCheckIn";
import { toggleCheck, useTodayChecks } from "@/features/care/state/todayChecks";
import { useCareRoutineCompletions, useCareRoutines, useCompleteCareRoutine } from "@/hooks/useCareEvents";

/**
 * Today's care as one list, shared by Care home and the schedule so they can never disagree: routines, each walk and
 * meal from the plan, medicine times, and the evening check-in, with what is done. Ticking an item here ticks it
 * everywhere (and on the server for routines).
 */
export const useCareDay = (dogId: string, todayIso: string) => {
  const routines = useCareRoutines(dogId);
  const completions = useCareRoutineCompletions(dogId, todayIso);
  const doneIds = useMemo(() => new Set((completions.data ?? []).map((c) => c.routineId)), [completions.data]);
  const { choice } = useCareOnboarding();

  const routineItems = useTodayCare(routines.data, doneIds, choice);
  const checkIn = useCheckInSettings();
  const { entry: checkInEntry } = useTodayCheckIn();
  const todayItems = useMemo<TodayItem[]>(() => {
    if (!checkIn.enabled) return routineItems;
    const item: TodayItem = {
      key: "checkin",
      routineId: null,
      iconKey: "heartbeat",
      title: "Check-in",
      detail: checkInEntry ? "Answered today" : "About a minute",
      time: checkIn.time,
      done: Boolean(checkInEntry),
    };
    return [...routineItems, item].sort((a, b) => (a.time && b.time ? minutesOf(a.time) - minutesOf(b.time) : a.time ? -1 : b.time ? 1 : 0));
  }, [routineItems, checkIn.enabled, checkIn.time, checkInEntry]);

  // Each walk and meal is ticked on its own. A routine counts as done on the server once any of its entries is.
  const checks = useTodayChecks();
  const completeRoutine = useCompleteCareRoutine(dogId, todayIso);
  const items = useMemo<TodayItem[]>(() => {
    const perRoutine = new Map<string, number>();
    todayItems.forEach((item) => item.routineId && perRoutine.set(item.routineId, (perRoutine.get(item.routineId) ?? 0) + 1));
    // Walks finished on the walk screen tick off the walk closest in time.
    const walked = new Set<string>();
    const walkItems = todayItems.filter((item) => item.iconKey === "walk" && item.time);
    checks.walks.forEach((at) => {
      const open = walkItems.filter((item) => !walked.has(item.key) && !checks.keys.includes(item.key));
      const nearest = open.sort((a, b) => Math.abs(minutesOf(a.time!) - minutesOf(at)) - Math.abs(minutesOf(b.time!) - minutesOf(at)))[0];
      if (nearest) walked.add(nearest.key);
    });
    return todayItems.map((item) => ({
      ...item,
      done:
        item.key === "checkin"
          ? item.done
          : checks.keys.includes(item.key) || walked.has(item.key) || (item.done && Boolean(item.routineId) && perRoutine.get(item.routineId!) === 1),
    }));
  }, [todayItems, checks]);

  const toggle = (item: TodayItem) => {
    if (item.key === "checkin") {
      // A finished check-in opens for editing instead of doing nothing.
      if (!item.done) requestCheckIn();
      else router.push(`/care/check-in-edit?date=${todayIso}` as never);
      return;
    }
    toggleCheck(item.key);
    if (!item.done && item.routineId && !doneIds.has(item.routineId)) completeRoutine.mutate(item.routineId);
  };

  return { routines, doneIds, choice, checkIn, checkInEntry, todayItems, items, toggle };
};
