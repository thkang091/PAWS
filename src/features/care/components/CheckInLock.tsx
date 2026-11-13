import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSequence, withTiming, withDelay, withRepeat } from "react-native-reanimated";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  BowlFoodIcon,
  CaretLeftIcon,
  CheckIcon,
  DropIcon,
  HeartbeatIcon,
  LightningIcon,
  MoonStarsIcon,
  PawPrintIcon,
  PersonSimpleWalkIcon,
  TimerIcon,
  ToiletIcon,
  ToiletPaperIcon,
  type IconProps,
} from "phosphor-react-native";

import { APPETITE, DRINKING, ENERGY, STOOL, UNUSUAL, URINATION } from "@/features/care/components/DailyHealthCheckSheet";
import { minutesOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { enter } from "@/features/care/food/enter";
import {
  settleMissedThrough,
  pauseDailyCheckIn,
  setCheckInTime,
  skipDailyCheckInToday,
  submitCatchUp,
  submitDailyCheckIn,
  todayKey,
  useCheckInByDate,
  useSkippedDates,
  updateTodayCheckIn,
  useCheckInHistory,
  useCheckInSettings,
  useTodayCheckIn,
  type DailyCheckIn,
  type UnusualSign,
  type WalkAnswer,
} from "@/features/care/state/dailyCheckIn";
import { useTodayChecks } from "@/features/care/state/todayChecks";
import { useMutedReminders } from "@/features/care/state/careOnboarding";
import { useConsistency } from "@/features/care/state/useConsistency";
import { shiftDay } from "@/features/care/intel/consistency";
import { WeekMarks } from "@/features/care/components/WeekMarks";
import { syncCheckInReminders } from "@/services/notificationService";
import { useDogContext } from "@/features/care/intel/useDogContext";
import { supportFor, type CheckInSupport, type SupportDog, type SupportLevel } from "@/services/checkInSupport";
import { MOBILITY_LABEL, type MobilitySign } from "@/features/care/intel/careIntel";
import { PressScale } from "@/components/ui/PressScale";
import { useLogExercise } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { accent, bg, border, icon as iconSize, layout, motion, radius, scene, space, text, type } from "@/constants/design";

// ---------- Opening it from anywhere ("Answer" on Care, Health's check-in row) ----------

let requested = false;
const requestListeners = new Set<() => void>();
const setRequested = (value: boolean) => {
  requested = value;
  requestListeners.forEach((listener) => listener());
};
/** Open the evening check-in now, whatever screen you are on. */
export const requestCheckIn = () => setRequested(true);

// "Not now" on a catch-up holds it off for this session only. Care stays locked meanwhile, and its button opens it again.
let deferred = false;
const deferListeners = new Set<() => void>();
const setDeferred = (value: boolean) => {
  deferred = value;
  deferListeners.forEach((listener) => listener());
};
/** Open the catch-up for missed check-ins now (Care's lock screen). */
export const requestCatchUp = () => setDeferred(false);
const useDeferred = () =>
  useSyncExternalStore(
    (listener) => {
      deferListeners.add(listener);
      return () => deferListeners.delete(listener);
    },
    () => deferred,
    () => deferred,
  );
const useRequested = () =>
  useSyncExternalStore(
    (listener) => {
      requestListeners.add(listener);
      return () => requestListeners.delete(listener);
    },
    () => requested,
    () => requested,
  );

/** Defer automatic check-ins during onboarding, walks, and Game preparation or play. */
const FREE_PATHS = ["/welcome", "/intro", "/onboarding", "/personalizing", "/plan-selection", "/tutorial", "/care/walk", "/game/prepare", "/game/session"];

const useMinuteNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
};

// ---------- The flow ----------

type HealthKey = "appetite" | "energy" | "stool" | "urination" | "drinking";
type Step = "intro" | HealthKey | "unusual" | "support" | "mobility" | "walk" | "minutes" | "routine" | "skip" | "done";
type Draft = Omit<DailyCheckIn, "date">;
type RoutineChoice = "keep" | "change" | "pause" | "skip";

const EMPTY: Draft = { appetite: null, energy: null, stool: null, urination: null, drinking: null, unusual: [], unusualNote: "", walk: null, walkMinutes: null, mobility: [] };
const EVENING = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];
const MINUTES = [15, 30, 45, 60, 90];

const QUESTIONS: Record<HealthKey, { title: (name: string) => string; hint?: string; options: readonly { key: string; label: string }[] }> = {
  appetite: { title: (n) => `How did ${n} eat today?`, options: APPETITE },
  energy: { title: (n) => `How was ${n}'s energy?`, options: ENERGY },
  stool: { title: () => "Any change in stool?", hint: "Bathroom", options: STOOL },
  urination: { title: () => "And peeing?", hint: "Bathroom", options: URINATION },
  drinking: { title: () => "How much water?", options: DRINKING },
};

/**
 * The evening check-in, full screen. Once it is due, it covers the whole app until it is answered, one question a
 * screen, each answer moving on by itself. If no walk was tracked with PAWS today it asks about that briefly, and it
 * ends by asking whether the routine is working, with a way to change the schedule. "I can't do it tonight" never
 * traps anyone: it goes straight to skip, change the schedule, or pause.
 */
export const CheckInLock = () => {
  const settings = useCheckInSettings();
  const today = useTodayCheckIn();
  const dog = useCurrentDog();
  const pathname = usePathname();
  const minute = useMinuteNow();
  const asked = useRequested();
  const consistency = useConsistency();
  useCheckInReminderSync(dog.data?.name ?? null);

  const allowed = settings.hydrated && settings.enabled && Boolean(dog.data) && !FREE_PATHS.some((path) => pathname.startsWith(path));
  const due = allowed && !today.entry && !today.skippedToday && minute >= minutesOf(settings.time);
  // Missed days come first, at any hour: a gap is filled in the moment PAWS is opened again.
  const held = useDeferred();
  const catchUpDue = allowed && consistency.catchUp.length > 0 && !held;

  // Once open, it stays until the person finishes, even after the answers are saved.
  const [mode, setMode] = useState<"catchup" | "checkin" | null>(null);
  useEffect(() => {
    if (mode) return;
    if (catchUpDue) setMode("catchup");
    else if (due || asked) setMode("checkin");
  }, [mode, catchUpDue, due, asked]);

  if (mode === "catchup") {
    return (
      <CatchUp
        name={dog.data?.name ?? "your dog"}
        time={settings.time}
        dueNow={due}
        onFinished={(left) => {
          if (left) setDeferred(true);
          setMode(null);
        }}
      />
    );
  }
  if (mode !== "checkin") return null;
  return (
    <Flow
      dogId={dog.data?.id ?? ""}
      name={dog.data?.name ?? "your dog"}
      time={settings.time}
      closable={asked && !due}
      onFinished={() => {
        setRequested(false);
        setMode(null);
      }}
    />
  );
};

