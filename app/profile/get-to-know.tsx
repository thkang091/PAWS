import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CheckIcon, GraduationCapIcon, HeartIcon, SealCheckIcon } from "phosphor-react-native";

import { SetupShell, setupText } from "@/features/care/components/SetupShell";
import { goBack } from "@/features/care/components/DetailShell";
import { enter } from "@/features/care/food/enter";
import { saveFeedingProfile, useFoodPlan } from "@/features/care/state/foodPlan";
import { AGE_CHOICES, BREED_CHOICES, tailoring, type Area } from "@/features/profile/intel/getToKnow";
import { setByKey, typicalEnergy, type SetKey, type SetQuestion } from "@/features/profile/intel/profileSets";
import { saveSetAnswer, useProfileSets } from "@/features/profile/intel/useProfileSets";
import { PressScale } from "@/components/ui/PressScale";
import { queryKeys } from "@/constants/queryKeys";
import { useSaveWeightLog } from "@/hooks/useWeightLogs";
import { updateDogBasics } from "@/services/profileService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

/**
 * One profile set at a time, one question a screen. A single answer moves on by itself; several take Next. Every
 * question says what it changes. Breed, age, sex and weight write to the dog's record; the rest to the synced
 * profile. Follow-ups (how often a problem happens) appear only for what was picked. `?q=<id>&only=1` edits one answer.
 */
