import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import Animated, { FadeIn, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CheckIcon, PlusIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import {
  type Appetite,
  type DailyCheckIn,
  type DrinkingState,
  type EnergyLevel,
  type StoolState,
  type UnusualSign,
  type UrinationState,
  setCheckInTime,
  skipDailyCheckInToday,
  submitDailyCheckIn,
  useCheckInSettings,
} from "@/features/care/state/dailyCheckIn";
import { prettyTime } from "@/features/care/components/careSetupAnswers";
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

export const APPETITE: readonly { key: Appetite; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "less", label: "Less than usual" },
  { key: "more", label: "More than usual" },
  { key: "skipped", label: "Didn't eat" },
];

export const ENERGY: readonly { key: EnergyLevel; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "extra", label: "Extra energetic" },
  { key: "low", label: "Low energy" },
  { key: "restless", label: "Restless" },
];

export const STOOL: readonly { key: StoolState; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "soft", label: "Soft" },
  { key: "diarrhea", label: "Diarrhea" },
  { key: "hard", label: "Hard / constipated" },
];

export const URINATION: readonly { key: UrinationState; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "more", label: "More" },
  { key: "less", label: "Less" },
  { key: "difficulty", label: "Difficulty" },
];

export const DRINKING: readonly { key: DrinkingState; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "less", label: "Less than usual" },
  { key: "more", label: "More than usual" },
  { key: "unsure", label: "Not sure" },
];

export const UNUSUAL: readonly { key: UnusualSign; label: string }[] = [
  { key: "vomiting", label: "Vomiting" },
  { key: "coughing", label: "Coughing" },
  { key: "itching", label: "Itching" },
  { key: "limping", label: "Limping" },
  { key: "eye-ear", label: "Eye / ear issue" },
  { key: "skin", label: "Skin issue" },
  { key: "other", label: "Other" },
];

type Draft = Omit<DailyCheckIn, "date">;

const EMPTY: Draft = {
  appetite: null,
  energy: null,
  stool: null,
  urination: null,
  drinking: null,
  unusual: [],
  unusualNote: "",
};

const EVENING = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];