/**
 * Keeps the check-in reminders in step with the record from anywhere in the app: the evening reminder, a nudge later
 * that night, and a morning note when a day was missed. Runs again whenever a day is answered or skipped, and once a
 * day so the next week is always scheduled.
 */
const useCheckInReminderSync = (dogName: string | null) => {
  const settings = useCheckInSettings();
  const byDate = useCheckInByDate();
  const skipped = useSkippedDates();
  const muted = useMutedReminders().includes("checkin");
  const covered = [...Object.keys(byDate), ...skipped].sort().join("|");
  const day = todayKey();
  useEffect(() => {
    if (!settings.hydrated || !dogName) return;
    void syncCheckInReminders({
      enabled: settings.enabled && !muted,
      time: settings.time,
      coveredDates: covered ? covered.split("|") : [],
      since: settings.since,
      dogName,
    }).catch(() => {});
  }, [settings.hydrated, settings.enabled, settings.time, settings.since, muted, covered, dogName, day]);
};

const Flow = ({ dogId, name, time, closable, onFinished }: { dogId: string; name: string; time: string; closable: boolean; onFinished: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const checks = useTodayChecks();
  const logExercise = useLogExercise(dogId);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [step, setStep] = useState<Step>("intro");
  const [direction, setDirection] = useState(1);
  const [choice, setChoice] = useState<RoutineChoice | null>(null);
  const [openSchedule, setOpenSchedule] = useState(false);
  const walkedWithPaws = checks.walks.length > 0;
  const history = useCheckInHistory();
  // The full profile goes with every support request, so the advice fits this dog.
  const context = useDogContext();
  const supportDog = useMemo<SupportDog>(
    () => ({ name, breed: context.breed, ageYears: context.ageYears, weightKg: context.weightKg, stage: context.stage, allergies: context.allergies, brief: context.brief }),
    [name, context],
  );

  const flow = useMemo<Step[]>(() => {
    const steps: Step[] = ["appetite", "energy", "stool", "urination", "drinking", "unusual"];
    // Anything unusual gets a moment of support before moving on.
    if (draft.unusual.length) steps.push("support");
    steps.push("mobility");
    if (!walkedWithPaws) steps.push("walk");
    if (draft.walk === "outside") steps.push("minutes");
    steps.push("routine");
    return steps;
  }, [walkedWithPaws, draft.walk, draft.unusual.length]);

  const index = flow.indexOf(step);
  const go = (next: Step, dir = 1) => {
    setDirection(dir);
    setStep(next);
  };
  // A beat after a tap, so the choice is seen before the screen moves on.
  const afterBeat = (fn: () => void) => (reduceMotion ? fn() : setTimeout(fn, 220));
  const advance = (from: Step, patch?: Partial<Draft>) => {
    const merged = { ...draft, ...patch };
    if (patch) setDraft(merged);
    // The health answers are saved the moment the last one is in, so nothing is lost if the app closes.
    if (from === "mobility") submitDailyCheckIn({ ...merged, support: merged.unusual.length ? (merged.support ?? null) : null, walk: walkedWithPaws ? "paws" : null });
    const next: Step = from === "walk" ? (merged.walk === "outside" ? "minutes" : "routine") : (flow[flow.indexOf(from) + 1] ?? "routine");
    afterBeat(() => go(next));
  };

  const back = () => {
    void Haptics.selectionAsync();
    if (step === "skip") return go("intro", -1);
    const prev = flow[index - 1];
    go(prev ?? "intro", -1);
  };

  const [ending, setEnding] = useState<"saved" | "skipped" | "paused">("saved");
  const finish = (kind: "saved" | "skipped") => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (choice === "pause") pauseDailyCheckIn();
    // Skipping tonight lifts the lock, unless they just moved the check-in to later tonight: then it waits for that.
    const now = new Date().getHours() * 60 + new Date().getMinutes();
    const movedLater = choice === "change" && minutesOf(time) > now;
    if (kind === "skipped" && choice !== "pause" && !movedLater) skipDailyCheckInToday();
    setEnding(choice === "pause" ? "paused" : kind);
    go("done");
  };

  // ---- exit: the whole cover lifts away once you are done
  const lift = useSharedValue(0);
  const coverStyle = useAnimatedStyle(() => ({ opacity: 1 - lift.value, transform: [{ scale: 1 + lift.value * 0.04 }] }));
  const close = () => {
    const after = () => {
      onFinished();
      if (openSchedule) router.push("/care/schedule" as never);
    };
    if (reduceMotion) return after();
    lift.value = withTiming(1, { duration: 280, easing: motion.easing.out });
    setTimeout(after, 290);
  };

  const progress = step === "intro" || step === "skip" || step === "done" ? null : (index + 1) / flow.length;

  return (
    <Animated.View
      style={[styles.cover, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }, coverStyle]}
      accessibilityViewIsModal
    >
      <View style={styles.top}>
        {step !== "intro" && step !== "done" ? (
          <PressScale accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.92} style={styles.round} onPress={back}>
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
        ) : (
          <View style={styles.roundSpacer} />
        )}
        {progress != null ? <Progress value={progress} /> : <View style={styles.flex} />}
        <View style={styles.roundSpacer} />
      </View>

      <Animated.View key={step} entering={reduceMotion ? undefined : enter({ x: direction * 28 }, { duration: motion.duration.enter })} style={styles.body}>
        {step === "intro" ? (
          <Intro
            name={name}
            time={time}
            closable={closable}
            onStart={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              go("appetite");
            }}
            onCannot={() => {
              void Haptics.selectionAsync();
              setChoice(null);
              go("skip");
            }}
            onClose={close}
          />
        ) : step === "unusual" ? (
          <Unusual
            draft={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            onNext={() => advance("unusual")}
          />
        ) : step === "support" ? (
          <Support
            draft={draft}
            history={history}
            dog={supportDog}
            onReady={(support) => setDraft((d) => ({ ...d, support }))}
            onNext={() => advance("support")}
            onFindVet={() => {
              // An emergency should never wait on the rest of the check-in: save what is there and open Find a vet.
              submitDailyCheckIn({ ...draft, walk: walkedWithPaws ? "paws" : null });
              onFinished();
              router.push("/care/find-vet" as never);
            }}
          />
        ) : step === "mobility" ? (
          <Movement
            name={name}
            signs={draft.mobility ?? []}
            onToggle={(sign) => {
              void Haptics.selectionAsync();
              const current = draft.mobility ?? [];
              setDraft((d) => ({ ...d, mobility: current.includes(sign) ? current.filter((x) => x !== sign) : [...current, sign] }));
            }}
            onNext={() => advance("mobility")}
          />
        ) : step === "walk" ? (
          <Question
            eyebrow="No walk was tracked with PAWS today"
            context={<SimpleContext Glyph={PersonSimpleWalkIcon} line="Walks without PAWS still count toward the week, and the food plan follows how active the week was." />}
            title={`Did ${name} get a walk?`}
            options={[
              { key: "outside", label: "Yes, without PAWS" },
              { key: "none", label: "No walk today" },
            ]}
            value={draft.walk ?? null}
            onPick={(key) => {
              updateTodayCheckIn({ walk: key as WalkAnswer });
              advance("walk", { walk: key as WalkAnswer });
            }}
          />
        ) : step === "minutes" ? (
          <Question
            eyebrow="So the activity stays right"
            context={<SimpleContext Glyph={TimerIcon} line="A rough guess is fine. It is logged as a walk for today." />}
            title="About how long?"
            options={MINUTES.map((m) => ({ key: String(m), label: m >= 60 ? `${m / 60 === 1 ? "1 hour" : "1.5 hours"}` : `${m} minutes` }))}
            value={draft.walkMinutes ? String(draft.walkMinutes) : null}
            onPick={(key) => {
              const minutes = Number(key);
              updateTodayCheckIn({ walkMinutes: minutes });
              logExercise.mutate({ activityType: "walk", durationMinutes: minutes, walkCount: 1, notes: "Logged in the evening check-in" });
              advance("minutes", { walkMinutes: minutes });
            }}
          />
        ) : step === "routine" || step === "skip" ? (
          <Routine
            name={name}
            time={time}
            skipping={step === "skip"}
            noPawsWalk={draft.walk === "outside" || draft.walk === "none"}
            choice={choice}
            openSchedule={openSchedule}
            onChoice={(c) => {
              void Haptics.selectionAsync();
              setChoice(c);
            }}
            onSchedule={() => setOpenSchedule((v) => !v)}
            onDone={() => finish(step === "skip" ? "skipped" : "saved")}
          />
        ) : step === "done" ? (
          <Done name={name} ending={ending} time={time} onClose={close} />
        ) : (
          <Question
            eyebrow={QUESTIONS[step].hint}
            title={QUESTIONS[step].title(name)}
            options={QUESTIONS[step].options}
            value={draft[step] ?? null}
            onPick={(key) => advance(step, { [step]: key } as Partial<Draft>)}
            context={<RecentWeek metric={step} history={history} name={name} />}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
};

// ---------- Pieces ----------

const Progress = ({ value }: { value: number }) => {
  const reduceMotion = useReducedMotion();
  const width = useDerivedValue(() => (reduceMotion ? value : withTiming(value, { duration: 320, easing: motion.easing.out })), [value]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: width.value }] }));
  return (
    <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(value * 100), min: 0, max: 100 }}>
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  );
};

