import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BowlFoodIcon,
  HeartbeatIcon,
  SunIcon,
  CaretLeftIcon,
  CheckIcon,
  PersonSimpleWalkIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  PillIcon,
  PlusIcon,
  ScissorsIcon,
  SyringeIcon,
  XIcon,
} from "phosphor-react-native";

import { CareSetupStart } from "@/features/care/components/CareSetupStart";
import { completeGroomingSetup, markGroomingMissedOnboarding } from "@/features/care/state/groomingSetup";
import { afterDinner, enableDailyCheckIn, useCheckInSettings } from "@/features/care/state/dailyCheckIn";
import { APPETITE } from "@/features/care/components/DailyHealthCheckSheet";
import { DayTimeline } from "@/features/care/components/DayTimeline";
import { TimeGrid } from "@/features/care/components/TimeGrid";
import { KitArt } from "@/features/care/components/KitArt";
import {
  CADENCE_LABEL,
  MED_CATEGORIES,
  MED_DISCLAIMER,
  searchMedicines,
  type MedCategory,
  type Medicine,
} from "@/constants/medicationCatalog";
import { ClinicCard } from "@/features/care/components/ClinicCard";
import { ProductRail } from "@/features/care/components/ProductRail";
import { useKitOffers } from "@/hooks/useKitOffers";
import { lookupPostcode, type Lookup } from "@/services/postcodeService";
import type { Feed } from "@/services/serpApi";
import {
  CLINIC_DISCLAIMER,
  findClinics,
  type Booking,
  type Clinic,
} from "@/services/vetDirectory";
import {
  GROOMING_KIT,
  ageInMonths,
  medicationPlan,
  stageLabel,
  stageOf,
  vaccinePlan,
  type PlanItem,
} from "@/constants/carePlanByAge";
import {
  AREAS,
  GROUPS,
  VACCINE_RECENCY,
  groupOn,
  toggleGroup,
  initialAnswers,
  minutesOf,
  optimiseDay,
  prettyTime,
  screensFor,
  type Answers,
  type AreaKey,
} from "@/features/care/components/careSetupAnswers";
import { PressScale } from "@/components/ui/PressScale";
import { ROUTINE_LIBRARY, recommendedPlan } from "@/constants/careSetup";
import { useSaveCareRoutineSetup } from "@/hooks/useCareEvents";
import { useUpsertCareProfile } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import {
  completeCareOnboarding,
  extendCarePlan,
  useCareOnboarding,
  type CareAppointment,
  type CarePlanChoice,
} from "@/features/care/state/careOnboarding";
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

const MED_PRESETS = ["Apoquel", "NexGard", "Heartgard", "Simparica", "Bravecto"];

type PhosphorIcon = typeof PillIcon;

const GLYPH: Record<string, PhosphorIcon> = {
  walk: PersonSimpleWalkIcon,
  food: BowlFoodIcon,
  scissors: ScissorsIcon,
  pill: PillIcon,
  syringe: SyringeIcon,
  sun: SunIcon,
  cycle: ArrowsClockwiseIcon,
  heart: HeartbeatIcon,
};

