import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { OnboardingScreen } from "@/features/onboarding/components/OnboardingScreen";
import { QuestionHeadline, type QuestionPart } from "@/features/onboarding/components/QuestionHeadline";
import { HeartDoodle } from "@/features/onboarding/components/HeartDoodle";
import { FieldLabel } from "@/features/onboarding/components/FieldLabel";
import { Reveal } from "@/features/onboarding/components/Reveal";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { enter } from "@/features/care/food/enter";
import { saveFeedingProfile, useFoodPlan } from "@/features/care/state/foodPlan";
import { AGE_CHOICES, BREED_CHOICES } from "@/features/profile/intel/getToKnow";
import { SETS, type SetKey, type SetQuestion } from "@/features/profile/intel/profileSets";
import { saveSetAnswer, useProfileSets } from "@/features/profile/intel/useProfileSets";
import { setField } from "@/features/profile/state/profileDraft";
import { queryKeys } from "@/constants/queryKeys";
import { useSaveWeightLog } from "@/hooks/useWeightLogs";
import { updateDogBasics } from "@/services/profileService";
import { bg, border, motion, radius, space, text, type } from "@/constants/design";

/** Follow-ups (how often, which goal first) are refined later on Profile; setup asks the questions that matter first. */
const isFollowUp = (q: SetQuestion) => q.id.startsWith("sev_") || q.id === "goal";

/** Finishing the profile setup, so it does not open again. */
export const finishProfileSetup = () => setField("setup", "done", "yes");

/**
 * Profile setup, in the same frame as Care setup: a start screen, then one screen per set (basics, health and safety,
 * home, training, personality) with every unanswered question of that set together as chips. Anything already
 * known is not asked; a set that is complete is skipped. Each tap saves at once, so leaving halfway loses nothing.
 */