const Intro = ({ name, time, closable, onStart, onCannot, onClose }: { name: string; time: string; closable: boolean; onStart: () => void; onCannot: () => void; onClose: () => void }) => {
  const reduceMotion = useReducedMotion();
  const beat = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    beat.value = withDelay(500, withSequence(withTiming(1.12, { duration: 140 }), withTiming(1, { duration: 200 }), withTiming(1.08, { duration: 120 }), withTiming(1, { duration: 260 })));
  }, [beat, reduceMotion]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
  return (
    <View style={styles.fill}>
      <View style={styles.introTop}>
        <Animated.View style={[styles.introMark, pulse]}>
          <HeartbeatIcon size={34} color={text.primary} weight="fill" />
        </Animated.View>
        <Text style={styles.eyebrow}>{`Evening check-in, ${prettyTime(time)}`}</Text>
        <Text style={styles.title} accessibilityRole="header">{`How was ${name}'s day?`}</Text>
        <Text style={styles.lede}>A few quick taps. It is how PAWS spots a change early, and PAWS opens again right after.</Text>
      </View>
      <View>
        <PressScale accessibilityRole="button" accessibilityLabel="Start the check-in" scaleTo={0.97} style={styles.primary} onPress={onStart}>
          <Text style={styles.primaryText}>Start check-in</Text>
        </PressScale>
        <PressScale accessibilityRole="button" accessibilityLabel={closable ? "Close" : "I can't do it tonight"} scaleTo={0.96} style={styles.quiet} onPress={closable ? onClose : onCannot}>
          <Text style={styles.quietText}>{closable ? "Not now" : "I can't do it tonight"}</Text>
        </PressScale>
      </View>
    </View>
  );
};

const Question = ({
  eyebrow,
  title,
  options,
  value,
  onPick,
  context,
}: {
  eyebrow?: string;
  title: string;
  options: readonly { key: string; label: string }[];
  value: string | null;
  onPick: (key: string) => void;
  context?: ReactNode;
}) => (
  <View style={styles.fill}>
    <View>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </View>
    {context ? <View style={styles.context}>{context}</View> : null}
    <View style={styles.answers}>
      {options.map((o, i) => (
        <Answer
          key={o.key}
          label={o.label}
          order={i}
          on={o.key === value}
          onPress={() => {
            void Haptics.selectionAsync();
            onPick(o.key);
          }}
        />
      ))}
    </View>
  </View>
);

const METRIC: Record<HealthKey, { Glyph: ComponentType<IconProps>; tip: string; labels: readonly { key: string; label: string }[] }> = {
  appetite: { Glyph: BowlFoodIcon, tip: "Count meals and treats together.", labels: APPETITE },
  energy: { Glyph: LightningIcon, tip: "Compare with a usual day, not the best one.", labels: ENERGY },
  stool: { Glyph: ToiletPaperIcon, tip: "Soft holds its shape but is mushy. Diarrhea does not.", labels: STOOL },
  urination: { Glyph: ToiletIcon, tip: "Straining or only a few drops counts as difficulty.", labels: URINATION },
  drinking: { Glyph: DropIcon, tip: "A hot day or a long walk can mean more water.", labels: DRINKING },
};
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];

