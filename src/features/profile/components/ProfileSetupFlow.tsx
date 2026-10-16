import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { SparkleIcon } from "phosphor-react-native";

import { CareSetupStart } from "@/features/care/components/CareSetupStart";
import { SetupShell, setupText } from "@/features/care/components/SetupShell";
import { enter } from "@/features/care/food/enter";
import { saveFeedingProfile, useFoodPlan } from "@/features/care/state/foodPlan";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { AGE_CHOICES, BREED_CHOICES } from "@/features/profile/intel/getToKnow";
import { SETS, type SetKey, type SetQuestion } from "@/features/profile/intel/profileSets";
import { saveSetAnswer, useProfileSets } from "@/features/profile/intel/useProfileSets";
import { setField } from "@/features/profile/state/profileDraft";
import { PressScale } from "@/components/ui/PressScale";
import { queryKeys } from "@/constants/queryKeys";
import { useSaveWeightLog } from "@/hooks/useWeightLogs";
import { updateDogBasics } from "@/services/profileService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const TITLE: Record<SetKey, string> = {
  basics: "The basics",
  safety: "Health & safety",
  home: "Home & routine",
  baseline: "Training so far",
  personality: "Personality",
};

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

  const [step, setStep] = useState(-1);
  const [direction, setDirection] = useState(1);
  const [otherBreed, setOtherBreed] = useState("");
  const [breedOther, setBreedOther] = useState(false);
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">(profile.unit);

  const go = (to: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection(to > step ? 1 : -1);
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

  if (step === -1) {
    return (
      <CareSetupStart
        title={`Get to know\n${profile.name}`}
        subtitle={`${screens.length} short ${screens.length === 1 ? "page" : "pages"} on health, home and habits. Care and training fit ${profile.name} from here.`}
        startLabel="Start"
        automaticLabel="Not now"
        onStart={() => go(0)}
        onClose={onClose}
        bottomInset={bottomInset}
      />
    );
  }

  const last = step >= screens.length;
  if (last) {
    return (
      <SetupShell
        step={screens.length}
        total={screens.length + 1}
        direction={direction}
        bottomInset={bottomInset}
        onBack={() => go(step - 1)}
        primary={{
          label: "See the profile",
          done: true,
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            finishProfileSetup();
            onClose();
          },
        }}
      >
        <View style={styles.doneMark}>
          <SparkleIcon size={22} color={text.primary} weight="fill" />
        </View>
        <Text style={setupText.title}>{`This is ${profile.name}`}</Text>
        <Animated.Text entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.understanding}>
          {profile.understanding}
        </Animated.Text>
        <Text style={setupText.note}>Change anything later on Profile.</Text>
      </SetupShell>
    );
  }

  const screen = screens[step];
  const set = profile.get(screen.key);
  const questions = set.questions.filter((q) => screen.ids.includes(q.id));

  const answerOf = (q: SetQuestion) => set.answers[q.id] ?? "";
  const pick = (q: SetQuestion, label: string) => {
    void Haptics.selectionAsync();
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
    saveSetAnswer(screen.key, q.id, next.join(", "));
    if (q.id === "fixed" && label !== "Not sure") saveFeedingProfile({ ...food.profile, neutered: label === "Yes" });
  };

  const optionsOf = (q: SetQuestion): readonly { label: string }[] =>
    q.special === "breed" ? BREED_CHOICES.map((label) => ({ label })) : q.special === "age" ? AGE_CHOICES.map((c) => ({ label: c.label })) : q.options;
  const isOn = (q: SetQuestion, label: string) =>
    q.special === "breed" ? (label === "Something else" ? breedOther : answerOf(q) === label) : answerOf(q).split(", ").includes(label);

  return (
    <SetupShell
      step={step}
      total={screens.length + 1}
      direction={direction}
      bottomInset={bottomInset}
      closing={step === 0}
      onBack={() => (step === 0 ? onClose() : go(step - 1))}
      primary={{
        label: step === screens.length - 1 ? "Finish" : "Next",
        onPress: () => {
          flushTyped();
          go(step + 1);
        },
      }}
    >
      <Text style={setupText.title}>{TITLE[screen.key]}</Text>
      <Text style={setupText.note}>All optional. Tap what fits.</Text>

      {questions.map((q, i) => (
        <Animated.View key={q.id} entering={reduceMotion ? undefined : enter({ y: 8 }, { delay: i * 40, duration: motion.duration.enter })} style={styles.question}>
          <Text style={styles.prompt}>{q.prompt(profile.name)}</Text>
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
                <PressScale key={u} accessibilityRole="radio" accessibilityState={{ selected: unit === u }} accessibilityLabel={u} scaleTo={0.95} style={[styles.unit, unit === u && styles.unitOn]} onPress={() => setUnit(u)}>
                  <Text style={[styles.unitText, unit === u && styles.unitTextOn]}>{u}</Text>
                </PressScale>
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
        </Animated.View>
      ))}
    </SetupShell>
  );
};

const styles = StyleSheet.create({
  question: { marginTop: space.xxl },
  prompt: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginBottom: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  input: { height: 52, marginTop: space.md, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, ...type.body, color: text.primary },
  weightRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  weightInput: { flex: 1, height: 52, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, ...type.body, color: text.primary, fontVariant: ["tabular-nums"] },
  unit: { height: 52, minWidth: 52, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  unitOn: { backgroundColor: accent.primary, borderColor: accent.primary },
  unitText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  unitTextOn: { color: text.primary },
  doneMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center", marginBottom: space.lg },
  understanding: { ...type.body, fontSize: 18, lineHeight: 27, color: text.primary, marginTop: space.lg },
});