export const CareSetupFlow = ({
  onDone,
  onClose,
  only,
  bottomInset = 0,
}: {
  onDone: () => void;
  onClose?: () => void;
  only?: AreaKey;
  bottomInset?: number;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const weights = useWeightLogs(dogId);

  const saveRoutines = useSaveCareRoutineSetup(dogId);
  const saveProfile = useUpsertCareProfile(dogId);

  const name = dog.data?.name ?? "your dog";
  const latestKg = useMemo(() => {
    const entry = (weights.data ?? [])[0];
    if (!entry) return null;
    return entry.weightUnit === "kg" ? entry.weightValue : entry.weightValue * 0.4536;
  }, [weights.data]);

  const plan = useMemo(
    () => recommendedPlan(dog.data?.breed ?? "", latestKg),
    [dog.data?.breed, latestKg],
  );

  const stage = useMemo(
    () => stageOf(ageInMonths(dog.data?.birthday ?? null, dog.data?.ageYears ?? null)),
    [dog.data?.birthday, dog.data?.ageYears],
  );

  const existing = useCareOnboarding().choice;
  const checkInSettings = useCheckInSettings();
  const [a, setA] = useState<Answers>(() =>
    only
      ? {
          ...initialAnswers(),
          areas: [only],
          walkTimes: [...(existing?.walkTimes ?? [])],
          mealTimes: [...(existing?.mealTimes ?? [])],
        }
      : initialAnswers(),
  );
  const medField = useRef<TextInput>(null);
  const [step, setStep] = useState(only ? 0 : -1);
  const [direction, setDirection] = useState(1);

  const best = useMemo(() => optimiseDay(a.work), [a.work]);

  const dayEvents = useMemo(
    () => [
      ...a.walkTimes.map((time) => ({ key: `walk-${time}`, time, label: "Walk" })),
      ...a.mealTimes.map((time) => ({ key: `meal-${time}`, time, label: "Meal" })),
      ...(a.onMeds
        ? a.medTimes.map((time) => ({
            key: `med-${time}`,
            time,
            label: a.medName.trim() || "Medication",
          }))
        : []),
    ],
    [a.walkTimes, a.mealTimes, a.medTimes, a.onMeds, a.medName],
  );

  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const prefix: Record<string, string> = {
    walkTimes: "walk",
    mealTimes: "meal",
    medTimes: "med",
  };

  const pick = (key: "walkTimes" | "mealTimes" | "medTimes", time: string) => {
    const adding = !a[key].includes(time);
    toggle(key, time);
    setLastAdded(adding ? `${prefix[key]}-${time}` : null);
  };

  const apply = (key: "walkTimes" | "mealTimes" | "medTimes", times: readonly string[]) => {
    setA((current) => ({ ...current, [key]: [...times] }));
    setLastAdded(`${prefix[key]}-${times[times.length - 1]}`);
  };

  const missingCore = useMemo(
    () => vaccinePlan(stage).filter((item) => item.required && !a.vaccines.includes(item.key)),
    [stage, a.vaccines],
  );

  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  useEffect(() => {
    const raw = a.postcode.trim();
    if (raw.length < 3) {
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "looking" });
    let live = true;
    const timer = setTimeout(() => {
      void lookupPostcode(raw).then((result) => {
        if (live) setLookup(result);
      });
    }, 450);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [a.postcode]);

  const hits = useMemo(
    () => searchMedicines(a.medCustom, (a.medFilter ?? null) as MedCategory | null),
    [a.medCustom, a.medFilter],
  );

  const [clinics, setClinics] = useState<Feed<Clinic>>({ state: "idle" });
  const place = lookup.state === "found" ? lookup.place : null;

  useEffect(() => {
    if (!place) {
      setClinics({ state: "idle" });
      return;
    }

    let live = true;
    setClinics({ state: "loading" });
    void findClinics(place).then((result) => {
      if (live) setClinics(result);
    });

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.latitude, place?.longitude]);

  const screens = useMemo(
    () =>
      screensFor({
        areas: a.areas,
        grooming: a.grooming,
        needsVaccine: a.areas.includes("vaccines") && missingCore.length > 0,
      }).filter(
        (key) => !only || (key !== "areas" && (key !== "checkin" || !checkInSettings.enabled)),
      ),
    [a.areas, a.grooming, missingCore.length, only, checkInSettings.enabled],
  );

  const total = screens.length;
  const last = step === total - 1;
  const screen = screens[step] ?? "areas";

  const go = (next: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const toggle = <K extends keyof typeof a>(key: K, value: string) => {
    void Haptics.selectionAsync();
    setA((current) => {
      const list = current[key] as unknown as string[];
      return {
        ...current,
        [key]: list.includes(value)
          ? list.filter((item) => item !== value)
          : [...list, value],
      };
    });
  };

  const finishWith = (answers: typeof a) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (only) {
      finishArea(answers, only);
      return;
    }
    const keys = [
      ...(answers.areas.includes("walks") ? ["walk"] : []),
      ...(answers.areas.includes("meals") ? ["feeding", "water"] : []),
      ...(answers.areas.includes("grooming") ? ["mental_stimulation"] : []),
    ];
    saveProfile.mutate({
      dailyExerciseGoalMinutes: plan.exerciseMinutes,
      mealsPerDay: Math.max(1, answers.mealTimes.length),
      portionGramsPerMeal: Math.round(plan.dailyGrams / Math.max(1, answers.mealTimes.length) / 5) * 5,
      onboardingCompleted: true,
    });
    saveRoutines.mutate(
      ROUTINE_LIBRARY.filter((item) => keys.includes(item.routineKey)).map(
        ({ why: _why, ...draft }, index) => ({ ...draft, sortOrder: index }),
      ),
    );
    completeCareOnboarding({
      areas: answers.areas,
      exerciseMinutes: plan.exerciseMinutes,
      mealsPerDay: Math.max(1, answers.mealTimes.length),
      portionGrams: Math.round(plan.dailyGrams / Math.max(1, answers.mealTimes.length) / 5) * 5,
      routineKeys: keys,
      walkTimes: answers.walkTimes,
      mealTimes: answers.mealTimes,
      grooming: answers.areas.includes("grooming") ? answers.grooming : [],
      medName: answers.onMeds ? answers.medName.trim() : "",
      medTimes: answers.onMeds ? answers.medTimes : [],
      vaccines: answers.areas.includes("vaccines") ? answers.vaccines : [],
      kitNeeded: answers.grooming.filter((key) => !answers.kitOwned.includes(key)),
      kitHowTo: answers.kitHowTo,
      appointment: bookedAppointment(answers),
      pendingVaccines: answers.areas.includes("vaccines")
        ? missingCore.filter((item) => !answers.vaccines.includes(item.key)).map((item) => item.label)
        : [],
    });
    if (answers.areas.includes("grooming")) completeGroomingSetup();
    else markGroomingMissedOnboarding();
    if (answers.areas.includes("meds") || answers.areas.includes("vaccines")) {
      enableDailyCheckIn(answers.checkinTime ?? afterDinner(answers.mealTimes));
    }
    onDone();
  };

  const finishArea = (answers: typeof a, area: AreaKey) => {
    const meals = Math.max(1, answers.mealTimes.length);
    const pending = missingCore
      .filter((item) => !answers.vaccines.includes(item.key))
      .map((item) => item.label);
    const patch: Partial<CarePlanChoice> =
      area === "walks"
        ? { walkTimes: answers.walkTimes, routineKeys: ["walk"] }
        : area === "meals"
          ? {
              mealTimes: answers.mealTimes,
              mealsPerDay: meals,
              portionGrams: Math.round(plan.dailyGrams / meals / 5) * 5,
              routineKeys: ["feeding", "water"],
            }
          : area === "grooming"
            ? {
                grooming: answers.grooming,
                kitNeeded: answers.grooming.filter((key) => !answers.kitOwned.includes(key)),
                kitHowTo: answers.kitHowTo,
              }
            : area === "meds"
              ? { medName: answers.onMeds ? answers.medName.trim() : "", medTimes: answers.medTimes }
              : {
                  vaccines: answers.vaccines,
                  pendingVaccines: pending,
                  ...(answers.booked ? { appointment: bookedAppointment(answers) } : {}),
                };

    const keys = [...new Set([...(existing?.routineKeys ?? []), ...(patch.routineKeys ?? [])])];
    if (keys.length !== (existing?.routineKeys ?? []).length) {
      saveRoutines.mutate(
        ROUTINE_LIBRARY.filter((item) => keys.includes(item.routineKey)).map(
          ({ why: _why, ...draft }, index) => ({ ...draft, sortOrder: index }),
        ),
      );
    }
    extendCarePlan(area, patch);
    if (area === "grooming") completeGroomingSetup();
    if ((area === "meds" || area === "vaccines") && !checkInSettings.enabled) {
      enableDailyCheckIn(answers.checkinTime ?? afterDinner(existing?.mealTimes ?? answers.mealTimes));
    }
    onDone();
  };

  const finish = () => finishWith(a);
  const leaving = Boolean(only) && step === 0;

  if (step === -1) {
    return (
      <CareSetupStart
        plan={plan}
        bottomInset={bottomInset}
        onStart={() => go(0)}
        onAutomatic={() => go(-2)}
      />
    );
  }

  if (step === -2) {
    const day = optimiseDay(a.work);
    const preview = [
      ...day.walkTimes.map((time, i) => ({
        key: `w${i}`,
        time,
        label: i === 0 ? "Morning walk" : "Evening walk",
      })),
      ...day.mealTimes.map((time, i) => ({
        key: `m${i}`,
        time,
        label: i === 0 ? "Breakfast" : "Dinner",
      })),
    ];

    const nudge = (field: "leave" | "home", delta: number) => {
      void Haptics.selectionAsync();
      setA((current) => {
        const next = minutesOf(current.work[field]) + delta;
        const clamped = Math.min(22 * 60, Math.max(5 * 60, next));
        return {
          ...current,
          work: {
            ...current.work,
            [field]: `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${
              clamped % 60 === 0 ? "00" : "30"
            }`,
          },
        };
      });
    };

    return (
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.roundButton}
            onPress={() => go(-1)}
          >
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
          <View style={styles.progress} />
          <View style={styles.headerSpacer} />
        </View>

        <Animated.ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + bottomInset + 128 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>When are you usually out?</Text>

          {(
            [
              { key: "leave", label: "Leave the house" },
              { key: "home", label: "Back home" },
            ] as const
          ).map((row) => (
            <View key={row.key} style={styles.workRow}>
              <View style={styles.workCopy}>
                <Text style={styles.workLabel}>{row.label}</Text>
                <Text style={styles.workValue}>{prettyTime(a.work[row.key])}</Text>
              </View>
              <View style={styles.workControls}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label} half an hour earlier`}
                  scaleTo={0.9}
                  style={styles.nudge}
                  onPress={() => nudge(row.key, -30)}
                >
                  <MinusIcon size={iconSize.standard} color={text.primary} weight="bold" />
                </PressScale>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label} half an hour later`}
                  scaleTo={0.9}
                  style={styles.nudge}
                  onPress={() => nudge(row.key, 30)}
                >
                  <PlusIcon size={iconSize.standard} color={text.primary} weight="bold" />
                </PressScale>
              </View>
            </View>
          ))}

          <Text style={styles.label}>The day PAWS would build</Text>
          <Animated.View
            layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
            style={styles.timelineWrap}
          >
            <DayTimeline events={preview} />
          </Animated.View>
        </Animated.ScrollView>

        <View style={[styles.dock, { paddingBottom: insets.bottom + bottomInset + space.lg }]}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Use this day"
            scaleTo={0.97}
            style={styles.next}
            onPress={() => {
              setA((current) => ({
                ...current,
                walkTimes: day.walkTimes,
                mealTimes: day.mealTimes,
                medTimes: day.medTimes,
              }));
              finishWith({ ...a, ...day });
            }}
          >
            <Text style={styles.nextText}>Use this day</Text>
            <CheckIcon size={iconSize.button} color={text.primary} weight="bold" />
          </PressScale>
        </View>
      </View>
    );
  }

  const area = screen;

  const ready =
    screen === "areas"
      ? a.areas.length > 0
      : screen === "walks"
        ? a.walkTimes.length > 0
        : screen === "meals"
          ? a.mealTimes.length > 0
          : screen === "vet-where"
            ? a.postcode.trim().length >= 3
            : true;

  const enter = reduceMotion
    ? undefined
    : (direction > 0 ? FadeInRight : FadeInLeft).duration(motion.duration.enter);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={
            leaving ? "Close" : step === 0 ? "Back to the start" : "Previous step"
          }
          style={styles.roundButton}
          onPress={() => (leaving ? onClose?.() : go(step - 1))}
        >
          {leaving ? (
            <XIcon size={iconSize.nav} color={text.primary} weight="bold" />
          ) : (
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          )}
        </PressScale>

        <Animated.View
          style={styles.progress}
          layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
        >
          {Array.from({ length: total }, (_, index) => (
            <Animated.View
              key={index}
              layout={
                reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)
              }
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
              style={[styles.segment, index <= step && styles.segmentOn]}
            />
          ))}
        </Animated.View>

        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + bottomInset + 128 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {dayEvents.length > 0 &&
        (screen === "walks" || screen === "meals" || screen === "meds") ? (
          <Animated.View
            layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
            style={styles.timelineWrap}
          >
            <DayTimeline events={dayEvents} highlight={lastAdded} />
          </Animated.View>
        ) : null}

        <Animated.View key={step} entering={enter}>
          {only && step === 0 ? <AddingBadge area={only} /> : null}

          {screen === "areas" ? (
            <>
              <Text style={styles.title}>What should PAWS help with?</Text>
              <Text style={styles.stageNote}>Pick any. You only set up what you choose.</Text>
              <View style={styles.groupList}>
                {GROUPS.map((group, index) => (
                  <GroupCard
                    key={group.key}
                    order={index}
                    label={group.label}
                    hint={group.hint}
                    glyph={group.glyph}
                    on={groupOn(a.areas, group.key)}
                    reduceMotion={reduceMotion}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setA((current) => ({ ...current, areas: toggleGroup(current.areas, group.key) }));
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          {area === "walks" ? (
            <>
              <Text style={styles.title}>When do you walk?</Text>
              <TimeGrid
                slots={a.walkTimes}
                suggested={best.walkTimes}
                onToggle={(slot) => pick("walkTimes", slot)}
                onSuggest={() => apply("walkTimes", best.walkTimes)}
                reduceMotion={reduceMotion}
                />
            </>
          ) : null}

          {area === "meals" ? (
            <>
              <Text style={styles.title}>When do you feed {name}?</Text>
              <TimeGrid
                slots={a.mealTimes}
                suggested={best.mealTimes}
                onToggle={(slot) => pick("mealTimes", slot)}
                onSuggest={() => apply("mealTimes", best.mealTimes)}
                reduceMotion={reduceMotion}
                />
            </>
          ) : null}

          {area === "grooming" ? (
            <>
              <Text style={styles.title}>Which do you do yourself?</Text>
              <Text style={styles.stageNote}>
                Pick one and PAWS names the kit. Leave it and it assumes a groomer.
              </Text>

              <View style={styles.kitList}>
                {GROOMING_KIT.map((job, index) => (
                  <KitCard
                    key={job.key}
                    job={job}
                    order={index}
                    on={a.grooming.includes(job.key)}
                    reduceMotion={reduceMotion}
                    onToggle={() => toggle("grooming", job.key)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {area === "meds" ? (
            <>
              <Text style={styles.title}>What {name} should be on</Text>
              <Text style={styles.stageNote}>
                The usual preventatives for {stageLabel[stage]}. Tick what is handled.
              </Text>

              <Animated.View
                layout={
                  reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)
                }
                style={styles.planTimeline}
              >
                <DayTimeline
                  events={medicationPlan(stage).map((item) => ({
                    key: item.key,
                    time: item.when,
                    label: item.label,
                    state: a.meds.includes(item.key) ? "done" : "todo",
                  }))}
                />
              </Animated.View>

              <PlanList
                items={medicationPlan(stage)}
                chosen={a.meds}
                doneLabel="On it"
                todoLabel="Not yet"
                onToggle={(key) => toggle("meds", key)}
                reduceMotion={reduceMotion}
              />

              <Text style={styles.label}>Anything else?</Text>
              <Text style={styles.stageNote}>
                Search by name, by what it is for, or by the active ingredient.
              </Text>

              <View style={styles.searchWrap}>
                <MagnifyingGlassIcon
                  size={iconSize.standard}
                  color={text.tertiary}
                  weight="bold"
                />
                <TextInput
                  ref={medField}
                  style={styles.searchInput}
                  value={a.medCustom}
                  onChangeText={(next) => setA((c) => ({ ...c, medCustom: next }))}
                  placeholder="Apoquel, itching, oclacitinib…"
                  placeholderTextColor={text.tertiary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {a.medCustom.length > 0 ? (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={10}
                    scaleTo={0.9}
                    onPress={() => setA((c) => ({ ...c, medCustom: "" }))}
                  >
                    <XIcon size={iconSize.inline} color={text.secondary} weight="bold" />
                  </PressScale>
                ) : null}
              </View>

              <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRail}
                contentContainerStyle={styles.filterRailInner}
              >
                {MED_CATEGORIES.map((item) => {
                  const on = a.medFilter === item.key;
                  return (
                    <PressScale
                      key={item.key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={item.label}
                      scaleTo={0.94}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setA((c) => ({ ...c, medFilter: on ? null : item.key }));
                      }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{item.label}</Text>
                    </PressScale>
                  );
                })}
              </Animated.ScrollView>

              <Animated.View
                layout={
                  reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)
                }
                style={styles.hits}
              >
                {hits.length === 0 && a.medCustom.trim().length > 1 ? (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${a.medCustom.trim()} as written`}
                    scaleTo={0.98}
                    style={styles.addOwn}
                    onPress={() => {
                      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setA((c) => ({
                        ...c,
                        medKeys: [...c.medKeys, `custom:${c.medCustom.trim()}`],
                        medCustom: "",
                      }));
                    }}
                  >
                    <PlusIcon size={iconSize.standard} color={text.primary} weight="bold" />
                    <View style={styles.addOwnCopy}>
                      <Text style={styles.addOwnTitle}>
                        Add &ldquo;{a.medCustom.trim()}&rdquo;
                      </Text>
                      <Text style={styles.addOwnNote}>
                        Not in the list. PAWS keeps your spelling
                      </Text>
                    </View>
                  </PressScale>
                ) : (
                  hits.slice(0, 8).map((medicine, index) => (
                    <MedHit
                      key={medicine.key}
                      medicine={medicine}
                      order={index}
                      on={a.medKeys.includes(medicine.key)}
                      reduceMotion={reduceMotion}
                      onToggle={() => {
                        void Haptics.selectionAsync();
                        setA((c) => ({
                          ...c,
                          medKeys: c.medKeys.includes(medicine.key)
                            ? c.medKeys.filter((key) => key !== medicine.key)
                            : [...c.medKeys, medicine.key],
                        }));
                      }}
                    />
                  ))
                )}
              </Animated.View>

              {a.medKeys.length > 0 ? (
                <Animated.View
                  entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
                  layout={
                    reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)
                  }
                >
                  <Text style={styles.label}>When?</Text>
                  <TimeGrid
                    slots={a.medTimes}
                    suggested={best.medTimes}
                    onToggle={(slot) => pick("medTimes", slot)}
                    onSuggest={() => apply("medTimes", best.medTimes)}
                    reduceMotion={reduceMotion}
                    />
                </Animated.View>
              ) : null}

              <Text style={styles.privacyNote}>{MED_DISCLAIMER}</Text>
            </>
          ) : null}

          {area === "vaccines" ? (
            <>
              <Text style={styles.title}>What {name} needs</Text>
              <Text style={styles.stageNote}>
                The schedule for {stageLabel[stage]}. Tick anything already done.
              </Text>

              <Animated.View
                layout={
                  reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)
                }
                style={styles.planTimeline}
              >
                <DayTimeline
                  events={vaccinePlan(stage).map((item) => ({
                    key: item.key,
                    time: item.when,
                    label: item.label,
                    state: a.vaccines.includes(item.key) ? "done" : "todo",
                  }))}
                />
              </Animated.View>

              <PlanList
                items={vaccinePlan(stage)}
                chosen={a.vaccines}
                doneLabel="Had it"
                todoLabel="Not yet"
                onToggle={(key) => toggle("vaccines", key)}
                reduceMotion={reduceMotion}
              />
            </>
          ) : null}

          {screen === "kit" ? (
            <>
              <Text style={styles.title}>Do you have the kit?</Text>
              <Text style={styles.stageNote}>
                Anything you are missing, PAWS will say what to look for.
              </Text>

              <View style={styles.kitList}>
                {GROOMING_KIT.filter((job) => a.grooming.includes(job.key)).map((job, index) => (
                  <KitRow
                    key={job.key}
                    job={job}
                    order={index}
                    owned={a.kitOwned.includes(job.key)}
                    wantsHow={a.kitHowTo.includes(job.key)}
                    reduceMotion={reduceMotion}
                    onOwn={() => toggle("kitOwned", job.key)}
                    onHow={() => toggle("kitHowTo", job.key)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {screen === "vet-where" ? (
            <>
              <Text style={styles.title}>Where should PAWS look?</Text>
              <Text style={styles.stageNote}>
                {missingCore.length === 1
                  ? `${missingCore[0].label} is still outstanding.`
                  : `${missingCore.length} core shots are still outstanding.`}
              </Text>

              <Text style={styles.label}>Postcode</Text>
              <TextInput
                style={[styles.input, styles.postcode]}
                value={a.postcode}
                onChangeText={(next) => setA((c) => ({ ...c, postcode: next.toUpperCase() }))}
                placeholder="94110"
                placeholderTextColor={text.tertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                maxLength={10}
              />

              <Animated.View
                layout={
                  reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)
                }
                style={styles.lookup}
              >
                {lookup.state === "looking" ? (
                  <Text style={styles.lookupWait}>Looking…</Text>
                ) : lookup.state === "found" ? (
                  <Animated.View
                    entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
                    style={styles.lookupFound}
                  >
                    <CheckIcon size={iconSize.inline} color={text.primary} weight="bold" />
                    <Text style={styles.lookupPlace}>
                      {lookup.place.town}
                      {lookup.place.region ? `, ${lookup.place.region}` : ""}
                    </Text>
                  </Animated.View>
                ) : lookup.state === "notFound" ? (
                  <Text style={styles.lookupBad}>
                    No postcode matches that. Check the digits?
                  </Text>
                ) : lookup.state === "offline" ? (
                  <Text style={styles.lookupWait}>
                    Cannot check it offline. Carry on and PAWS will confirm later.
                  </Text>
                ) : null}
              </Animated.View>

              <Text style={styles.privacyNote}>
                An area is enough to find a clinic. PAWS never asks for your street.
              </Text>
            </>
          ) : null}

          {screen === "vet-book" ? (
            <>
              <Text style={styles.title}>Somewhere to go</Text>
              <Text style={styles.stageNote}>
                {lookup.state === "found"
                  ? `Vets near ${lookup.place.town}`
                  : "Waiting on the postcode"}
              </Text>

              {clinics.state === "ready" ? (
                <Animated.Text
                  entering={
                    reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)
                  }
                  style={styles.bookingNote}
                >
                  Most of these book by phone. PAWS cannot make the call. Tap a
                  number, and it will keep the time they give you.
                </Animated.Text>
              ) : null}

              {clinics.state === "loading" ? (
                <ClinicSkeleton reduceMotion={reduceMotion} />
              ) : clinics.state === "ready" ? (
                <View style={styles.clinicList}>
                  {clinics.items.map((clinic, index) => (
                    <ClinicCard
                      key={clinic.id}
                      clinic={clinic}
                      order={index}
                      booking={a.booked}
                      reduceMotion={reduceMotion}
                      onBook={(booking) => setA((c) => ({ ...c, booked: booking }))}
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.clinicEmpty}>
                  {clinics.state === "idle"
                    ? "Go back a step and PAWS will look once the postcode resolves."
                    : clinics.state === "unconfigured"
                      ? "Clinic search needs a SerpApi key in this build."
                      : clinics.state === "offline"
                        ? "Cannot reach the directory right now. Carry on, the shots are still on the list."
                        : clinics.state === "empty"
                          ? "No practices came back for those days and times. Try \u201cEither\u201d on the last step."
                          : "The directory did not answer. Carry on and try again later."}
                </Text>
              )}

              <Text style={styles.privacyNote}>{CLINIC_DISCLAIMER}</Text>
            </>
          ) : null}

          {screen === "checkin" ? (
            <CheckInStep
              name={name}
              dinner={[...(a.mealTimes.length ? a.mealTimes : existing?.mealTimes ?? [])].sort().at(-1) ?? null}
              time={a.checkinTime ?? afterDinner(a.mealTimes.length ? a.mealTimes : existing?.mealTimes ?? [])}
              suggested={afterDinner(a.mealTimes.length ? a.mealTimes : existing?.mealTimes ?? [])}
              reduceMotion={reduceMotion}
              onPick={(time) => {
                void Haptics.selectionAsync();
                setA((current) => ({ ...current, checkinTime: time }));
              }}
            />
          ) : null}
        </Animated.View>
      </Animated.ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + bottomInset + space.lg }]}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={last ? (only ? "Add to care" : "Start tracking") : "Next step"}
          scaleTo={0.97}
          disabled={!ready}
          style={[styles.next, !ready && styles.nextOff]}
          onPress={() => (last ? finish() : go(step + 1))}
        >
          <Text style={[styles.nextText, !ready && styles.nextTextOff]}>
            {last ? (only ? "Add to care" : "Start tracking") : "Next"}
          </Text>
          {last ? (
            <CheckIcon
              size={iconSize.button}
              color={ready ? text.primary : text.disabled}
              weight="bold"
            />
          ) : (
            <ArrowRightIcon
              size={iconSize.button}
              color={ready ? text.primary : text.disabled}
              weight="bold"
            />
          )}
        </PressScale>
      </View>
    </View>
  );
};

const EVENING_SLOTS = ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

const CheckInStep = ({
  name,
  dinner,
  time,
  suggested,
  reduceMotion,
  onPick,
}: {
  name: string;
  dinner: string | null;
  time: string;
  suggested: string;
  reduceMotion: boolean;
  onPick: (time: string) => void;
}) => (
  <>
    <Text style={styles.title}>One minute, every evening</Text>
    <Text style={styles.stageNote}>
      Health comes with a daily check-in. Eating, energy, bathroom and anything odd. Answered every day, it is how
      PAWS notices a change before it becomes a vet visit.
    </Text>

    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(80)}
      style={styles.checkPreview}
      accessibilityLabel={`Example: How did ${name} eat today?`}
    >
      <Text style={styles.checkPreviewQ}>How did {name} eat today?</Text>
      <View style={styles.checkPreviewAnswers}>
        {APPETITE.map((option) => (
          <View key={option.key} style={styles.checkPreviewPill}>
            <Text style={styles.checkPreviewPillText}>{option.label}</Text>
          </View>
        ))}
      </View>
    </Animated.View>

    <Text style={styles.label}>When should PAWS ask?</Text>
    <Text style={styles.checkWhenNote}>
      {dinner
        ? `Dinner is at ${prettyTime(dinner)}, so an hour after it the day's eating is done. Until you answer, it waits at the top of Care.`
        : "After dinner works best, once the day's eating is done. Until you answer, it waits at the top of Care."}
    </Text>
    <TimeGrid
      slots={[time]}
      suggested={[suggested]}
      times={EVENING_SLOTS}
      reduceMotion={reduceMotion}
      onToggle={onPick}
      onSuggest={() => onPick(suggested)}
    />
  </>
);

const AddingBadge = ({ area }: { area: AreaKey }) => {
  const item = AREAS.find((entry) => entry.key === area);
  const Glyph = GLYPH[item?.glyph ?? ""] ?? PlusIcon;
  return (
    <View style={styles.adding}>
      <View style={styles.addingDisc}>
        <Glyph size={iconSize.inline} color={text.primary} weight="bold" />
      </View>
      <Text style={styles.addingText}>ADDING {item?.label.toUpperCase() ?? "CARE"}</Text>
    </View>
  );
};

const GroupCard = ({
  order,
  label,
  hint,
  glyph,
  on,
  reduceMotion,
  onPress,
}: {
  order: number;
  label: string;
  hint: string;
  glyph: string;
  on: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) => {
  const Glyph = GLYPH[glyph] ?? PersonSimpleWalkIcon;
  const pop = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    pop.value = reduceMotion ? (on ? 1 : 0) : withSpring(on ? 1 : 0, { duration: 380, dampingRatio: 0.7 });
  }, [on, pop, reduceMotion]);

  const tick = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.7 + pop.value * 0.3 }],
  }));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 50)}
    >
      <PressScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${label}. ${hint}`}
        scaleTo={0.98}
        style={[styles.groupCard, on && styles.groupCardOn]}
        onPress={onPress}
      >
        <View style={[styles.groupDisc, on && styles.groupDiscOn]}>
          <Glyph size={iconSize.feature} color={text.primary} weight={on ? "fill" : "regular"} />
        </View>
        <View style={styles.groupCopy}>
          <Text style={styles.groupLabel}>{label}</Text>
          <Text style={styles.groupHint}>{hint}</Text>
        </View>
        <View style={[styles.groupBox, on && styles.groupBoxOn]}>
          <Animated.View style={tick}>
            <CheckIcon size={14} color={text.primary} weight="bold" />
          </Animated.View>
        </View>
      </PressScale>
    </Animated.View>
  );
};

const bookedAppointment = (answers: Answers): CareAppointment | null =>
  answers.booked
    ? {
        clinic: answers.booked.clinicName,
        day: answers.booked.day,
        dayKey: answers.booked.dayKey,
        time: answers.booked.time,
        phone: answers.booked.phone,
        address: answers.booked.address,
      }
    : null;

const PlanList = ({
  items,
  chosen,
  doneLabel,
  todoLabel,
  onToggle,
  reduceMotion,
}: {
  items: readonly PlanItem[];
  chosen: readonly string[];
  doneLabel: string;
  todoLabel: string;
  onToggle: (key: string) => void;
  reduceMotion: boolean;
}) => (
  <View style={styles.planList}>
    {items.map((item, index) => {
      const on = chosen.includes(item.key);
      return (
        <Animated.View
          key={item.key}
          entering={
            reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(index * 45)
          }
        >
          <PressScale
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${item.label}, ${item.when}. ${item.why} ${on ? doneLabel : todoLabel}.`}
            scaleTo={0.99}
            style={styles.planRow}
            onPress={() => onToggle(item.key)}
          >
            <View style={styles.planCopy}>
              <View style={styles.planHead}>
                <Text style={styles.planLabel}>{item.label}</Text>
                {item.required ? <Text style={styles.planReq}>Core</Text> : null}
              </View>
              <Text style={styles.planWhen}>{item.when}</Text>
              <Text style={styles.planWhy}>{item.why}</Text>
              <Text style={[styles.planState, on && styles.planStateOn]}>
                {on ? doneLabel : todoLabel}
              </Text>
            </View>

            <View style={[styles.planCheck, on && styles.planCheckOn]}>
              {on ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}
            </View>
          </PressScale>

          {index < items.length - 1 ? <View style={styles.planRule} /> : null}
        </Animated.View>
      );
    })}
  </View>
);