/** A quieter middle for questions without a weekly pattern: the subject's icon and one useful line. */
const SimpleContext = ({ Glyph, line }: { Glyph: ComponentType<IconProps>; line: string }) => {
  const reduceMotion = useReducedMotion();
  return (
    <View style={styles.week}>
      <Animated.View entering={reduceMotion ? undefined : enter({ scale: 0.92 }, { duration: motion.duration.enter })} style={styles.weekMedal}>
        <Glyph size={34} color={text.primary} weight="regular" />
      </Animated.View>
      <Text style={[styles.weekTip, styles.simpleLine]}>{line}</Text>
    </View>
  );
};

/**
 * The middle of each question: what this answer looked like over the last week, so a change stands out while
 * answering. Seven dots (sage for normal, amber for anything else, empty for no check-in) and one tip on how to judge.
 */
const RecentWeek = ({ metric, history, name }: { metric: HealthKey; history: readonly DailyCheckIn[]; name: string }) => {
  const reduceMotion = useReducedMotion();
  const { Glyph, tip, labels } = METRIC[metric];
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = history.find((h) => h.date === key);
    const value = (entry?.[metric] as string | null | undefined) ?? null;
    return { key, letter: LETTER[d.getDay()], value };
  });
  const answered = days.filter((d) => d.value);
  const off = answered.filter((d) => d.value !== "normal" && d.value !== "unsure");
  const yesterday = days[6].value;
  const summary = !answered.length
    ? `The first one. From here, PAWS shows how ${name} is trending.`
    : off.length === 0
      ? `Normal on all ${answered.length} ${answered.length === 1 ? "day" : "days"} checked this week.`
      : yesterday && yesterday !== "normal"
        ? `Yesterday: ${labels.find((l) => l.key === yesterday)?.label.toLowerCase() ?? yesterday}.`
        : `Off on ${off.length} of the last ${answered.length} check-ins.`;

  return (
    <View style={styles.week} accessibilityRole="summary" accessibilityLabel={`Last 7 days. ${summary}`}>
      <Animated.View entering={reduceMotion ? undefined : enter({ scale: 0.92 }, { duration: motion.duration.enter })} style={styles.weekMedal}>
        <Glyph size={34} color={text.primary} weight="regular" />
      </Animated.View>
      <View style={styles.weekDots}>
        {days.map((d, i) => (
          <Animated.View key={d.key} entering={reduceMotion ? undefined : enter({ y: 6 }, { delay: 80 + i * 30, duration: motion.duration.enter })} style={styles.weekDay}>
            <View style={[styles.weekDot, d.value === "normal" && styles.weekDotOk, d.value && d.value !== "normal" && d.value !== "unsure" && styles.weekDotOff, d.value === "unsure" && styles.weekDotOk]} />
            <Text style={styles.weekLetter}>{d.letter}</Text>
          </Animated.View>
        ))}
      </View>
      <Text style={styles.weekSummary}>{summary}</Text>
      <Text style={styles.weekTip}>{tip}</Text>
    </View>
  );
};

/** One answer: a full-width row; picking it fills it butter and ticks the dot before the screen moves on. */
const Answer = ({ label, order, on, onPress, multi = false }: { label: string; order: number; on: boolean; onPress: () => void; multi?: boolean }) => {
  const reduceMotion = useReducedMotion();
  const lit = useDerivedValue(() => (reduceMotion ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out })), [on]);
  const face = useAnimatedStyle(() => ({ opacity: lit.value }));
  return (
    <Animated.View entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: 60 + order * 40, duration: motion.duration.enter })}>
      <PressScale
        accessibilityRole={multi ? "checkbox" : "radio"}
        accessibilityState={multi ? { checked: on } : { selected: on }}
        accessibilityLabel={label}
        scaleTo={0.98}
        style={styles.answer}
        onPress={onPress}
      >
        <Animated.View style={[styles.answerOn, face]} pointerEvents="none" />
        <View style={[multi ? styles.box : styles.radio, on && styles.markOn]}>{on ? multi ? <CheckIcon size={13} color={text.inverse} weight="bold" /> : <View style={styles.radioCore} /> : null}</View>
        <Text style={[styles.answerText, on && styles.answerTextOn]}>{label}</Text>
      </PressScale>
    </Animated.View>
  );
};

const Unusual = ({ draft, onChange, onNext }: { draft: Draft; onChange: (patch: Partial<Draft>) => void; onNext: () => void }) => {
  const toggle = (key: UnusualSign) => {
    void Haptics.selectionAsync();
    onChange({ unusual: draft.unusual.includes(key) ? draft.unusual.filter((k) => k !== key) : [...draft.unusual, key] });
  };
  return (
    <View style={styles.fill}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>Pick any that apply</Text>
        <Text style={styles.title} accessibilityRole="header">
          Anything unusual today?
        </Text>
        <View style={styles.answers}>
          {UNUSUAL.map((u, i) => (
            <Answer key={u.key} label={u.label} order={i} multi on={draft.unusual.includes(u.key)} onPress={() => toggle(u.key)} />
          ))}
        </View>
        {draft.unusual.length ? (
          <TextInput
            style={styles.note}
            value={draft.unusualNote}
            onChangeText={(unusualNote) => onChange({ unusualNote })}
            placeholder={draft.unusual.includes("other") ? "What did you notice?" : "Anything more? When it started, how often (optional)"}
            placeholderTextColor={text.tertiary}
            multiline
          />
        ) : null}
      </ScrollView>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={draft.unusual.length ? "Next" : "Nothing unusual"}
        scaleTo={0.97}
        style={styles.primary}
        onPress={() => {
          void Haptics.selectionAsync();
          onNext();
        }}
      >
        <Text style={styles.primaryText}>{draft.unusual.length ? "Next" : "Nothing unusual"}</Text>
      </PressScale>
    </View>
  );
};

const LEVEL: Record<SupportLevel, { label: string; dot: string }> = {
  home: { label: "Watch at home", dot: scene.sageDeep },
  call: { label: "Call your vet", dot: accent.band },
  urgent: { label: "Go to a vet now", dot: "#C2412D" },
};

