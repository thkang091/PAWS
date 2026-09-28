import { memo, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  BowlFoodIcon,
  CalendarBlankIcon,
  CameraIcon,
  DropIcon,
  ForkKnifeIcon,
  MagnifyingGlassIcon,
  PawPrintIcon,
  XIcon,
} from "phosphor-react-native";

import { DogNeeds } from "@/features/care/components/DogNeeds";
import { FeedArt } from "@/features/care/components/FeedArt";
import { FoodPlanEditor, mealName, type PlanMeal } from "@/features/care/components/FoodPlanEditor";
import { MealLogSheet } from "@/features/care/components/MealLogSheet";
import { TreatSheet } from "@/features/care/components/TreatSheet";
import { minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { useNow } from "@/features/care/components/todayCare";
import { extendCarePlan, useCarePlan, useCareOnboarding } from "@/features/care/state/careOnboarding";
import { PressScale } from "@/components/ui/PressScale";
import { useCareProfile } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDeleteFeedingLog, useLogFeeding, useTodayFeedingLogs } from "@/hooks/useFeedingLogs";
import {
  useInvalidateRecentTreats,
  useRecentTreats,
  useRemoveSavedTreat,
  useSaveMealPlan,
  useSavedTreats,
} from "@/hooks/useFood";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import type { FeedingLog } from "@/services/feedingService";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const GRACE_MINUTES = 30;
const WATER_BY = 12 * 60;