export default function GetToKnowScreen() {
  const params = useLocalSearchParams<{ set?: string; q?: string; only?: string }>();
  const setKey = (setByKey(params.set ?? "")?.key ?? "personality") as SetKey;
  const profile = useProfileSets();
  const state = profile.get(setKey);
  const queryClient = useQueryClient();
  const saveWeight = useSaveWeightLog(profile.dogId ?? "");
  const food = useFoodPlan();
  const reduceMotion = useReducedMotion();
  const only = params.only === "1";

  const steps: SetQuestion[] = only ? state.questions.filter((q) => q.id === params.q) : state.questions;
  const startAt = useRef<number | null>(null);
  if (startAt.current == null) {
    const at = params.q ? steps.findIndex((q) => q.id === params.q) : steps.findIndex((q) => !state.answers[q.id]);
    startAt.current = Math.max(0, at);
  }

  const [step, setStep] = useState(startAt.current);
  const [direction, setDirection] = useState(1);
  const [done, setDone] = useState(false);
  const [custom, setCustom] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">(profile.unit);
  const question = steps[step] ?? null;
  const saved = question ? (state.answers[question.id] ?? "") : "";
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    setPicked(saved && !question?.special ? saved.split(", ") : []);
    setCustom("");
    // Load the saved answer when the question changes, not on every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, question?.id]);

  const back = `/profile/${setKey}`;
  const go = (to: number) => {
    if (to >= steps.length) {
      if (only) return goBack(back);
      setDone(true);
      return;
    }
    setDirection(to > step ? 1 : -1);
    setStep(Math.max(0, to));
  };
  const later = (fn: () => void) => (reduceMotion ? fn() : setTimeout(fn, 260));
  const refreshDog = () => void queryClient.invalidateQueries({ queryKey: queryKeys.currentDog });
  const writeDog = (values: Parameters<typeof updateDogBasics>[1]) => {
    if (profile.dogId) void updateDogBasics(profile.dogId, values).then(refreshDog).catch(() => undefined);
  };

  const store = (q: SetQuestion, values: string[]) => {
    if (!values.length) return;
    const value = values.join(", ");
    saveSetAnswer(setKey, q.id, value, profile.dogId);
    // Spayed or neutered changes calories, so the Food Plan hears about it straight away.
    if (q.id === "fixed" && value !== "Not sure") saveFeedingProfile({ ...food.profile, neutered: value === "Yes" });
  };

  if (done || !question) return <Finished setKey={setKey} />;

  const shell = (primary: Parameters<typeof SetupShell>[0]["primary"], children: ReactNode) => (
    <SetupShell step={step} total={steps.length} direction={direction} closing={step === 0} onBack={() => (step === 0 ? goBack(back) : go(step - 1))} primary={primary}>
      <Text style={setupText.title}>{question.prompt(profile.name)}</Text>
      <Why area={question.area} text={question.why} />
      {children}
    </SetupShell>
  );

  const tiles = (labels: readonly { label: string; sub?: string }[], onPick: (label: string) => void, isOn: (label: string) => boolean, multi = false, hint?: (label: string) => string | null) => (
    <View style={styles.options}>
      {labels.map((option, i) => (
        <OptionTile key={option.label} order={i} label={option.label} sub={option.sub} hint={hint?.(option.label) ?? null} on={isOn(option.label)} multi={multi} reduceMotion={reduceMotion} onPress={() => onPick(option.label)} />
      ))}
    </View>
  );

  // ---------- Questions that write to the dog's record ----------
  if (question.special === "breed") {
    const other = picked[0] === "Something else";
    return shell(
      other
        ? {
            label: "Next",
            disabled: custom.trim().length < 2,
            onPress: () => {
              writeDog({ breed: custom.trim() });
              go(step + 1);
            },
          }
        : null,
      <>
        {tiles(
          BREED_CHOICES.map((label) => ({ label })),
          (label) => {
            void Haptics.selectionAsync();
            setPicked([label]);
            if (label === "Something else") return;
            writeDog({ breed: label });
            later(() => go(step + 1));
          },
          (label) => picked[0] === label || (!picked.length && saved === label),
        )}
        {other ? <TextInput style={styles.input} value={custom} onChangeText={setCustom} placeholder="Type the breed" placeholderTextColor={text.tertiary} autoFocus accessibilityLabel="Breed" /> : null}
      </>,
    );
  }

  if (question.special === "age") {
    return shell(
      null,
      tiles(
        AGE_CHOICES.map((c) => ({ label: c.label })),
        (label) => {
          void Haptics.selectionAsync();
          setPicked([label]);
          const years = AGE_CHOICES.find((c) => c.label === label)!.years;
          writeDog({ age_years: years });
          saveSetAnswer("basics", "ageUnsure", "");
          later(() => go(step + 1));
        },
        (label) => picked[0] === label,
      ),
    );
  }

  if (question.special === "sex") {
    return shell(
      null,
      tiles(
        question.options,
        (label) => {
          void Haptics.selectionAsync();
          setPicked([label]);
          writeDog({ gender: label === "Boy" ? "male" : "female" });
          later(() => go(step + 1));
        },
        (label) => picked[0] === label || (!picked.length && saved === label),
      ),
    );
  }

  if (question.special === "weight") {
    const value = Number(custom.replace(",", "."));
    const valid = Number.isFinite(value) && value > 0.3 && value < (unit === "kg" ? 120 : 260);
    return shell(
      {
        label: "Save weight",
        done: true,
        disabled: !valid,
        onPress: () => {
          if (profile.dogId) saveWeight.mutate({ dogId: profile.dogId, weightValue: Math.round(value * 10) / 10, weightUnit: unit, recordedAt: new Date().toISOString(), note: null });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          go(step + 1);
        },
      },
      <>
        <View style={styles.weightRow}>
          <TextInput
            style={styles.weightInput}
            value={custom}
            onChangeText={setCustom}
            placeholder={saved ? saved.split(" ")[0] : "0"}
            placeholderTextColor={text.disabled}
            keyboardType="decimal-pad"
            autoFocus
            accessibilityLabel="Weight"
          />
          <View style={styles.units}>
            {(["kg", "lb"] as const).map((u) => (
              <PressScale key={u} accessibilityRole="radio" accessibilityState={{ selected: unit === u }} accessibilityLabel={u} scaleTo={0.95} style={[styles.unit, unit === u && styles.unitOn]} onPress={() => setUnit(u)}>
                <Text style={[styles.unitText, unit === u && styles.unitTextOn]}>{u}</Text>
              </PressScale>
            ))}
          </View>
        </View>
        <Text style={styles.hint}>A guess is fine.</Text>
        {!only ? (
          <PressScale accessibilityRole="button" accessibilityLabel="Skip this question" scaleTo={0.96} style={styles.skip} onPress={() => go(step + 1)}>
            <Text style={styles.skipText}>Skip for now</Text>
          </PressScale>
        ) : null}
      </>,
    );
  }

  // ---------- Everything else ----------
  const typical = question.id === "energy" ? typicalEnergy(profile.breed) : null;
  const choose = (label: string) => {
    if (!question.multi) {
      setPicked([label]);
      store(question, [label]);
      void Haptics.selectionAsync();
      later(() => go(step + 1));
      return;
    }
    void Haptics.selectionAsync();
    setPicked((now) => {
      if (label === question.none) return now.includes(label) ? [] : [label];
      const rest = now.filter((p) => p !== question.none);
      return rest.includes(label) ? rest.filter((p) => p !== label) : [...rest, label];
    });
  };

  return shell(
    question.multi
      ? {
          label: only ? "Save" : "Next",
          done: only,
          disabled: !picked.length,
          onPress: () => {
            store(question, picked);
            go(step + 1);
          },
        }
      : null,
    <>
      {tiles(question.options, choose, (label) => picked.includes(label), Boolean(question.multi), (label) =>
        // Breed is a hint, not a verdict: what the guardian sees in their own dog comes first.
        typical === label && profile.breed ? `Common in ${profile.breed}s` : null,
      )}
      {!question.multi && !only ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Skip this question" scaleTo={0.96} style={styles.skip} onPress={() => go(step + 1)}>
          <Text style={styles.skipText}>Skip for now</Text>
        </PressScale>
      ) : null}
    </>,
  );
}