/**
 * Support for what was just logged. The answer is ready in a few seconds; until then the screen holds its shape with
 * soft placeholder bars so nothing jumps. An urgent answer puts Find a vet first.
 */
const Support = ({
  draft,
  history,
  dog,
  onReady,
  onNext,
  onFindVet,
}: {
  draft: Draft;
  history: readonly DailyCheckIn[];
  dog: SupportDog;
  onReady: (support: CheckInSupport) => void;
  onNext: () => void;
  onFindVet: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const signature = `${[...draft.unusual].sort().join(",")}|${draft.unusualNote.trim()}`;
  const [answer, setAnswer] = useState<{ for: string; support: CheckInSupport } | null>(draft.support ? { for: signature, support: draft.support } : null);
  const ready = answer?.for === signature ? answer.support : null;

  useEffect(() => {
    if (ready) return;
    let live = true;
    void supportFor(draft, history, dog).then((support) => {
      if (!live) return;
      void Haptics.selectionAsync();
      setAnswer({ for: signature, support });
      onReady(support);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const pulse = useSharedValue(0.5);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: 700, easing: motion.easing.inOut }), -1, true);
  }, [pulse, reduceMotion]);
  const shimmer = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const urgent = ready?.level === "urgent";
  return (
    <View style={styles.fill}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{`About ${dog.name} today`}</Text>
        {ready ? (
          <Animated.View entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })}>
            <Text style={styles.title} accessibilityRole="header">
              {ready.headline}
            </Text>
            <View style={styles.level}>
              <View style={[styles.levelDot, { backgroundColor: LEVEL[ready.level].dot }]} />
              <Text style={styles.levelText}>{LEVEL[ready.level].label}</Text>
            </View>
            <Text style={styles.supportBody}>{ready.summary}</Text>

            {ready.steps.length ? (
              <View style={styles.supportBlock}>
                <Text style={styles.supportLabel}>Tonight</Text>
                {ready.steps.map((step, i) => (
                  <Animated.View key={step} entering={reduceMotion ? undefined : enter({ y: 6 }, { delay: 120 + i * 60, duration: motion.duration.enter })} style={styles.supportRow}>
                    <View style={styles.supportCheck}>
                      <CheckIcon size={11} color={text.primary} weight="bold" />
                    </View>
                    <Text style={styles.supportText}>{step}</Text>
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {ready.watch.length ? (
              <View style={styles.supportBlock}>
                <Text style={styles.supportLabel}>Call sooner if</Text>
                {ready.watch.map((sign, i) => (
                  <Animated.View key={sign} entering={reduceMotion ? undefined : enter({ y: 6 }, { delay: 300 + i * 60, duration: motion.duration.enter })} style={styles.supportRow}>
                    <View style={styles.supportFlag} />
                    <Text style={styles.supportText}>{sign}</Text>
                  </Animated.View>
                ))}
              </View>
            ) : null}
            <Text style={styles.supportFine}>Not a diagnosis. Your vet knows best.</Text>
          </Animated.View>
        ) : (
          <View accessibilityRole="progressbar" accessibilityLabel="Looking at today">
            <Text style={styles.title}>Looking at today</Text>
            <Animated.View style={shimmer}>
              <View style={[styles.bar, { width: "42%", height: 30, marginTop: space.lg }]} />
              <View style={[styles.bar, { width: "100%", marginTop: space.xl }]} />
              <View style={[styles.bar, { width: "88%" }]} />
              <View style={[styles.bar, { width: "64%" }]} />
              <View style={[styles.bar, { width: "76%", marginTop: space.xl }]} />
              <View style={[styles.bar, { width: "58%" }]} />
            </Animated.View>
          </View>
        )}
      </ScrollView>

      {urgent ? (
        <View>
          <PressScale accessibilityRole="button" accessibilityLabel="Find a vet now" scaleTo={0.97} style={[styles.primary, styles.primaryUrgent]} onPress={onFindVet}>
            <Text style={[styles.primaryText, styles.primaryTextUrgent]}>Find a vet now</Text>
          </PressScale>
          <PressScale accessibilityRole="button" accessibilityLabel="Continue the check-in" scaleTo={0.97} style={styles.secondary} onPress={onNext}>
            <Text style={styles.secondaryText}>Continue the check-in</Text>
          </PressScale>
        </View>
      ) : (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: !ready }}
          disabled={!ready}
          scaleTo={0.97}
          style={[styles.primary, !ready && styles.primaryOff]}
          onPress={() => {
            void Haptics.selectionAsync();
            onNext();
          }}
        >
          <Text style={[styles.primaryText, !ready && styles.primaryTextOff]}>Continue</Text>
        </PressScale>
      )}
    </View>
  );
};

/** Movement: four quick signs that Activity trends and Health raises when they persist. */
const Movement = ({ name, signs, onToggle, onNext }: { name: string; signs: readonly MobilitySign[]; onToggle: (sign: MobilitySign) => void; onNext: () => void }) => (
  <View style={styles.fill}>
    <View>
      <Text style={styles.eyebrow}>Movement</Text>
      <Text style={styles.title} accessibilityRole="header">{`Did ${name} have any of these?`}</Text>
    </View>
    <View style={styles.context}>
      <SimpleContext Glyph={PawPrintIcon} line="Only what you saw today. PAWS looks for patterns across the week." />
    </View>
    <View>
      <View style={styles.answers}>
        {(Object.keys(MOBILITY_LABEL) as MobilitySign[]).map((sign, i) => (
          <Answer key={sign} label={MOBILITY_LABEL[sign]} order={i} multi on={signs.includes(sign)} onPress={() => onToggle(sign)} />
        ))}
      </View>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={signs.length ? "Next" : "None of these"}
        scaleTo={0.97}
        style={styles.primary}
        onPress={() => {
          void Haptics.selectionAsync();
          onNext();
        }}
      >
        <Text style={styles.primaryText}>{signs.length ? "Next" : "None of these"}</Text>
      </PressScale>
    </View>
  </View>
);