const defaultMealTimes = (mealsPerDay: number): readonly string[] => {
  if (mealsPerDay <= 1) return ["12:00"];
  if (mealsPerDay === 2) return ["08:00", "18:30"];
  if (mealsPerDay === 3) return ["08:00", "13:00", "18:30"];
  return Array.from({ length: mealsPerDay }, (_, i) => {
    const hour = 7 + Math.round((i * 12) / (mealsPerDay - 1));
    return `${String(hour).padStart(2, "0")}:00`;
  });
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const ago = (minutes: number) => {
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h ago` : `${h} h ${m} min ago`;
};

const ageFrom = (birthday: string | null, ageYears: number | null) =>
  birthday
    ? Math.max(0, (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 3600 * 1000))
    : ageYears;

const TABS = ["Today", "Food plan"] as const;

type Mode = "late" | "dry" | "next" | "done";

type TimelineItem = {
  key: string;
  at: string;
  title: string;
  detail: string | null;
  icon: typeof BowlFoodIcon;
  state: "done" | "late" | "next" | "later" | "skipped";
  log: FeedingLog | null;
};

export const FeedView = memo(({ dogId, onOpen }: { dogId: string; onOpen: (href: string) => void }) => {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const now = useNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const careProfile = useCareProfile(dogId);
  const plan = useCarePlan();
  const todayLogs = useTodayFeedingLogs(dogId);
  const logFeeding = useLogFeeding(dogId);
  const deleteFeeding = useDeleteFeedingLog(dogId);
  const dog = useCurrentDog();
  const weights = useWeightLogs(dogId);
  const dogName = dog.data?.name ?? "your dog";
  const { choice } = useCareOnboarding();
  const savedTreats = useSavedTreats(dogId);
  const recentTreats = useRecentTreats(dogId);
  const removeTreat = useRemoveSavedTreat(dogId);
  const saveMealPlan = useSaveMealPlan(dogId);
  const refreshRecentTreats = useInvalidateRecentTreats(dogId);

  const [treatSheet, setTreatSheet] = useState(false);
  const [mealSheet, setMealSheet] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const mealsPerDay = careProfile.data?.mealsPerDay ?? 2;
  const foodBrand = careProfile.data?.foodBrand ?? null;
  const foodImage = careProfile.data?.foodImageUrl ?? null;
  const kcalPer100g = careProfile.data?.foodKcalPer100g ?? null;
  const treatsAllowed = careProfile.data?.treatsPerDay ?? 4;
  const waterTarget = careProfile.data?.waterRefillsTarget ?? 2;
  const exerciseMinutes = careProfile.data?.dailyExerciseGoalMinutes ?? choice?.exerciseMinutes ?? 60;

  const plannedMealTimes = useMemo(
    () => plan.filter((row) => row.key.startsWith("meal-")).map((row) => row.time),
    [plan],
  );
  const serverTimes = careProfile.data?.mealTimes ?? null;
  const mealTimes =
    serverTimes && serverTimes.length > 0
      ? [...serverTimes].sort()
      : plannedMealTimes.length > 0
        ? plannedMealTimes
        : defaultMealTimes(mealsPerDay);
  const portions = careProfile.data?.mealPortions ?? choice?.mealPortions ?? null;
  const fallbackGrams = careProfile.data?.portionGramsPerMeal ?? choice?.portionGrams ?? 150;
  const planMeals: PlanMeal[] = useMemo(
    () => mealTimes.map((at, index) => ({ at, grams: portions?.[index] ?? fallbackGrams })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mealTimes.join("|"), (portions ?? []).join("|"), fallbackGrams],
  );
  const planGrams = planMeals.reduce((total, meal) => total + meal.grams, 0);

  const latestKg = useMemo(() => {
    const entry = (weights.data ?? [])[0];
    if (!entry) return null;
    const kg = entry.weightUnit === "kg" ? entry.weightValue : entry.weightValue * 0.4536;
    return Math.round(kg * 10) / 10;
  }, [weights.data]);

  const logs = todayLogs.data ?? [];
  const mealLogs = logs.filter((log) => log.logType === "meal");
  const treatLogs = logs.filter((log) => log.logType === "treat");
  const waterLogs = logs.filter((log) => log.logType === "water");
  const gramsToday = mealLogs.reduce((total, log) => total + (log.amountGrams ?? 0), 0);

  const planned = planMeals.map((meal, index) => {
    const name = mealName(index, planMeals.length);
    const log = mealLogs.find((entry) => entry.mealName === name) ?? null;
    return { ...meal, name, fed: Boolean(log), log };
  });
  const next = planned.find((meal, index) => !meal.fed && index > lastFed);
  const fedCount = planned.filter((meal) => meal.fed).length;
  const lastFed = planned.reduce((found, meal, index) => (meal.fed ? index : found), -1);
  const pastDue = (meal: (typeof planned)[number]) => !meal.fed && nowMinutes > minutesOf(meal.at) + GRACE_MINUTES;
  const skipped = planned.filter((meal, index) => pastDue(meal) && index < lastFed);
  const missed = planned.filter((meal, index) => pastDue(meal) && index > lastFed);
  const late = missed[missed.length - 1];
  const upcoming = planned.find((meal) => !meal.fed && !missed.includes(meal) && !skipped.includes(meal));
  const dry = waterLogs.length === 0 && nowMinutes >= WATER_BY;
  const treatsOver = treatLogs.length - treatsAllowed;

  const mode: Mode = late ? "late" : dry ? "dry" : next ? "next" : "done";

  const treatNames = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...(savedTreats.data ?? []).map((t) => t.name), ...(recentTreats.data ?? [])]) {
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push(name);
    }
    return out.slice(0, 10);
  }, [savedTreats.data, recentTreats.data]);

  const planTreats = useMemo(() => {
    const saved = (savedTreats.data ?? []).map((t) => ({
      key: t.id,
      name: t.name,
      removable: !t.id.startsWith("pending-"),
    }));
    const savedNames = new Set(saved.map((t) => t.name.toLowerCase()));
    const recent = (recentTreats.data ?? [])
      .filter((name) => !savedNames.has(name.toLowerCase()))
      .map((name) => ({ key: `recent:${name}`, name, removable: false }));
    return [...saved, ...recent].slice(0, 8);
  }, [savedTreats.data, recentTreats.data]);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = planned.map((meal) => ({
      key: `plan-${meal.name}`,
      at: meal.log ? hhmm(meal.log.createdAt) : meal.at,
      title: meal.name,
      detail: meal.log ? `${meal.log.amountGrams ?? meal.grams} g · planned ${prettyTime(meal.at)}` : `${meal.grams} g`,
      icon: BowlFoodIcon,
      state: meal.fed
        ? "done"
        : missed.includes(meal)
          ? "late"
          : skipped.includes(meal)
            ? "skipped"
            : meal === upcoming
              ? "next"
              : "later",
      log: meal.log,
    }));
    mealLogs
      .filter((log) => !planned.some((m) => m.log?.id === log.id))
      .forEach((log) =>
        items.push({
          key: log.id,
          at: hhmm(log.createdAt),
          title: log.mealName ?? "Meal",
          detail: log.amountGrams ? `${log.amountGrams} g` : null,
          icon: BowlFoodIcon,
          state: "done",
          log,
        }),
      );
    treatLogs.forEach((log) =>
      items.push({
        key: log.id,
        at: hhmm(log.createdAt),
        title: log.mealName ?? "Treat",
        detail: "Treat",
        icon: PawPrintIcon,
        state: "done",
        log,
      }),
    );
    waterLogs.forEach((log) =>
      items.push({
        key: log.id,
        at: hhmm(log.createdAt),
        title: "Water refilled",
        detail: null,
        icon: DropIcon,
        state: "done",
        log,
      }),
    );
    return items.sort((a, b) => minutesOf(a.at) - minutesOf(b.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, planMeals, nowMinutes]);

  const savePlan = (update: { meals: readonly PlanMeal[]; treatsPerDay: number }) => {
    const times = update.meals.map((meal) => meal.at);
    const grams = update.meals.map((meal) => meal.grams);
    const average = Math.round(grams.reduce((a, b) => a + b, 0) / Math.max(1, grams.length));
    extendCarePlan("meals", { mealTimes: times, mealPortions: grams, mealsPerDay: times.length, portionGrams: average });
    saveMealPlan.mutate({ mealTimes: times, mealPortions: grams, treatsPerDay: update.treatsPerDay });
  };

  const logMeal = (meal: { name: string; grams: number }) => {
    setCheer((n) => n + 1);
    logFeeding.mutate({ logType: "meal", mealName: meal.name, amountGrams: meal.grams });
  };

  const feedNext = () => {
    const target = late ?? next;
    if (missed.length > 1 && late) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      logMeal(late);
      return;
    }
    if (!target) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    logMeal(target);
  };

  const logWater = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    logFeeding.mutate({ logType: "water" });
  };

  const remove = (log: FeedingLog) => {
    if (log.id.startsWith("pending-")) return;
    void Haptics.selectionAsync();
    setNotice(null);
    deleteFeeding.mutate(log.id, {
      onError: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setNotice("That entry could not be removed. Try again in a moment.");
        setTimeout(() => setNotice(null), 4000);
      },
    });
  };

  const undoLastMeal = () => {
    const last = [...mealLogs].reverse()[0];
    if (last) remove(last);
  };

  const logTreat = (name: string | null) => {
    setTreatSheet(false);
    logFeeding.mutate({ logType: "treat", mealName: name }, { onSuccess: () => refreshRecentTreats() });
  };

  const page = width - layout.gutter * 2;
  const artWidth = Math.min(Math.round(page * 0.34), 124);

  const pager = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(0);
  const firstHeight = useSharedValue(0);
  const secondHeight = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.x;
  });

  const measure = (target: SharedValue<number>) => (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0) return;
    target.value =
      target.value === 0 || reduceMotion
        ? height
        : withTiming(height, { duration: motion.duration.enter, easing: motion.easing.out });
  };

  const frame = useAnimatedStyle(() => {
    if (firstHeight.value === 0 || secondHeight.value === 0) return {};
    return {
      height: interpolate(offset.value, [0, page], [firstHeight.value, secondHeight.value], Extrapolation.CLAMP),
    };
  });

  const goTo = (index: number) => {
    void Haptics.selectionAsync();
    pager.current?.scrollTo({ x: index * page, animated: !reduceMotion });
    setPageIndex(index);
  };

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter);
  const enter = (order: number) =>
    reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

  const hero =
    mode === "late" && late
      ? {
          flag: "Overdue",
          title: missed.length > 1 ? `${missed.length} meals missed` : `${late.name} is late`,
          when:
            missed.length > 1
              ? `${missed.map((meal) => meal.name).join(" and ")} not logged today`
              : `Due at ${prettyTime(late.at)}, ${ago(nowMinutes - minutesOf(late.at))}`,
          what: `${late.grams} g${foodBrand ? ` · ${foodBrand}` : ""}`,
        }
      : mode === "dry"
        ? {
            flag: "Needs water",
            title: "No water yet",
            when: "Nothing refilled today",
            what: "Fresh water first, then the rest of the day",
          }
        : mode === "next" && next
          ? {
              flag: null,
              title: next.name,
              when: `Today at ${prettyTime(next.at)}`,
              what: `${next.grams} g${foodBrand ? ` · ${foodBrand}` : ""}`,
            }
          : {
              flag: null,
              title: skipped.length > 0 ? "Done for today" : "All fed",
              when: planned[0] ? `${planned[0].name} tomorrow at ${prettyTime(planned[0].at)}` : "No meals planned",
              what:
                gramsToday >= planGrams
                  ? `${gramsToday} g in, as planned`
                  : `${gramsToday} of ${planGrams} g in today`,
            };

  return (
    <View>
      <Tabs offset={offset} page={page} onSelect={goTo} />

      <Animated.View entering={enter(0)} style={[styles.frame, frame]}>
        <Animated.ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => setPageIndex(Math.round(event.nativeEvent.contentOffset.x / page))}
          contentContainerStyle={styles.pages}
        >
          <View style={{ width: page }} onLayout={measure(firstHeight)}>
            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Animated.View
                  key={`${mode}-${hero.title}`}
                  entering={
                    reduceMotion
                      ? undefined
                      : FadeIn.duration(motion.duration.enter).withInitialValues({
                          opacity: 0,
                          transform: [{ translateY: 8 }],
                        })
                  }
                >
                  {hero.flag ? (
                    <UrgentFlag label={hero.flag} />
                  ) : (
                    <Text style={styles.eyebrow}>{mode === "next" ? "NEXT MEAL" : "ALL DONE"}</Text>
                  )}
                  <Text style={styles.headline}>{hero.title}</Text>
                  <Fact glyph={CalendarBlankIcon} value={hero.when} strong={mode === "late"} />
                  <Fact glyph={mode === "dry" ? DropIcon : BowlFoodIcon} value={hero.what} />
                </Animated.View>

                {mode === "dry" ? (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Log a water refill"
                    scaleTo={0.97}
                    style={styles.primary}
                    onPress={logWater}
                  >
                    <DropIcon size={iconSize.button} color={text.primary} weight="bold" />
                    <Text style={styles.primaryText}>Refilled</Text>
                  </PressScale>
                ) : mode === "done" ? (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Undo the last meal"
                    scaleTo={0.97}
                    style={styles.quiet}
                    onPress={undoLastMeal}
                  >
                    <Text style={styles.quietText}>Undo last meal</Text>
                  </PressScale>
                ) : (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={mode === "late" ? `Feed ${late?.name.toLowerCase()} now` : `Mark ${next?.name.toLowerCase()} as fed`}
                    scaleTo={0.97}
                    style={styles.primary}
                    onPress={feedNext}
                  >
                    <BowlFoodIcon size={iconSize.button} color={text.primary} weight="bold" />
                    <Text style={styles.primaryText}>{mode === "late" ? "Feed now" : "Mark as fed"}</Text>
                  </PressScale>
                )}
              </View>

              <View style={styles.art}>
                <FeedArt width={artWidth} cheer={cheer} />
              </View>
            </View>

            <View style={styles.day}>
              <Tally
                glyph={ForkKnifeIcon}
                label="Meals"
                detail={
                  late
                    ? missed.length > 1
                      ? `${missed.length} meals missed`
                      : `${late.name} is late`
                    : fedCount >= planned.length
                      ? "all in"
                      : next
                        ? `${planned.filter((meal, index) => !meal.fed && index > lastFed).length} to go`
                        : `${skipped.length} skipped today`
                }
                urgent={Boolean(late)}
                filled={fedCount}
                total={planned.length}
                order={0}
                action="Log a meal"
                onPress={() => {
                  void Haptics.selectionAsync();
                  setMealSheet(true);
                }}
              />
              <Tally
                glyph={PawPrintIcon}
                label="Treats"
                detail={treatsOver > 0 ? `${treatsOver} over today` : `${-treatsOver} left today`}
                urgent={treatsOver > 0}
                filled={treatLogs.length}
                total={Math.max(treatsAllowed, treatLogs.length)}
                limit={treatsAllowed}
                order={1}
                action="Log a treat"
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTreatSheet(true);
                }}
              />
              <Tally
                glyph={DropIcon}
                label="Water"
                detail={
                  dry
                    ? "not refilled yet"
                    : waterLogs.length >= waterTarget
                      ? "topped up"
                      : "needs a refill"
                }
                urgent={dry}
                filled={waterLogs.length}
                total={Math.max(waterTarget, waterLogs.length)}
                order={2}
                action="Log a water refill"
                onPress={logWater}
              />
            </View>

            {notice ? (
              <Animated.View
                entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
                exiting={reduceMotion ? undefined : FadeOut.duration(140)}
                style={styles.notice}
              >
                <Text style={styles.noticeText}>{notice}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.ask}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Can ${dogName} eat this? Ask about a food`}
                scaleTo={0.98}
                style={styles.askField}
                onPress={() => onOpen("/care/food-check")}
              >
                <MagnifyingGlassIcon size={iconSize.standard} color={text.secondary} weight="bold" />
                <Text style={styles.askText} numberOfLines={1}>
                  Can {dogName} eat this?
                </Text>
              </PressScale>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Take a photo of a food to check it for ${dogName}`}
                scaleTo={0.92}
                style={styles.askCamera}
                onPress={() => onOpen("/care/food-check?start=camera")}
              >
                <CameraIcon size={iconSize.standard} color={text.primary} weight="bold" />
              </PressScale>
            </View>

            <Text style={styles.timelineTitle}>Today&rsquo;s timeline</Text>
            <Animated.View layout={settle} style={styles.timeline}>
              {timeline.map((item, index) => (
                <TimelineRow
                  key={item.key}
                  item={item}
                  first={index === 0}
                  last={index === timeline.length - 1}
                  onRemove={item.log ? () => remove(item.log as FeedingLog) : undefined}
                />
              ))}
            </Animated.View>
          </View>

          <View style={{ width: page }} onLayout={measure(secondHeight)}>
            <View style={styles.planPage}>
              <FoodPlanEditor
                dogName={dogName}
                meals={planMeals}
                treatsPerDay={treatsAllowed}
                fed={planned.map((meal) => meal.fed)}
                active={pageIndex === 1}
                food={foodBrand ? { name: foodBrand, imageUrl: foodImage, kcalPer100g } : null}
                treats={planTreats}
                onSave={savePlan}
                onChangeFood={() => onOpen("/care/food-search")}
                onAddTreat={() => onOpen("/care/food-search?mode=treat&intent=save")}
                onRemoveTreat={(key) => removeTreat.mutate(key)}
              >
                <DogNeeds
                  dogName={dogName}
                  weightKg={latestKg}
                  ageYears={dog.data ? ageFrom(dog.data.birthday, dog.data.ageYears) : null}
                  planGrams={planGrams}
                  kcalPer100g={kcalPer100g}
                  hasFood={Boolean(foodBrand)}
                  exerciseMinutes={exerciseMinutes}
                  active={pageIndex === 1}
                  onLogWeight={() => onOpen("/care/weight-log")}
                  onPickFood={() => onOpen("/care/food-search")}
                />
              </FoodPlanEditor>
            </View>
          </View>
        </Animated.ScrollView>
      </Animated.View>

      <MealLogSheet
        visible={mealSheet}
        choices={planned.map((meal) => ({ name: meal.name, grams: meal.grams, fed: meal.fed }))}
        onLog={(meal) => {
          setMealSheet(false);
          logMeal(meal);
        }}
        onClose={() => setMealSheet(false)}
      />

      <TreatSheet
        visible={treatSheet}
        dogName={dogName}
        given={treatLogs.length}
        allowed={treatsAllowed}
        treats={treatNames}
        onLog={logTreat}
        onSearch={() => {
          setTreatSheet(false);
          onOpen("/care/food-search?mode=treat&intent=log");
        }}
        onClose={() => setTreatSheet(false)}
      />
    </View>
  );
});

FeedView.displayName = "FeedView";

const Tabs = ({
  offset,
  page,
  onSelect,
}: {
  offset: SharedValue<number>;
  page: number;
  onSelect: (index: number) => void;
}) => {
  const [slots, setSlots] = useState<{ x: number; w: number }[]>([]);
  const first = slots[0];
  const second = slots[1];

  const bar = useAnimatedStyle(() => {
    if (!first || !second) return { opacity: 0 };
    const p = Math.min(1, Math.max(0, offset.value / page));
    const stretch = 1 - Math.abs(p - 0.5) * 2;
    return {
      opacity: 1,
      width: interpolate(p, [0, 1], [first.w, second.w]) + stretch * 24,
      transform: [{ translateX: interpolate(p, [0, 1], [first.x, second.x]) - stretch * 12 }],
    };
  });

  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {TABS.map((label, index) => (
        <TabLabel
          key={label}
          label={label}
          index={index}
          offset={offset}
          page={page}
          onPress={() => onSelect(index)}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout;
            setSlots((current) => {
              if (current[index]?.x === x && current[index]?.w === width) return current;
              const updated = [...current];
              updated[index] = { x, w: width };
              return updated;
            });
          }}
        />
      ))}
      <Animated.View style={[styles.tabBar, bar]} pointerEvents="none" />
    </View>
  );
};

const TabLabel = ({
  label,
  index,
  offset,
  page,
  onPress,
  onLayout,
}: {
  label: string;
  index: number;
  offset: SharedValue<number>;
  page: number;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) => {
  const tone = useAnimatedStyle(() => {
    const distance = Math.min(1, Math.abs(offset.value / page - index));
    return {
      color: interpolateColor(distance, [0, 1], [text.primary, text.disabled]),
      transform: [{ scale: 1 - distance * 0.04 }],
    };
  });
  return (
    <PressScale
      accessibilityRole="tab"
      accessibilityLabel={label}
      scaleTo={0.95}
      style={styles.tab}
      onPress={onPress}
      onLayout={onLayout}
    >
      <Animated.Text style={[styles.tabText, tone]}>{label}</Animated.Text>
    </PressScale>
  );
};

const UrgentFlag = ({ label }: { label: string }) => {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.7 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.4 }],
  }));
  return (
    <View style={styles.flag} accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.flagDotWrap}>
        <Animated.View style={[styles.flagRing, ring]} />
        <View style={styles.flagDot} />
      </View>
      <Text style={styles.flagText}>{label.toUpperCase()}</Text>
    </View>
  );
};

const Fact = ({
  glyph: Glyph,
  value,
  strong = false,
}: {
  glyph: typeof BowlFoodIcon;
  value: string;
  strong?: boolean;
}) => (
  <View style={styles.fact}>
    <Glyph size={iconSize.inline} color={strong ? text.primary : text.tertiary} weight={strong ? "bold" : "regular"} />
    <Text style={[styles.factText, strong && styles.factStrong]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const Tally = ({
  glyph: Glyph,
  label,
  detail,
  urgent,
  filled,
  total,
  limit,
  order,
  action,
  onPress,
}: {
  glyph: typeof ForkKnifeIcon;
  label: string;
  detail: string;
  urgent: boolean;
  filled: number;
  total: number;
  limit?: number;
  order: number;
  action: string;
  onPress: () => void;
}) => (
  <PressScale
    accessibilityRole="button"
    accessibilityLabel={`${action}. ${label}: ${filled} of ${limit ?? total}, ${detail}`}
    scaleTo={0.98}
    style={styles.tally}
    onPress={onPress}
  >
    <View style={[styles.tallyDisc, urgent && styles.tallyDiscUrgent]}>
      <Glyph size={iconSize.standard} color={urgent ? text.inverse : text.primary} weight="regular" />
    </View>
    <View style={styles.tallyCopy}>
      <Text style={styles.tallyLabel}>{label}</Text>
      <Animated.Text
        key={detail}
        entering={FadeIn.duration(motion.duration.select)}
        style={[styles.tallyDetail, urgent && styles.tallyUrgent]}
        numberOfLines={1}
      >
        {detail}
      </Animated.Text>
    </View>
    <View style={styles.segments}>
      {Array.from({ length: Math.max(1, total) }, (_, i) => (
        <Segment
          key={i}
          on={i < filled}
          over={limit !== undefined && i >= limit}
          late={urgent && i === filled && limit === undefined}
          order={order * 2 + i}
        />
      ))}
    </View>
  </PressScale>
);

const Segment = ({ on, over, late, order }: { on: boolean; over: boolean; late: boolean; order: number }) => {
  const reduceMotion = useReducedMotion();
  const grow = useDerivedValue(
    () =>
      reduceMotion
        ? on ? 1 : 0
        : withDelay(order * 45, withTiming(on ? 1 : 0, { duration: motion.duration.enter, easing: motion.easing.out })),
    [on, order, reduceMotion],
  );
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  return (
    <View style={[styles.segmentTrack, late && styles.segmentLate]}>
      <Animated.View style={[styles.segmentFill, over && styles.segmentOver, fill]} />
    </View>
  );
};

const TimelineRow = ({
  item,
  first,
  last,
  onRemove,
}: {
  item: TimelineItem;
  first: boolean;
  last: boolean;
  onRemove?: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const Icon = item.icon;
  const done = item.state === "done";
  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
      exiting={reduceMotion ? undefined : FadeOut.duration(140)}
      style={styles.tlRow}
      accessibilityLabel={`${prettyTime(item.at)}, ${item.title}${item.detail ? `, ${item.detail}` : ""}. ${item.state === "late" ? "Late" : done ? "Done" : item.state === "next" ? "Next" : "Coming up"}`}
    >
      <Text style={[styles.tlTime, done && styles.tlTimeDone, item.state === "late" && styles.tlTimeLate]}>
        {prettyTime(item.at)}
      </Text>
      <View style={styles.tlRail}>
        <View style={[styles.tlLine, first && styles.tlHidden]} />
        <View
          style={[
            styles.tlDot,
            done && styles.tlDotDone,
            item.state === "next" && styles.tlDotNext,
            item.state === "late" && styles.tlDotLate,
          ]}
        >
          {done ? <Icon size={10} color={text.primary} weight="fill" /> : null}
        </View>
        <View style={[styles.tlLine, last && styles.tlHidden]} />
      </View>
      <View style={styles.tlCopy}>
        <View style={styles.tlHead}>
          <Text style={[styles.tlTitle, done && styles.tlTitleDone]} numberOfLines={1}>
            {item.title}
          </Text>
          {item.state === "late" ? (
            <View style={[styles.tlChip, styles.tlChipLate]}>
              <Text style={[styles.tlChipText, styles.tlChipTextLate]}>Late</Text>
            </View>
          ) : item.state === "skipped" ? (
            <View style={[styles.tlChip, styles.tlChipSkipped]}>
              <Text style={[styles.tlChipText, styles.tlChipTextSkipped]}>Skipped</Text>
            </View>
          ) : item.state === "next" ? (
            <View style={styles.tlChip}>
              <Text style={styles.tlChipText}>Next</Text>
            </View>
          ) : null}
        </View>
        {item.detail ? <Text style={styles.tlDetail}>{item.detail}</Text> : null}
      </View>
      {onRemove ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.title} at ${prettyTime(item.at)}`}
          hitSlop={10}
          scaleTo={0.88}
          style={styles.tlRemove}
          onPress={onRemove}
        >
          <XIcon size={11} color={text.tertiary} weight="bold" />
        </PressScale>
      ) : null}
    </Animated.View>
  );
};

