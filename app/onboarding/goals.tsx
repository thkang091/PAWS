import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";

import { PawsDogPeek } from "@/components/mascot/PawsDog";
import { ChoiceRow } from "@/features/onboarding/components/ChoiceRow";
import { FocusCard } from "@/features/onboarding/components/FocusCard";
import { OnboardingScreen } from "@/features/onboarding/components/OnboardingScreen";
import { PlanSentence, type SentencePart } from "@/features/onboarding/components/PlanSentence";
import { QuestionHeadline } from "@/features/onboarding/components/QuestionHeadline";
import { Reveal } from "@/features/onboarding/components/Reveal";
import { TopicPreview } from "@/features/onboarding/components/TopicPreview";
import { topicByKey, topicForFocus } from "@/constants/trainingTopics";
import { startWithTopic } from "@/features/train/state/trainingTopic";
import { layout, motion, space, text, type } from "@/constants/design";
import { focusAreas, focusByKey } from "@/constants/onboardingFocus";
import { useOnboardingDraft } from "@/providers/OnboardingDraftProvider";
import type { OwnerTrainingGoal } from "@/types/domain";

const MASCOT_WIDTH = 128;
const SCROLL_HEADROOM = 120;

export default function OnboardingFocusScreen() {
  const { draft, update } = useOnboardingDraft();
  const displayName = draft.name.trim() || "your dog";
  const scrollRef = useRef<ScrollView>(null);
  const questionY = useRef(0);
  const reduceMotion = useReducedMotion();

  const chosen = draft.selectedTrainingGoals[0] ?? null;
  const focus = chosen ? (focusByKey.get(chosen.goal) ?? null) : null;
  const followUpAnswer = chosen?.selectedPainPoints[0] ?? null;

  const [picking, setPicking] = useState(focus === null);

  const ready = focus !== null && (focus.followUp === null || followUpAnswer !== null);

  const carry = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, questionY.current - SCROLL_HEADROOM),
        animated: true,
      });
    }, 80);
  };

  const choose = (key: OwnerTrainingGoal) => {
    const sameAsBefore = chosen?.goal === key;
    update({
      selectedTrainingGoals: [
        {
          goal: key,
          priorityRank: 1,
          selectedPainPoints: sameAsBefore ? chosen.selectedPainPoints : [],
        },
      ],
    });
    startWithTopic(topicForFocus(key));
    setPicking(false);
    carry();
  };

  const answerFollowUp = (value: string) => {
    if (!chosen) return;
    update({ selectedTrainingGoals: [{ ...chosen, selectedPainPoints: [value] }] });
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/onboarding");
  };

  const sentence = (): SentencePart[] => {
    if (!focus) return [];
    const parts: SentencePart[] = [{ kind: "plain", text: "We'll" }];
    if (focus.lead.trim()) parts.push({ kind: "plain", text: focus.lead.trim() });

    const answered = focus.followUp && followUpAnswer;
    parts.push({
      kind: "value",
      text: focus.sentenceValue,
      suffix: answered ? "," : ".",
      onPress: () => setPicking(true),
    });

    if (answered) {
      const option = focus.followUp?.options.find((o) => o.value === followUpAnswer);
      if (option) {
        parts.push({ kind: "plain", text: "focusing on" });
        parts.push({
          kind: "value",
          text: option.label.toLowerCase(),
          suffix: ".",
          onPress: () => setPicking(false),
        });
      }
    }
    return parts;
  };

  const parts = sentence();
  const rows = [0, 3, 6].map((start) => focusAreas.slice(start, start + 3));

  return (
    <OnboardingScreen
      stage={2}
      onBack={goBack}
      scrollRef={scrollRef}
      ctaLabel="Continue"
      ctaDisabled={!ready}
      onContinue={() => router.push("/onboarding/level")}
    >
      <View style={styles.hero}>
        <View style={styles.headline}>
          <QuestionHeadline
            scale="title"
            parts={[
              { kind: "text", value: "What" },
              { kind: "text", value: "should" },
              { kind: "text", value: "we" },
              { kind: "text", value: "work" },
              { kind: "text", value: "on" },
              { kind: "accent", value: "first", suffix: "?" },
            ]}
          />
        </View>
        <View style={styles.mascot} pointerEvents="none">
          <PawsDogPeek width={MASCOT_WIDTH} />
        </View>
      </View>

      <Text style={styles.supporting}>
        {`Choose the one that would make the biggest difference for ${displayName} right now.`}
      </Text>

      <Animated.View
        layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
      >
        {parts.length > 0 ? (
          <Animated.View
            style={styles.sentence}
            layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
          >
            <PlanSentence parts={parts} reduceMotion={reduceMotion} />
          </Animated.View>
        ) : null}

        {focus && !picking ? (
          <Animated.View
            style={styles.preview}
            layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
          >
            <TopicPreview topic={topicByKey.get(topicForFocus(focus.key))!} />
          </Animated.View>
        ) : null}

        <Animated.View
          style={styles.question}
          onLayout={(event) => (questionY.current = event.nativeEvent.layout.y)}
          layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
        >
          {picking ? (
            <Animated.View
              key="grid"
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.reveal)}
              style={styles.grid}
            >
              {rows.map((row, r) => (
                <View key={r} style={styles.gridRow}>
                  {row.map((area) => (
                    <FocusCard
                      key={area.key}
                      title={area.title}
                      blurb={area.blurb}
                      pose={area.pose}
                      tint={area.tint}
                      selected={chosen?.goal === area.key}
                      onPress={() => choose(area.key)}
                    />
                  ))}
                </View>
              ))}
            </Animated.View>
          ) : focus?.followUp ? (
            <Animated.View
              key={focus.key}
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.reveal)}
            >
              <Text style={styles.prompt}>{focus.followUp.prompt}</Text>
              <View style={styles.followUpStack}>
                {focus.followUp.options.map((option, index) => (
                  <Reveal key={option.value} index={index} offset={80}>
                    <ChoiceRow
                      label={option.label}
                      selected={followUpAnswer === option.value}
                      onSelect={() => answerFollowUp(option.value)}
                    />
                  </Reveal>
                ))}
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: space.section,
  },
  headline: {
    flex: 1,
    paddingRight: space.sm,
  },
  mascot: {
    marginRight: -layout.gutter,
  },
  supporting: {
    ...type.body,
    color: text.secondary,
    marginTop: space.lg,
    maxWidth: 300,
  },
  sentence: {
    marginTop: space.sectionLg,
  },
  preview: {
    marginTop: space.xl,
  },
  question: {
    marginTop: space.sectionLg,
  },
  grid: {
    gap: space.sm,
  },
  gridRow: {
    flexDirection: "row",
    gap: space.sm,
  },
  prompt: {
    ...type.sectionTitle,
    color: text.primary,
    marginBottom: space.lg,
  },
  followUpStack: {
    gap: space.md,
  },
});