export const DailyHealthCheckSheet = ({
  open,
  onClose,
  initialAppetite = null,
}: {
  open: boolean;
  onClose: () => void;
  initialAppetite?: Appetite | null;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogName = dog.data?.name ?? "your dog";
  const { enabled, time } = useCheckInSettings();

  const form = useCheckInDraft();
  const [pickTime, setPickTime] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPickTime(false);
    if (initialAppetite) form.patch({ appetite: initialAppetite });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAppetite]);

  const submit = () => {
    if (form.save()) onClose();
  };

  const later = () => {
    void Haptics.selectionAsync();
    skipDailyCheckInToday();
    onClose();
  };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={later}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
        style={styles.scrim}
      >
        <Pressable style={styles.scrimHit} onPress={later} accessibilityLabel="Do this later" />

        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)
          }
          style={[styles.sheet, { paddingBottom: insets.bottom + space.xxl }]}
        >
          <View style={styles.grabber} />

          <View style={styles.head}>
            <View style={styles.headCopy}>
              <Text style={styles.title}>How is {dogName} today?</Text>
            </View>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Do this later"
              style={styles.close}
              onPress={later}
            >
              <XIcon size={iconSize.standard} color={text.primary} weight="bold" />
            </PressScale>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <CheckInQuestions dogName={dogName} form={form} />

            {enabled ? (
              <View style={styles.timeBlock}>
                <View style={styles.timeRow}>
                  <Text style={styles.timeNote}>{`PAWS asks every evening at ${prettyTime(time)}.`}</Text>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Change the check-in time"
                    scaleTo={0.95}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setPickTime((value) => !value);
                    }}
                  >
                    <Text style={styles.timeLink}>{pickTime ? "Done" : "Change"}</Text>
                  </PressScale>
                </View>
                {pickTime ? (
                  <View style={styles.tags}>
                    {EVENING.map((slot) => {
                      const on = slot === time;
                      return (
                        <PressScale
                          key={slot}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          accessibilityLabel={prettyTime(slot)}
                          scaleTo={0.95}
                          style={[styles.tag, on && styles.timeOn]}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            setCheckInTime(slot);
                          }}
                        >
                          <Text style={[styles.tagText, on && styles.timeOnText]}>{prettyTime(slot)}</Text>
                        </PressScale>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Do this later"
              scaleTo={0.97}
              style={styles.laterButton}
              onPress={later}
            >
              <Text style={styles.laterText}>Later</Text>
            </PressScale>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Save today's check-in"
              scaleTo={0.97}
              disabled={!form.canSubmit}
              style={[styles.save, !form.canSubmit && styles.saveOff]}
              onPress={submit}
            >
              <Text style={[styles.saveText, !form.canSubmit && styles.saveTextOff]}>Save check-in</Text>
            </PressScale>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};


export type CheckInForm = ReturnType<typeof useCheckInDraft>;

export const useCheckInDraft = () => {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }));
  const canSubmit = Boolean(draft.appetite && draft.energy && draft.stool && draft.urination && draft.drinking);
  return {
    draft,
    patch,
    canSubmit,
    nothingUnusual: draft.unusual.length === 0,
    otherOn: draft.unusual.includes("other"),
    toggleUnusual: (key: UnusualSign) => {
      void Haptics.selectionAsync();
      setDraft((prev) => ({
        ...prev,
        unusual: prev.unusual.includes(key) ? prev.unusual.filter((item) => item !== key) : [...prev.unusual, key],
      }));
    },
    clearUnusual: () => {
      void Haptics.selectionAsync();
      patch({ unusual: [], unusualNote: "" });
    },
    save: () => {
      if (!canSubmit) return false;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      submitDailyCheckIn(draft);
      setDraft(EMPTY);
      return true;
    },
  };
};

export const CheckInQuestions = ({ dogName, form }: { dogName: string; form: CheckInForm }) => (
  <>
    <Question label={`How did ${dogName} eat today?`}>
      <Options options={APPETITE} value={form.draft.appetite} onChange={(key) => form.patch({ appetite: key })} />
    </Question>

    <Question label="Energy" hint={`How is ${dogName} acting?`}>
      <Options options={ENERGY} value={form.draft.energy} onChange={(key) => form.patch({ energy: key })} />
    </Question>

    <Question label="Bathroom" hint="Stool">
      <Options options={STOOL} value={form.draft.stool} onChange={(key) => form.patch({ stool: key })} />
    </Question>

    <Question label="Urination">
      <Options
        options={URINATION}
        value={form.draft.urination}
        onChange={(key) => form.patch({ urination: key })}
      />
    </Question>

    <Question label="Drinking">
      <Options options={DRINKING} value={form.draft.drinking} onChange={(key) => form.patch({ drinking: key })} />
    </Question>

    <Question label="Anything unusual today?">
      <View style={styles.tags}>
        {UNUSUAL.map((item) => {
          const on = form.draft.unusual.includes(item.key);
          return (
            <PressScale
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={item.label}
              scaleTo={0.95}
              style={[styles.tag, on && styles.tagOn]}
              onPress={() => form.toggleUnusual(item.key)}
            >
              {!on ? <PlusIcon size={13} color={text.secondary} weight="bold" /> : null}
              <Text style={[styles.tagText, on && styles.tagTextOn]}>{item.label}</Text>
            </PressScale>
          );
        })}
      </View>

      {form.otherOn ? (
        <TextInput
          style={styles.otherInput}
          value={form.draft.unusualNote}
          onChangeText={(next) => form.patch({ unusualNote: next })}
          placeholder="Describe what you noticed"
          placeholderTextColor={text.tertiary}
          multiline
        />
      ) : null}

      <PressScale
        accessibilityRole="button"
        accessibilityState={{ selected: form.nothingUnusual }}
        accessibilityLabel="Nothing unusual"
        scaleTo={0.98}
        style={[styles.nothing, form.nothingUnusual && styles.nothingOn]}
        onPress={form.clearUnusual}
      >
        <View style={[styles.nothingCheck, form.nothingUnusual && styles.nothingCheckOn]}>
          {form.nothingUnusual ? <CheckIcon size={12} color={text.inverse} weight="bold" /> : null}
        </View>
        <Text style={[styles.nothingText, form.nothingUnusual && styles.nothingTextOn]}>
          Nothing unusual
        </Text>
      </PressScale>
    </Question>
  </>
);