const DOT = 18;

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: space.xl, marginTop: space.md, paddingBottom: space.sm },
  tab: { paddingVertical: space.xs },
  tabText: { fontSize: 24, lineHeight: 29, letterSpacing: -0.6, fontWeight: "700", transformOrigin: "left" },
  tabBar: {
    position: "absolute",
    left: 0,
    bottom: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: accent.deep,
  },

  frame: { overflow: "hidden", marginTop: space.lg },
  pages: { alignItems: "flex-start" },

  hero: { flexDirection: "row", alignItems: "stretch", gap: space.md },
  heroCopy: { flex: 1, paddingBottom: space.xs },
  art: { justifyContent: "flex-end" },
  eyebrow: { ...type.eyebrow, color: text.tertiary },
  headline: { ...type.hero, color: text.primary, marginTop: space.xs },
  fact: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.sm },
  factText: { ...type.supporting, color: text.secondary, flexShrink: 1 },
  factStrong: { color: text.primary, fontWeight: "600" },

  flag: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
  },
  flagDotWrap: { width: 8, height: 8, alignItems: "center", justifyContent: "center" },
  flagDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.deep },
  flagRing: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: accent.deep },
  flagText: { ...type.eyebrow, fontSize: 11, color: text.inverse },

  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    marginTop: space.lg,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  primaryText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  quiet: {
    height: layout.controlHeight,
    marginTop: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  quietText: { ...type.supporting, fontWeight: "500", color: text.secondary },

  day: { marginTop: space.section, gap: space.xs },
  tally: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  tallyDisc: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  tallyDiscUrgent: { backgroundColor: text.primary },
  tallyCopy: { flex: 1 },
  tallyLabel: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  tallyDetail: { ...type.caption, color: text.tertiary, marginTop: 1 },
  tallyUrgent: { color: text.primary, fontWeight: "700" },
  segments: { flexDirection: "row", gap: 4, width: 92, justifyContent: "flex-end" },
  segmentTrack: {
    flex: 1,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: border.soft,
    overflow: "hidden",
  },
  segmentLate: { borderWidth: 1.5, borderColor: text.primary, backgroundColor: bg.canvas },
  segmentFill: {
    height: "100%",
    width: "100%",
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    transform: [{ scaleX: 0 }],
    transformOrigin: "left",
  },
  segmentOver: { backgroundColor: text.primary },

  notice: {
    marginTop: space.lg,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    backgroundColor: text.primary,
  },
  noticeText: { ...type.supporting, color: text.inverse },

  ask: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  askField: {
    flex: 1,
    height: layout.controlHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: text.primary,
    backgroundColor: bg.canvas,
  },
  askText: { ...type.cardTitle, fontWeight: "600", color: text.primary, flex: 1 },
  askCamera: {
    width: layout.controlHeight,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },

  timelineTitle: { ...type.sectionTitle, color: text.primary, marginTop: space.section },
  timeline: { marginTop: space.md, paddingBottom: space.xs },
  tlRow: { flexDirection: "row", alignItems: "stretch", minHeight: 58 },
  tlTime: {
    width: 64,
    paddingTop: 17,
    ...type.caption,
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
  tlTimeDone: { color: text.tertiary },
  tlTimeLate: { color: text.primary, fontWeight: "700" },
  tlRail: { width: 28, alignItems: "center" },
  tlLine: { flex: 1, width: 1.5, backgroundColor: border.soft },
  tlHidden: { backgroundColor: "transparent" },
  tlDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: border.default,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  tlDotDone: { borderColor: accent.primary, backgroundColor: accent.primary },
  tlDotNext: { borderColor: accent.deep, backgroundColor: accent.deep },
  tlDotLate: { borderColor: text.primary, borderWidth: 3 },
  tlCopy: { flex: 1, paddingVertical: space.md, paddingLeft: space.xs },
  tlHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tlTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary, flexShrink: 1 },
  tlTitleDone: { color: text.secondary, fontWeight: "500" },
  tlDetail: { ...type.caption, color: text.tertiary, marginTop: 1 },
  tlChip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: accent.primary },
  tlChipLate: { backgroundColor: text.primary },
  tlChipSkipped: { backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.default },
  tlChipTextSkipped: { color: text.secondary },
  tlChipText: { ...type.caption, fontWeight: "700", color: text.primary },
  tlChipTextLate: { color: text.inverse },
  tlRemove: {
    alignSelf: "center",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  planPage: { paddingBottom: space.xs },
});
