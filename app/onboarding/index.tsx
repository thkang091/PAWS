import { useEffect, useMemo, useRef } from "react";
import { Keyboard, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { AgeCard } from "@/features/onboarding/components/AgeCard";
import { HeartDoodle } from "@/features/onboarding/components/HeartDoodle";
import { NameInline } from "@/features/onboarding/components/NameInline";
import { OnboardingScreen } from "@/features/onboarding/components/OnboardingScreen";
import { ChoiceRow } from "@/features/onboarding/components/ChoiceRow";
import { QuestionBlock } from "@/features/onboarding/components/QuestionBlock";
import {
  QuestionHeadline,
  type QuestionPart,
} from "@/features/onboarding/components/QuestionHeadline";
import { Reveal } from "@/features/onboarding/components/Reveal";
import { layout, space, text, type } from "@/constants/design";
import {
  ageBucketOptions,
  formatTogetherLabel,
  togetherOptions,
} from "@/constants/onboardingOptions";
import { useOnboardingDraft } from "@/providers/OnboardingDraftProvider";

const SCROLL_HEADROOM = 96;

export default function OnboardingIdentityScreen() {
  const { draft, update } = useOnboardingDraft();
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const carried = useRef<Record<string, boolean>>({});

  const trimmedName = draft.name.trim();
  const displayName = trimmedName || "your dog";

  const askAge = trimmedName.length > 0;
  const askTogether = askAge && draft.ageBucket !== null;
  const complete = askTogether && draft.together !== null;

  const fraction = Math.max(
    0.12,
    ((trimmedName ? 1 : 0) + (draft.ageBucket ? 1 : 0) + (draft.together ? 1 : 0)) / 3,
  );

  const carryTo = (key: string) => {
    if (carried.current[key]) return;
    carried.current[key] = true;
    setTimeout(() => {
      const y = positions.current[key];
      if (y === undefined) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - SCROLL_HEADROOM), animated: true });
    }, 90);
  };

  useEffect(() => {
    if (askAge) carryTo("age");
  }, [askAge]);

  useEffect(() => {
    if (askTogether) carryTo("together");
  }, [askTogether]);

  const nameParts: QuestionPart[] = useMemo(
    () => [
      { kind: "text", value: "Let's get to" },
      { kind: "text", value: "know" },
      {
        kind: "slot",
        suffix: ".",
        render: () => (
          <NameInline
            value={draft.name}
            onChangeText={(name) => update({ name })}
            onSubmit={() => Keyboard.dismiss()}
            autoFocus
          />
        ),
      },
    ],
    [draft.name],
  );

  return (
    <OnboardingScreen
      stage={1}
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/welcome"))}
      fraction={fraction}
      scrollRef={scrollRef}
      ctaLabel="Continue"
      ctaDisabled={!complete}
      onContinue={() => {
        Keyboard.dismiss();
        router.push("/onboarding/goals");
      }}
    >
      <View style={styles.opening}>
        <QuestionHeadline parts={nameParts} trailing={<HeartDoodle />} />
        <Text style={styles.supporting}>Three quick things, then we'll build the plan.</Text>
      </View>

      {askAge ? (
        <QuestionBlock
          style={styles.block}
          onMeasure={(y) => (positions.current.age = y)}
        >
          <QuestionHeadline
            scale="title"
            parts={[
              { kind: "text", value: "How old is" },
              { kind: "accent", value: displayName, suffix: "?" },
            ]}
          />
          <Text style={styles.supporting}>A rough answer is fine.</Text>

          <View style={styles.ageRow}>
            {ageBucketOptions.map((option, index) => (
              <Reveal key={option.value} index={index} offset={120} style={styles.ageSlot}>
                <AgeCard
                  option={option}
                  selected={draft.ageBucket === option.value}
                  onSelect={() => {
                    Keyboard.dismiss();
                    update({ ageBucket: option.value });
                  }}
                />
              </Reveal>
            ))}
          </View>
        </QuestionBlock>
      ) : null}

      {askTogether ? (
        <QuestionBlock
          style={styles.block}
          onMeasure={(y) => (positions.current.together = y)}
        >
          <QuestionHeadline
            scale="title"
            parts={[
              { kind: "text", value: "How long have" },
              { kind: "text", value: "you two been" },
              { kind: "accent", value: "together", suffix: "?" },
            ]}
          />

          <View style={styles.choiceStack}>
            {togetherOptions.map((option, index) => (
              <Reveal key={option.value} index={index} offset={120}>
                <ChoiceRow
                  icon={option.icon}
                  label={formatTogetherLabel(option, trimmedName)}
                  selected={draft.together === option.value}
                  onSelect={() => update({ together: option.value })}
                />
              </Reveal>
            ))}
          </View>
        </QuestionBlock>
      ) : null}

    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  opening: {
    marginTop: space.section,
  },
  block: {
    marginTop: space.block,
  },
  supporting: {
    ...type.body,
    color: text.secondary,
    marginTop: space.lg,
    maxWidth: 300,
  },
  togetherHead: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  togetherCopy: {
    flex: 1,
    paddingRight: space.sm,
  },
  mascot: {
    marginRight: -layout.gutter,
  },
  ageRow: {
    flexDirection: "row",
    gap: space.sm,
    marginTop: space.xxl,
  },
  ageSlot: {
    flex: 1,
  },
  choiceStack: {
    gap: space.md,
    marginTop: space.xxl,
  },
});