const Question = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <View style={styles.question}>
    <Text style={styles.questionLabel}>{label}</Text>
    {hint ? <Text style={styles.questionHint}>{hint}</Text> : null}
    {children}
  </View>
);

const Options = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T | null;
  onChange: (key: T) => void;
}) => (
  <View style={styles.options}>
    {options.map((option) => {
      const on = option.key === value;
      return (
        <PressScale
          key={option.key}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          accessibilityLabel={option.label}
          scaleTo={0.96}
          style={[styles.option, on && styles.optionOn]}
          onPress={() => {
            void Haptics.selectionAsync();
            onChange(option.key);
          }}
        >
          <View style={[styles.dot, on && styles.dotOn]}>
            {on ? <View style={styles.dotCore} /> : null}
          </View>
          <Text style={[styles.optionText, on && styles.optionTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {option.label}
          </Text>
        </PressScale>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)", justifyContent: "flex-end" },
  scrimHit: { flex: 1 },
  sheet: {
    maxHeight: "90%",
    backgroundColor: bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
  },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: border.default, alignSelf: "center" },

  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.xl,
  },
  headCopy: { flex: 1 },
  title: { ...type.pageTitle, color: text.primary },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },

  body: { marginTop: space.sm },
  bodyContent: { paddingBottom: space.lg },

  question: { marginTop: space.section },
  questionLabel: { ...type.sectionTitle, fontSize: 17, color: text.primary },
  questionHint: { ...type.supporting, color: text.secondary, marginTop: 2 },

  options: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  option: {
    flexBasis: "47.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1.5,
    borderColor: border.soft,
    backgroundColor: bg.subtle,
  },
  optionOn: { borderColor: text.primary, backgroundColor: accent.primary },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  dotOn: { borderColor: text.primary },
  dotCore: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: text.primary },
  optionText: { ...type.supporting, color: text.secondary, flexShrink: 1 },
  optionTextOn: { color: text.primary, fontWeight: "600" },

  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.soft,
    backgroundColor: bg.subtle,
  },
  tagOn: { borderColor: text.primary, backgroundColor: text.primary },
  tagText: { ...type.supporting, color: text.secondary },
  tagTextOn: { color: text.inverse, fontWeight: "600" },

  otherInput: {
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.subtle,
    minHeight: 64,
    textAlignVertical: "top",
    ...type.body,
    color: text.primary,
  },

  nothing: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    alignSelf: "flex-start",
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  nothingOn: { borderColor: accent.band, backgroundColor: accent.soft },
  nothingCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  nothingCheckOn: { borderColor: accent.band, backgroundColor: accent.band },
  nothingText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  nothingTextOn: { color: text.primary },

  timeBlock: { marginTop: space.section, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: border.soft },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  timeNote: { ...type.supporting, color: text.secondary, flex: 1 },
  timeLink: { ...type.supporting, fontWeight: "700", color: text.primary, textDecorationLine: "underline" },
  timeOn: { borderColor: accent.deep, backgroundColor: accent.primary },
  timeOnText: { color: text.primary, fontWeight: "600" },

  actions: { flexDirection: "row", gap: space.md, marginTop: space.xl },
  laterButton: {
    height: layout.controlHeight,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  laterText: { ...type.cardTitle, fontWeight: "600", color: text.secondary },
  save: {
    flex: 1,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  saveOff: { backgroundColor: bg.subtle },
  saveText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  saveTextOff: { color: text.disabled },
});