const KitCard = ({
  job,
  order,
  on,
  reduceMotion,
  onToggle,
}: {
  job: (typeof GROOMING_KIT)[number];
  order: number;
  on: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
}) => (
  <Animated.View
    entering={
      reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 45)
    }
    layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
  >
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${job.label}, ${job.every}. ${on ? `You do this. You need: ${job.kit}` : "A groomer does this."}`}
      scaleTo={0.98}
      style={[styles.kitCard, on && styles.kitCardOn]}
      onPress={onToggle}
    >
      <View style={styles.kitHead}>
        <View style={styles.kitCopy}>
          <Text style={styles.planLabel}>{job.label}</Text>
          <Text style={styles.planWhen}>{job.every}</Text>
        </View>
        <View style={[styles.planCheck, on && styles.planCheckOn]}>
          {on ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}
        </View>
      </View>

      {on ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
          style={styles.kitBuy}
        >
          <Text style={styles.kitBuyHead}>What you need</Text>
          <Text style={styles.kitBuyText}>{job.kit}</Text>
          <Text style={styles.kitTip}>{job.tip}</Text>
        </Animated.View>
      ) : null}
    </PressScale>
  </Animated.View>
);

const KitRow = ({
  job,
  order,
  owned,
  wantsHow,
  reduceMotion,
  onOwn,
  onHow,
}: {
  job: (typeof GROOMING_KIT)[number];
  order: number;
  owned: boolean;
  wantsHow: boolean;
  reduceMotion: boolean;
  onOwn: () => void;
  onHow: () => void;
}) => {
  const offers = useKitOffers(job.key, !owned);

  return (
  <Animated.View
    entering={
      reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 45)
    }
    layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
    style={[styles.kitCard, owned && styles.kitCardOn]}
  >
    <View style={styles.kitHead}>
      <View style={styles.kitThumb}>
        <KitArt item={job.key} size={44} />
      </View>
      <View style={styles.kitCopy}>
        <Text style={styles.planLabel}>{job.label}</Text>
        <Text style={styles.planWhen}>{job.kit}</Text>
      </View>
    </View>

    <View style={styles.kitAnswer}>
      {[
        { key: "have", label: "Got it", on: owned },
        { key: "need", label: "Not yet", on: !owned },
      ].map((option) => (
        <PressScale
          key={option.key}
          accessibilityRole="button"
          accessibilityState={{ selected: option.on }}
          accessibilityLabel={`${job.label}: ${option.label}`}
          scaleTo={0.96}
          style={[styles.kitPick, option.on && styles.kitPickOn]}
          onPress={() => {
            if (option.on) return;
            void Haptics.selectionAsync();
            onOwn();
          }}
        >
          <Text style={[styles.kitPickText, option.on && styles.kitPickTextOn]}>
            {option.label}
          </Text>
        </PressScale>
      ))}
    </View>

    {!owned ? (
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
        style={styles.kitBuy}
      >
        <View style={styles.kitBuyRow}>
          <Text style={styles.kitBuyHead}>What to look for</Text>
          <Text style={styles.kitPrice}>{job.price}</Text>
        </View>
        <Text style={styles.kitBuyText}>{job.look}</Text>

        <ProductRail jobKey={job.key} kit={job.kit} feed={offers} reduceMotion={reduceMotion} />

        <PressScale
          accessibilityRole="checkbox"
          accessibilityState={{ checked: wantsHow }}
          accessibilityLabel={`Send me how to ${job.label.toLowerCase()}`}
          scaleTo={0.98}
          style={styles.howRow}
          onPress={() => {
            void Haptics.selectionAsync();
            onHow();
          }}
        >
          <View style={[styles.planCheck, wantsHow && styles.planCheckOn]}>
            {wantsHow ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}
          </View>
          <Text style={styles.howText}>Show me how the first time</Text>
        </PressScale>

        {wantsHow ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
            layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
            style={styles.howSteps}
          >
            {job.how.map((line, index) => (
              <View key={line} style={styles.howStep}>
                <Text style={styles.howNumber}>{index + 1}</Text>
                <Text style={styles.howLine}>{line}</Text>
              </View>
            ))}
          </Animated.View>
        ) : null}
      </Animated.View>
    ) : null}
  </Animated.View>
  );
};

const ClinicSkeleton = ({ reduceMotion }: { reduceMotion: boolean }) => (
  <View style={styles.clinicList}>
    {[0, 1, 2].map((index) => (
      <Animated.View
        key={index}
        entering={
          reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(index * 60)
        }
        style={styles.clinicGhost}
      >
        <View style={styles.clinicGhostHead}>
          <View style={styles.clinicGhostMark} />
          <View style={styles.clinicGhostCopy}>
            <View style={[styles.ghostLine, { width: "74%" }]} />
            <View style={[styles.ghostLine, { width: "44%" }]} />
          </View>
        </View>
        <View style={[styles.ghostLine, { width: "88%" }]} />
      </Animated.View>
    ))}
  </View>
);

const MedHit = ({
  medicine,
  order,
  on,
  reduceMotion,
  onToggle,
}: {
  medicine: Medicine;
  order: number;
  on: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
}) => (
  <Animated.View
    entering={
      reduceMotion ? undefined : FadeIn.duration(motion.duration.select).delay(order * 25)
    }
    layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}
  >
    <PressScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${medicine.name}, ${medicine.generic}. For ${medicine.purpose}. ${medicine.form}.`}
      scaleTo={0.98}
      style={[styles.hit, on && styles.hitOn]}
      onPress={onToggle}
    >
      <View style={styles.hitCopy}>
        <View style={styles.hitHead}>
          <Text style={styles.hitName}>{medicine.name}</Text>
          <Text style={styles.hitForm}>{medicine.form}</Text>
        </View>
        <Text style={styles.hitGeneric}>{medicine.generic}</Text>
        <Text style={styles.hitPurpose} numberOfLines={1}>
          {medicine.purpose} · {CADENCE_LABEL[medicine.cadence]}
        </Text>
      </View>

      <View style={[styles.planCheck, on && styles.planCheckOn]}>
        {on ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}
      </View>
    </PressScale>
  </Animated.View>
);