const Routine = ({
  name,
  time,
  skipping,
  noPawsWalk,
  choice,
  openSchedule,
  onChoice,
  onSchedule,
  onDone,
}: {
  name: string;
  time: string;
  skipping: boolean;
  noPawsWalk: boolean;
  choice: RoutineChoice | null;
  openSchedule: boolean;
  onChoice: (c: RoutineChoice) => void;
  onSchedule: () => void;
  onDone: () => void;
}) => {
  const options: { key: RoutineChoice; label: string }[] = skipping
    ? [
        { key: "skip", label: "Just skip tonight" },
        { key: "change", label: "Change my schedule" },
        { key: "pause", label: "Pause check-ins" },
      ]
    : [
        { key: "keep", label: "Yes, keep it as is" },
        { key: "change", label: "Change my schedule" },
        { key: "pause", label: "Pause check-ins" },
      ];
  return (
    <View style={styles.fill}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{skipping ? "Skipping tonight" : "One last thing"}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {skipping ? "What would make it easier?" : "Is this routine working for you?"}
        </Text>
        <Text style={styles.lede}>
          {skipping
            ? `The check-in is how PAWS notices when ${name} is off. A better time might help.`
            : noPawsWalk
              ? `No walk was tracked with PAWS today. If the times do not suit your day, change them so PAWS fits around you.`
              : `A minute each evening keeps ${name}'s health picture complete.`}
        </Text>
        <View style={styles.answers}>
          {options.map((o, i) => (
            <Answer key={o.key} label={o.label} order={i} on={choice === o.key} onPress={() => onChoice(o.key)} />
          ))}
        </View>

        {choice === "change" ? (
          <Animated.View entering={enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.change}>
            <Text style={styles.changeLabel}>Check-in time</Text>
            <View style={styles.times}>
              {EVENING.map((slot) => {
                const on = slot === time;
                return (
                  <PressScale
                    key={slot}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={prettyTime(slot)}
                    scaleTo={0.95}
                    style={[styles.time, on && styles.timeOn]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setCheckInTime(slot);
                    }}
                  >
                    <Text style={[styles.timeText, on && styles.timeTextOn]}>{prettyTime(slot)}</Text>
                  </PressScale>
                );
              })}
            </View>
            <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: openSchedule }} accessibilityLabel="Also change walks and routines" scaleTo={0.98} style={styles.toggleRow} onPress={onSchedule}>
              <View style={[styles.box, openSchedule && styles.markOn]}>{openSchedule ? <CheckIcon size={13} color={text.inverse} weight="bold" /> : null}</View>
              <Text style={styles.toggleText}>Also change walks and routines</Text>
            </PressScale>
          </Animated.View>
        ) : choice === "pause" ? (
          <Text style={styles.pauseNote}>You can turn check-ins back on from Health whenever you like.</Text>
        ) : null}
      </ScrollView>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Done"
        accessibilityState={{ disabled: !choice }}
        disabled={!choice}
        scaleTo={0.97}
        style={[styles.primary, !choice && styles.primaryOff]}
        onPress={onDone}
      >
        <Text style={[styles.primaryText, !choice && styles.primaryTextOff]}>Done</Text>
      </PressScale>
    </View>
  );
};

// ---------- Catching up on missed days ----------

type CatchStep = { kind: "intro" } | { kind: "day"; index: number } | { kind: "off"; index: number } | { kind: "time" } | { kind: "done" };

const ALL_NORMAL: Draft = { ...EMPTY, appetite: "normal", energy: "normal", stool: "normal", urination: "normal", drinking: "normal" };

/** What can be remembered a day later, in plain words. Each maps onto the same fields as the evening check-in. */
const RECALL: readonly { key: string; label: string; patch: Partial<Draft>; sign?: UnusualSign }[] = [
  { key: "appetite", label: "Ate less", patch: { appetite: "less" } },
  { key: "energy", label: "Low energy", patch: { energy: "low" } },
  { key: "stool", label: "Loose stool", patch: { stool: "soft" } },
  ...UNUSUAL.map((u) => ({ key: u.key, label: u.label, patch: {}, sign: u.key })),
];

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dayWord = (date: string) => {
  if (date === shiftDay(todayKey(), -1)) return "yesterday";
  const [y, m, d] = date.split("-").map(Number);
  return `on ${WEEKDAY[new Date(y, m - 1, d).getDay()]}`;
};

/**
 * Shown when PAWS opens after missed check-ins. It names the gap plainly (the missed days are the only red on the
 * screen), then asks one question per day, from memory: all normal, something was off, or I don't remember. Two
 * misses in a row, or three in a week, also asks whether the check-in time is the problem. Leaving the gaps is always
 * possible; they stay marked as missed.
 */