const Why = ({ area, text: line }: { area: Area; text: string }) => {
  const Glyph = area === "care" ? HeartIcon : GraduationCapIcon;
  return (
    <View style={styles.why}>
      <Glyph size={14} color={text.primary} weight="fill" />
      <Text style={styles.whyText}>{line}</Text>
    </View>
  );
};

const OptionTile = ({
  order,
  label,
  sub,
  hint,
  on,
  multi,
  reduceMotion,
  onPress,
}: {
  order: number;
  label: string;
  sub?: string;
  hint: string | null;
  on: boolean;
  multi: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) => {
  const pop = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    pop.value = reduceMotion ? (on ? 1 : 0) : withSpring(on ? 1 : 0, { duration: 320, dampingRatio: 0.7 });
  }, [on, pop, reduceMotion]);
  const tick = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.6 + pop.value * 0.4 }] }));

  return (
    <Animated.View entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: 40 + Math.min(order, 8) * 35, duration: motion.duration.enter })}>
      <PressScale
        accessibilityRole={multi ? "checkbox" : "radio"}
        accessibilityState={multi ? { checked: on } : { selected: on }}
        accessibilityLabel={[label, sub, hint].filter(Boolean).join(". ")}
        scaleTo={0.98}
        style={[styles.tile, on && styles.tileOn]}
        onPress={onPress}
      >
        <View style={styles.flex}>
          <Text style={styles.tileLabel}>{label}</Text>
          {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
          {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
        </View>
        <View style={[multi ? styles.box : styles.radio, on && styles.markOn]}>
          <Animated.View style={tick}>
            <CheckIcon size={13} color={text.primary} weight="bold" />
          </Animated.View>
        </View>
      </PressScale>
    </Animated.View>
  );
};