const styles = StyleSheet.create({
  adding: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.sm,
    marginBottom: space.lg,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  addingDisc: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  addingText: { ...type.eyebrow, color: text.primary },
  screen: { flex: 1, backgroundColor: bg.canvas },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: layout.gutter,
    paddingBottom: space.lg,
  },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: { width: layout.iconButton },

  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: bg.subtle },
  segmentOn: { backgroundColor: accent.deep },

  content: { paddingHorizontal: layout.gutter, paddingTop: space.lg },

  title: { ...type.hero, fontSize: 32, lineHeight: 36, color: text.primary },
  label: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.section },

  groupList: { gap: space.md, marginTop: space.xxl },

  checkPreview: { marginTop: space.xxl, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: text.primary },
  checkPreviewQ: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.inverse },
  checkPreviewAnswers: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  checkPreviewPill: {
    flexBasis: "47%",
    flexGrow: 1,
    height: 44,
    borderRadius: radius.control,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkPreviewPillText: { ...type.supporting, fontWeight: "700", color: text.primary },
  checkWhenNote: { ...type.supporting, color: text.secondary, marginBottom: space.lg, lineHeight: 21 },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    borderRadius: radius.card + 4,
    borderWidth: 1.5,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
  },
  groupCardOn: { borderColor: accent.deep, backgroundColor: accent.soft },
  groupDisc: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  groupDiscOn: { backgroundColor: accent.primary },
  groupCopy: { flex: 1 },
  groupLabel: { ...type.sectionTitle, color: text.primary },
  groupHint: { ...type.supporting, color: text.secondary, marginTop: 2 },
  groupBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  groupBoxOn: { borderColor: accent.deep, backgroundColor: accent.deep },

  timelineWrap: { marginBottom: space.xl },

  lookup: { minHeight: 24, justifyContent: "center", marginTop: space.md },
  lookupWait: { ...type.supporting, color: text.tertiary },
  lookupFound: { flexDirection: "row", alignItems: "center", gap: 6 },
  lookupPlace: { ...type.supporting, fontWeight: "600", color: text.primary },
  lookupBad: { ...type.supporting, color: text.primary },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
  },
  searchInput: { flex: 1, paddingVertical: space.md, ...type.body, color: text.primary },

  filterRail: { marginHorizontal: -layout.gutter, marginTop: space.lg },
  filterRailInner: { gap: space.sm, paddingHorizontal: layout.gutter },

  hits: { gap: space.sm, marginTop: space.lg },
  hit: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  hitOn: { borderColor: accent.deep, backgroundColor: accent.soft },
  hitCopy: { flex: 1 },
  hitHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  hitName: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  hitForm: { ...type.caption, color: text.tertiary },
  hitGeneric: { ...type.caption, color: text.secondary, marginTop: 2 },
  hitPurpose: { ...type.caption, color: text.tertiary, marginTop: 2 },

  addOwn: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: accent.deep,
    backgroundColor: accent.soft,
  },
  addOwnCopy: { flex: 1 },
  addOwnTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  addOwnNote: { ...type.caption, color: text.secondary, marginTop: 2 },

  clinicGhost: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    padding: space.lg,
    gap: space.md,
  },
  clinicGhostHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  clinicGhostMark: {
    width: 54,
    height: 54,
    borderRadius: radius.control,
    backgroundColor: bg.subtle,
  },
  clinicGhostCopy: { flex: 1, gap: space.sm },
  ghostLine: { height: 9, borderRadius: radius.pill, backgroundColor: bg.subtle },

  stageNote: { ...type.supporting, color: text.tertiary, marginTop: space.md },
  planTimeline: { marginTop: space.xxl },

  planList: { marginTop: space.xxl },
  planRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.lg,
    paddingVertical: space.lg,
  },
  planRule: { height: 1, backgroundColor: border.soft },
  planCopy: { flex: 1 },
  planHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  planLabel: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary },
  planReq: {
    ...type.caption,
    fontWeight: "700",
    color: accent.band,
    letterSpacing: 0.4,
  },
  planWhen: { ...type.caption, fontWeight: "600", color: text.secondary, marginTop: 3 },
  planWhy: { ...type.caption, color: text.tertiary, marginTop: 4, lineHeight: 17 },
  planCheck: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  planCheckOn: { backgroundColor: accent.primary, borderColor: accent.primary },
  planState: { ...type.caption, color: text.tertiary, marginTop: space.sm },
  planStateOn: { color: text.primary, fontWeight: "600" },

  postcode: { ...type.pageTitle, letterSpacing: 1.5, fontVariant: ["tabular-nums"] },
  privacyNote: { ...type.caption, color: text.tertiary, marginTop: space.md, lineHeight: 17 },

  kitThumb: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  kitAnswer: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  kitPick: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
  },
  kitPickOn: { backgroundColor: accent.primary, borderColor: accent.primary },
  kitPickText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  kitPickTextOn: { color: text.primary },
  kitBuyRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  kitPrice: { ...type.supporting, fontWeight: "700", color: text.primary },

  howRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg },
  howText: { ...type.supporting, color: text.primary },
  howSteps: { gap: space.md, marginTop: space.lg },
  howStep: { flexDirection: "row", gap: space.md },
  howNumber: {
    ...type.caption,
    fontWeight: "700",
    color: text.primary,
    width: 18,
    fontVariant: ["tabular-nums"],
  },
  howLine: { ...type.caption, color: text.secondary, flex: 1, lineHeight: 18 },

  bookingNote: {
    ...type.supporting,
    color: text.secondary,
    marginTop: space.lg,
  },
  clinicList: { gap: space.md, marginTop: space.xl },
  clinicEmpty: { ...type.caption, color: text.tertiary, marginTop: space.lg },

  kitList: { gap: space.md, marginTop: space.xxl },
  kitCard: {
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  kitCardOn: { borderColor: border.default },
  kitHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  kitCopy: { flex: 1 },
  kitBuy: {
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: accent.pressed,
  },
  kitBuyHead: { ...type.caption, fontWeight: "700", color: text.primary },
  kitBuyText: { ...type.supporting, color: text.primary, marginTop: 3 },
  kitTip: { ...type.caption, color: text.secondary, marginTop: 6, lineHeight: 17 },

  workRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  workCopy: { flex: 1 },
  workLabel: { ...type.caption, color: text.tertiary },
  workValue: { ...type.pageTitle, color: text.primary, marginTop: 2 },
  workControls: { flexDirection: "row", gap: space.sm },
  nudge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
  },
  chipOn: { backgroundColor: accent.primary, borderColor: accent.primary },
  chipText: { ...type.supporting, color: text.secondary },
  chipTextOn: { color: text.primary, fontWeight: "700" },

  yesNo: { flexDirection: "row", gap: space.md, marginTop: space.xxl },
  yesNoCard: {
    flex: 1,
    paddingVertical: space.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
  },
  yesNoCardOn: { backgroundColor: accent.primary, borderColor: accent.primary },
  yesNoText: { ...type.cardTitle, fontWeight: "600", color: text.primary },

  input: {
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
    ...type.body,
    color: text.primary,
  },

  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space.lg,
    paddingHorizontal: layout.gutter,
    backgroundColor: bg.canvas,
    borderTopWidth: 1,
    borderTopColor: border.soft,
  },
  next: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  nextOff: { backgroundColor: bg.subtle },
  nextText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  nextTextOff: { color: text.disabled },
});