export const ProfileSetupFlow = ({ onClose, bottomInset = 0 }: { onClose: () => void; bottomInset?: number }) => {
  const reduceMotion = useReducedMotion();
  const profile = useProfileSets();
  const food = useFoodPlan();
  const queryClient = useQueryClient();
  const saveWeight = useSaveWeightLog(profile.dogId ?? "");

  // Which questions to ask is fixed when setup starts, so answering one does not make it vanish.
  const plan = useRef<{ key: SetKey; ids: string[] }[] | null>(null);
  if (!plan.current) {
    plan.current = SETS.map((set) => ({
      key: set.key,
      ids: profile
        .get(set.key)
        .questions.filter((q) => !isFollowUp(q) && !profile.get(set.key).answers[q.id])
        .map((q) => q.id),
    })).filter((s) => s.ids.length > 0);
  }
  const screens = plan.current;
  // Five sets, asked as at most three pages like first-run onboarding.
  const pages = [
    { keys: ["basics", "safety"] as SetKey[], headline: (n: string): QuestionPart[] => [{ kind: "text", value: "Let's get to know" }, { kind: "accent", value: n, suffix: "." }] },
    { keys: ["home", "baseline"] as SetKey[], headline: (n: string): QuestionPart[] => [{ kind: "accent", value: n }, { kind: "text", value: "at home." }] },
    { keys: ["personality"] as SetKey[], headline: (n: string): QuestionPart[] => [{ kind: "text", value: "What" }, { kind: "accent", value: n }, { kind: "text", value: "is like." }] },
  ]
    .map((p) => ({ ...p, ids: screens.filter((sc) => p.keys.includes(sc.key)).flatMap((sc) => sc.ids) }))
    .filter((p) => p.ids.length > 0);
  const setOf = (q: SetQuestion): SetKey => SETS.find((set) => profile.get(set.key).questions.some((x) => x.id === q.id))?.key ?? "basics";
  const questionById = (id: string) => SETS.flatMap((set) => profile.get(set.key).questions).find((q) => q.id === id);

  const [step, setStep] = useState(0);
  const [otherBreed, setOtherBreed] = useState("");
  const [breedOther, setBreedOther] = useState(false);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">(profile.unit);
  // What was tapped on this visit, so every chip lights up at once (age and sex are stored on the dog in another form).
  const [picked, setPicked] = useState<Record<string, string[]>>({});

  const go = (to: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(to);
  };

  const writeDog = (values: Parameters<typeof updateDogBasics>[1]) => {
    if (profile.dogId) void updateDogBasics(profile.dogId, values).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.currentDog })).catch(() => undefined);
  };

  const flushTyped = () => {
    if (breedOther && otherBreed.trim().length >= 2) writeDog({ breed: otherBreed.trim() });
    const value = Number(weight.replace(",", "."));
    if (profile.dogId && Number.isFinite(value) && value > 0.3 && value < (unit === "kg" ? 120 : 260)) {
      saveWeight.mutate({ dogId: profile.dogId, weightValue: Math.round(value * 10) / 10, weightUnit: unit, recordedAt: new Date().toISOString(), note: null });
      setWeight("");
    }
  };

  const last = step >= pages.length;
  const name = profile.name;

  if (last) {
    return (
      <OnboardingScreen
        bottomInset={bottomInset}
        stage={pages.length || 1}
        total={pages.length || 1}
        onBack={() => (pages.length ? go(pages.length - 1) : onClose())}
        ctaLabel="See the profile"
        onContinue={() => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          finishProfileSetup();
          onClose();
        }}
      >
        <View style={styles.opening}>
          <QuestionHeadline parts={[{ kind: "text", value: "This is" }, { kind: "accent", value: name, suffix: "." }]} trailing={<HeartDoodle />} />
          <Animated.Text entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.understanding}>
            {profile.understanding}
          </Animated.Text>
          <Text style={styles.supporting}>Change anything later on Profile.</Text>
        </View>
      </OnboardingScreen>
    );
  }

  const page = pages[step];
  const questions = page.ids.map((id) => questionById(id)).filter((q): q is SetQuestion => Boolean(q));

  const answerOf = (q: SetQuestion) => profile.get(setOf(q)).answers[q.id] ?? "";
  const pick = (q: SetQuestion, label: string) => {
    void Haptics.selectionAsync();
    const was = picked[q.id] ?? (answerOf(q) ? answerOf(q).split(", ") : []);
    const now = !q.multi || q.special ? [label] : label === q.none ? (was.includes(label) ? [] : [label]) : (was.includes(label) ? was.filter((x) => x !== label) : [...was, label]).filter((x) => x !== q.none);
    setPicked((p) => ({ ...p, [q.id]: now }));
    if (q.special === "sex") return writeDog({ gender: label === "Boy" ? "male" : "female" });
    if (q.special === "age") {
      const years = AGE_CHOICES.find((c) => c.label === label)?.years;
      if (years != null) {
        writeDog({ age_years: years });
        saveSetAnswer("basics", "ageUnsure", "");
      }
      return;
    }
    if (q.special === "breed") {
      if (label === "Something else") return setBreedOther(true);
      setBreedOther(false);
      return writeDog({ breed: label });
    }
    const current = answerOf(q) ? answerOf(q).split(", ") : [];
    let next: string[];
    if (!q.multi) next = [label];
    else if (label === q.none) next = current.includes(label) ? [] : [label];
    else next = (current.includes(label) ? current.filter((x) => x !== label) : [...current, label]).filter((x) => x !== q.none);
    saveSetAnswer(setOf(q), q.id, next.join(", "), profile.dogId);
    if (q.id === "fixed" && label !== "Not sure") saveFeedingProfile({ ...food.profile, neutered: label === "Yes" });
  };

  const optionsOf = (q: SetQuestion): readonly { label: string }[] =>
    q.special === "breed" ? BREED_CHOICES.map((label) => ({ label })) : q.special === "age" ? AGE_CHOICES.map((c) => ({ label: c.label })) : q.options;
  const isOn = (q: SetQuestion, label: string) => {
    if (q.special === "breed" && label === "Something else") return breedOther;
    return (picked[q.id] ?? (answerOf(q) ? answerOf(q).split(", ") : [])).includes(label);
  };

  return (
    <OnboardingScreen
        bottomInset={bottomInset}
      stage={step + 1}
      total={pages.length}
      onBack={() => (step === 0 ? onClose() : go(step - 1))}
      fraction={1}
      ctaLabel="Continue"
      ctaFootnote={step === 0 ? "Everything saves as you tap." : undefined}
      onContinue={() => {
        flushTyped();
        go(step + 1);
      }}
    >
      <View style={styles.opening}>
        <QuestionHeadline parts={page.headline(name)} trailing={step === 0 ? <HeartDoodle /> : undefined} />
        <Text style={styles.supporting}>All optional. Skip what you are unsure of.</Text>
      </View>

      {questions.map((q, i) => (
        <Reveal key={q.id} index={i + 1} style={styles.question}>
          <FieldLabel>{q.short}</FieldLabel>
          {q.special === "weight" ? (
            <View style={styles.weightRow}>
              <TextInput
                style={styles.weightInput}
                value={weight}
                onChangeText={setWeight}
                onBlur={flushTyped}
                keyboardType="decimal-pad"
                placeholder="A guess is fine"
                placeholderTextColor={text.tertiary}
                accessibilityLabel={`Weight in ${unit}`}
                maxLength={5}
              />
              {(["lb", "kg"] as const).map((u) => (
                <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />
              ))}
            </View>
          ) : (
            <View style={styles.chips}>
              {optionsOf(q).map((o) => (
                <Chip key={o.label} label={o.label} selected={isOn(q, o.label)} onPress={() => pick(q, o.label)} />
              ))}
            </View>
          )}
          {q.special === "breed" && breedOther ? (
            <TextInput
              style={styles.input}
              value={otherBreed}
              onChangeText={setOtherBreed}
              onBlur={flushTyped}
              placeholder="Type the breed"
              placeholderTextColor={text.tertiary}
              autoFocus
              autoCorrect={false}
              accessibilityLabel="Breed"
            />
          ) : null}
        </Reveal>
      ))}
    </OnboardingScreen>
  );
};

const styles = StyleSheet.create({
  opening: { marginTop: space.section },
  supporting: { ...type.body, color: text.secondary, marginTop: space.lg, maxWidth: 300 },
  question: { marginTop: space.xxl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  input: { height: 52, marginTop: space.md, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, ...type.body, color: text.primary },
  weightRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  weightInput: { flex: 1, height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, ...type.body, color: text.primary, fontVariant: ["tabular-nums"] },
  understanding: { ...type.body, fontSize: 19, lineHeight: 28, color: text.primary, marginTop: space.xl },
});