const CatchUp = ({ name, time, dueNow, onFinished }: { name: string; time: string; dueNow: boolean; onFinished: (left: boolean) => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const consistency = useConsistency();
  // The days are fixed when it opens, so filling one in does not reshuffle the rest.
  const [days] = useState(() => consistency.catchUp);
  const [slipping] = useState(() => consistency.level === "slipping");
  const [run] = useState(() => consistency.missedRun);
  const [step, setStep] = useState<CatchStep>({ kind: "intro" });
  const [direction, setDirection] = useState(1);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [slot, setSlot] = useState(time);
  const [filled, setFilled] = useState(0);

  const go = (next: CatchStep, dir = 1) => {
    setDirection(dir);
    setStep(next);
  };
  const afterBeat = (fn: () => void) => (reduceMotion ? fn() : setTimeout(fn, 220));
  const nextAfter = (index: number) => (index + 1 < days.length ? { kind: "day" as const, index: index + 1 } : slipping ? { kind: "time" as const } : { kind: "done" as const });

  const save = (index: number, entry: Draft) => {
    submitCatchUp(days[index], entry);
    setFilled((n) => n + 1);
  };

  const lift = useSharedValue(0);
  const coverStyle = useAnimatedStyle(() => ({ opacity: 1 - lift.value, transform: [{ scale: 1 + lift.value * 0.04 }] }));
  // Finishing settles every missed day; leaving early settles none, so Care stays locked until they are answered.
  const close = (left = false) => {
    if (left) void Haptics.selectionAsync();
    else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      settleMissedThrough(shiftDay(todayKey(), -1));
    }
    if (reduceMotion) return onFinished(left);
    lift.value = withTiming(1, { duration: 280, easing: motion.easing.out });
    setTimeout(() => onFinished(left), 290);
  };

  const position = step.kind === "day" || step.kind === "off" ? step.index : null;
  const progress = position != null ? (position + 1) / (days.length + (slipping ? 1 : 0)) : step.kind === "time" ? 1 : null;
  const back = () => {
    void Haptics.selectionAsync();
    if (step.kind === "off") return go({ kind: "day", index: step.index }, -1);
    if (step.kind === "day") return go(step.index === 0 ? { kind: "intro" } : { kind: "day", index: step.index - 1 }, -1);
    if (step.kind === "time") return go({ kind: "day", index: days.length - 1 }, -1);
  };
  const stepKey = step.kind === "day" || step.kind === "off" ? `${step.kind}-${step.index}` : step.kind;

  return (
    <Animated.View style={[styles.cover, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }, coverStyle]} accessibilityViewIsModal>
      <View style={styles.top}>
        {step.kind !== "intro" && step.kind !== "done" ? (
          <PressScale accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.92} style={styles.round} onPress={back}>
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
        ) : (
          <View style={styles.roundSpacer} />
        )}
        {progress != null ? <Progress value={progress} /> : <View style={styles.flex} />}
        <View style={styles.roundSpacer} />
      </View>

      <Animated.View key={stepKey} entering={reduceMotion ? undefined : enter({ x: direction * 28 }, { duration: motion.duration.enter })} style={styles.body}>
        {step.kind === "intro" ? (
          <View style={styles.fill}>
            <View style={styles.introTop}>
              <View style={styles.catchWeek}>
                <WeekMarks week={consistency.week} size={36} />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                {run > 1 ? `${run} days without a check-in` : `${name}'s day ${dayWord(days[0])} is blank`}
              </Text>
              <Text style={styles.lede}>{`Gaps hide changes in ${name}'s health. Care stays locked until you catch up.`}</Text>
            </View>
            <View>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Catch up"
                scaleTo={0.97}
                style={styles.primary}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  go({ kind: "day", index: 0 });
                }}
              >
                <Text style={styles.primaryText}>{days.length === 1 ? "Fill it in" : `Catch up on ${days.length} days`}</Text>
              </PressScale>
              <PressScale accessibilityRole="button" accessibilityLabel="Not now. Care stays locked" scaleTo={0.96} style={styles.quiet} onPress={() => close(true)}>
                <Text style={styles.quietText}>Not now</Text>
              </PressScale>
            </View>
          </View>
        ) : step.kind === "day" ? (
          <Question
            eyebrow={days.length > 1 ? `Catching up, ${step.index + 1} of ${days.length}` : "Catching up"}
            title={`How was ${name} ${dayWord(days[step.index])}?`}
            options={[
              { key: "normal", label: "All normal" },
              { key: "off", label: "Something was off" },
              { key: "unknown", label: "I don't remember" },
            ]}
            value={null}
            context={<WeekMarks week={consistency.week} focus={days[step.index]} size={36} animate={false} />}
            onPick={(key) => {
              const index = step.index;
              if (key === "off") {
                setPicked([]);
                return afterBeat(() => go({ kind: "off", index }));
              }
              if (key === "normal") save(index, ALL_NORMAL);
              // An honest "I don't remember" settles the day: it stays a gap, but it no longer holds Care locked.
              if (key === "unknown") settleMissedThrough(days[index]);
              afterBeat(() => go(nextAfter(index)));
            }}
          />
        ) : step.kind === "off" ? (
          <View style={styles.fill}>
            <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.eyebrow}>Pick any you remember</Text>
              <Text style={styles.title} accessibilityRole="header">
                What was off?
              </Text>
              <View style={styles.answers}>
                {RECALL.map((r, i) => (
                  <Answer
                    key={r.key}
                    label={r.label}
                    order={i}
                    multi
                    on={picked.includes(r.key)}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setPicked((now) => (now.includes(r.key) ? now.filter((k) => k !== r.key) : [...now, r.key]));
                    }}
                  />
                ))}
              </View>
            </ScrollView>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Save this day"
              accessibilityState={{ disabled: !picked.length }}
              disabled={!picked.length}
              scaleTo={0.97}
              style={[styles.primary, !picked.length && styles.primaryOff]}
              onPress={() => {
                const chosen = RECALL.filter((r) => picked.includes(r.key));
                const entry = chosen.reduce<Draft>((acc, r) => ({ ...acc, ...r.patch }), { ...EMPTY, unusual: chosen.flatMap((r) => (r.sign ? [r.sign] : [])) });
                void Haptics.selectionAsync();
                save(step.index, entry);
                go(nextAfter(step.index));
              }}
            >
              <Text style={[styles.primaryText, !picked.length && styles.primaryTextOff]}>Save this day</Text>
            </PressScale>
          </View>
        ) : step.kind === "time" ? (
          <View style={styles.fill}>
            <View>
              <Text style={styles.eyebrow}>Make it easier to keep</Text>
              <Text style={styles.title} accessibilityRole="header">{`Is ${prettyTime(time)} the right time?`}</Text>
              <Text style={styles.lede}>Right after dinner is the easiest time to remember.</Text>
              <View style={styles.times}>
                {EVENING.map((t) => {
                  const on = t === slot;
                  return (
                    <PressScale
                      key={t}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={prettyTime(t)}
                      scaleTo={0.94}
                      style={[styles.time, on && styles.timeOn]}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setSlot(t);
                      }}
                    >
                      <Text style={[styles.timeText, on && styles.timeTextOn]}>{prettyTime(t)}</Text>
                    </PressScale>
                  );
                })}
              </View>
            </View>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={slot === time ? `Keep ${prettyTime(time)}` : `Move to ${prettyTime(slot)}`}
              scaleTo={0.97}
              style={styles.primary}
              onPress={() => {
                if (slot !== time) setCheckInTime(slot);
                void Haptics.selectionAsync();
                go({ kind: "done" });
              }}
            >
              <Text style={styles.primaryText}>{slot === time ? `Keep ${prettyTime(time)}` : `Move to ${prettyTime(slot)}`}</Text>
            </PressScale>
          </View>
        ) : (
          <View style={styles.fill}>
            <View style={styles.introTop}>
              <View style={styles.catchWeek}>
                <WeekMarks week={consistency.week} size={36} />
              </View>
              <Text style={styles.title} accessibilityRole="header">
                {filled ? "Back on track" : "Care is unlocked"}
              </Text>
              <Text style={styles.lede}>
                {dueNow ? `Today's check-in is next.` : `Next check-in tonight at ${prettyTime(slot)}. PAWS will remind you.`}
              </Text>
            </View>
            <PressScale accessibilityRole="button" accessibilityLabel={dueNow ? "Go to today's check-in" : "Back to PAWS"} scaleTo={0.97} style={styles.primary} onPress={() => close()}>
              <Text style={styles.primaryText}>{dueNow ? "On to today" : "Back to PAWS"}</Text>
            </PressScale>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const Done = ({ name, ending, time, onClose }: { name: string; ending: "saved" | "skipped" | "paused"; time: string; onClose: () => void }) => {
  const reduceMotion = useReducedMotion();
  const skipped = ending === "skipped";
  const paused = ending === "paused";
  return (
    <View style={styles.fill}>
      <View style={styles.introTop}>
        <Animated.View entering={reduceMotion ? undefined : enter({ scale: 0.6, rotate: -20 }, { delay: 80, duration: 420 })} style={[styles.introMark, styles.doneMark]}>
          {skipped || paused ? <MoonStarsIcon size={32} color={text.primary} weight="fill" /> : <CheckIcon size={34} color={text.primary} weight="bold" />}
        </Animated.View>
        <Text style={styles.title} accessibilityRole="header">
          {paused ? "Check-ins are paused" : skipped ? "Okay, not tonight" : `${name}'s day is saved`}
        </Text>
        <Text style={styles.lede}>
          {paused
            ? "PAWS will not ask in the evening until you turn it back on."
            : skipped
              ? "No problem. PAWS will ask again tomorrow."
              : `Thank you. PAWS will ask again tomorrow at ${prettyTime(time)}.`}
        </Text>
      </View>
      <PressScale accessibilityRole="button" accessibilityLabel="Back to PAWS" scaleTo={0.97} style={styles.primary} onPress={onClose}>
        <Text style={styles.primaryText}>Back to PAWS</Text>
      </PressScale>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flex: 1, justifyContent: "space-between" },
  cover: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: bg.canvas, paddingHorizontal: layout.gutter },
  top: { flexDirection: "row", alignItems: "center", gap: space.md, height: 44 },
  round: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  roundSpacer: { width: 44, height: 44 },
  progress: { flex: 1, height: 6, borderRadius: 3, backgroundColor: bg.subtle, overflow: "hidden" },
  progressFill: { flex: 1, borderRadius: 3, backgroundColor: accent.band, transformOrigin: "left" },

  body: { flex: 1, paddingTop: space.xxl },
  scroll: { paddingBottom: space.xl },

  introTop: { flex: 1, justifyContent: "center", paddingBottom: space.section },
  introMark: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center", marginBottom: space.xl },
  doneMark: { backgroundColor: accent.deep },
  eyebrow: { ...type.supporting, color: text.secondary },
  title: { ...type.pageTitle, fontSize: 30, lineHeight: 35, color: text.primary, marginTop: space.xs },
  lede: { ...type.body, color: text.secondary, marginTop: space.md },

  answers: { gap: space.sm, marginTop: space.xl },
  context: { flex: 1, justifyContent: "center" },
  week: { alignItems: "center", paddingVertical: space.lg },
  weekMedal: { width: 88, height: 88, borderRadius: 44, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  weekDots: { flexDirection: "row", gap: space.md, marginTop: space.xl },
  weekDay: { alignItems: "center", gap: 6 },
  weekDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: border.default },
  weekDotOk: { backgroundColor: scene.sageDeep, borderColor: scene.sageDeep },
  weekDotOff: { backgroundColor: accent.band, borderColor: accent.band },
  weekLetter: { ...type.caption, fontSize: 11, color: text.tertiary },
  weekSummary: { ...type.supporting, fontWeight: "600", color: text.primary, textAlign: "center", marginTop: space.lg, paddingHorizontal: space.lg },
  simpleLine: { marginTop: space.lg, maxWidth: 300 },
  weekTip: { ...type.supporting, color: text.secondary, textAlign: "center", marginTop: 4, paddingHorizontal: space.lg },
  answer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 60,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
    overflow: "hidden",
  },
  answerOn: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: accent.primary, borderRadius: radius.card },
  answerText: { ...type.cardTitle, color: text.primary },
  answerTextOn: { fontWeight: "600" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  radioCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: text.inverse },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  markOn: { backgroundColor: text.primary, borderColor: text.primary },
  note: { marginTop: space.md, minHeight: 72, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.default, ...type.body, color: text.primary, textAlignVertical: "top" },

  change: { marginTop: space.xl },
  changeLabel: { ...type.supporting, fontWeight: "600", color: text.primary },
  times: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  time: { height: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, justifyContent: "center" },
  timeOn: { backgroundColor: text.primary, borderColor: text.primary },
  timeText: { ...type.supporting, color: text.primary, fontVariant: ["tabular-nums"] },
  timeTextOn: { color: text.inverse, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  toggleText: { ...type.body, color: text.primary },
  pauseNote: { ...type.supporting, color: text.secondary, marginTop: space.lg },

  primary: { height: layout.controlHeight + 4, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center", marginTop: space.lg },
  primaryOff: { backgroundColor: bg.subtle },
  primaryText: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary },
  primaryTextOff: { color: text.disabled },
  primaryUrgent: { backgroundColor: text.primary },
  primaryTextUrgent: { color: text.inverse },
  secondary: { height: 48, alignItems: "center", justifyContent: "center", marginTop: space.xs },
  secondaryText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  level: { flexDirection: "row", alignItems: "center", gap: space.sm, alignSelf: "flex-start", marginTop: space.lg, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  levelDot: { width: 9, height: 9, borderRadius: 4.5 },
  levelText: { ...type.supporting, fontWeight: "600", color: text.primary },
  supportBody: { ...type.body, color: text.secondary, marginTop: space.lg },
  supportBlock: { marginTop: space.xl, gap: space.sm },
  supportLabel: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginBottom: 2 },
  supportRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  supportCheck: { width: 20, height: 20, borderRadius: 10, marginTop: 2, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  supportFlag: { width: 8, height: 8, borderRadius: 4, marginTop: 8, marginHorizontal: 6, backgroundColor: accent.band },
  supportText: { ...type.body, color: text.primary, flex: 1 },
  supportFine: { ...type.caption, color: text.tertiary, marginTop: space.xl },
  bar: { height: 14, borderRadius: 7, backgroundColor: bg.subtle, marginTop: space.sm },
  catchWeek: { marginBottom: space.xxl },
  quiet: { alignSelf: "center", paddingVertical: space.md, paddingHorizontal: space.xl, marginTop: space.xs },
  quietText: { ...type.supporting, fontWeight: "600", color: text.secondary },
});