/** The end of a set: what it changed, and the next set to answer. */
const Finished = ({ setKey }: { setKey: SetKey }) => {
  const reduceMotion = useReducedMotion();
  const profile = useProfileSets();
  const state = profile.get(setKey);
  const next = profile.sets.find((s) => s.key !== setKey && s.answered < s.total) ?? null;
  const lines =
    setKey === "personality"
      ? tailoring(state.answers, profile.name)
      : setKey === "baseline"
        ? profile.plan.map((m, i) => `${i + 1}. ${m}`)
        : setKey === "basics" && profile.stage && profile.focus
          ? [`${profile.stage}: ${profile.focus.care.toLowerCase()}`, `Training: ${profile.focus.train.toLowerCase()}`]
          : [];

  return (
    <SetupShell
      step={0}
      total={1}
      direction={1}
      closing
      onBack={() => goBack(`/profile/${setKey}`)}
      primary={
        next
          ? { label: `Next: ${next.title}`, onPress: () => router.replace(`/profile/get-to-know?set=${next.key}` as never) }
          : { label: "Done", done: true, onPress: () => router.replace("/(tabs)/profile" as never) }
      }
    >
      <Animated.View entering={reduceMotion ? undefined : enter({ scale: 0.7, rotate: -12 }, { duration: 420 })} style={styles.medal}>
        <SealCheckIcon size={44} color={text.primary} weight="fill" />
      </Animated.View>
      <Text style={setupText.title}>{setKey === "baseline" && lines.length ? `${profile.name}'s training plan` : `${state.title}, done`}</Text>
      <Text style={setupText.note}>{lines.length ? (setKey === "baseline" ? "Built from what you told PAWS. It updates as you go." : "Here is what changes:") : `${profile.answered} of ${profile.total} answered across ${profile.name}'s profile.`}</Text>
      <View style={styles.lines}>
        {lines.map((line, i) => (
          <Animated.View key={line} entering={reduceMotion ? undefined : enter({ y: 8 }, { delay: 200 + i * 70, duration: motion.duration.enter })} style={styles.line}>
            <View style={styles.lineCheck}>
              <CheckIcon size={12} color={text.primary} weight="bold" />
            </View>
            <Text style={styles.lineText}>{line}</Text>
          </Animated.View>
        ))}
      </View>
      {next ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Finish for now" scaleTo={0.96} style={styles.skip} onPress={() => router.replace("/(tabs)/profile" as never)}>
          <Text style={styles.skipText}>Finish for now</Text>
        </PressScale>
      ) : null}
    </SetupShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  why: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: space.lg, minHeight: 32, paddingVertical: 6, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.soft },
  whyText: { ...type.caption, fontSize: 13, fontWeight: "600", color: text.primary, flexShrink: 1 },
  options: { gap: space.sm, marginTop: space.xl },
  tile: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card, borderWidth: 1.5, borderColor: border.soft, backgroundColor: bg.canvas },
  tileOn: { borderColor: accent.deep, backgroundColor: accent.soft },
  tileLabel: { fontSize: 17, lineHeight: 22, fontWeight: "600", color: text.primary },
  tileSub: { ...type.caption, fontSize: 13, color: text.secondary, marginTop: 2 },
  tileHint: { ...type.caption, color: text.tertiary, marginTop: 3 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  markOn: { borderColor: accent.deep, backgroundColor: accent.deep },
  input: { height: 52, marginTop: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderWidth: 1.5, borderColor: accent.deep, ...type.body, color: text.primary },
  weightRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  weightInput: { flex: 1, height: 80, fontSize: 40, lineHeight: 48, paddingVertical: 0, fontWeight: "600", color: text.primary, borderBottomWidth: 2, borderBottomColor: accent.deep, fontVariant: ["tabular-nums"] },
  units: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: bg.subtle },
  unit: { height: 40, minWidth: 52, paddingHorizontal: space.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  unitOn: { backgroundColor: bg.canvas },
  unitText: { ...type.cardTitle, color: text.secondary },
  unitTextOn: { color: text.primary, fontWeight: "700" },
  hint: { ...type.supporting, color: text.tertiary, marginTop: space.md },
  skip: { alignSelf: "center", marginTop: space.xl, paddingVertical: space.sm, paddingHorizontal: space.lg },
  skipText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  medal: { width: 96, height: 96, borderRadius: 48, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center", marginTop: space.xl, marginBottom: space.xl },
  lines: { gap: space.md, marginTop: space.xl },
  line: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  lineCheck: { width: 22, height: 22, borderRadius: 11, marginTop: 1, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  lineText: { ...type.body, color: text.primary, flex: 1 },
});
