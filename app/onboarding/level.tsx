import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { MascotRunner } from "@/components/mascot/MascotRunner";
import { PlanSentence, type SentencePart } from "@/features/onboarding/components/PlanSentence";
import { OnboardingScreen } from "@/features/onboarding/components/OnboardingScreen";
import { QuestionHeadline } from "@/features/onboarding/components/QuestionHeadline";
import { ScaleRow } from "@/features/onboarding/components/ScaleRow";
import { SegmentedScale } from "@/features/onboarding/components/SegmentedScale";
import { SelectChipRow } from "@/features/onboarding/components/SelectChipRow";
import { motion, space, text, type } from "@/constants/design";
import {
  dailyMinuteOptions,
  experienceClause,
  experienceOptions,
  formatMinutes,
  minutesClause,
  motivationClause,
  motivationOptions,
  type Clause,
  type DailyMinutes,
  type Motivation,
  type TrainingExperience,
} from "@/constants/onboardingSetup";
import { queryKeys } from "@/constants/queryKeys";
import { getErrorMessage } from "@/lib/errors";
import { ageYearsForBucket, ownedSinceForDuration } from "@/lib/onboardingMapping";
import { useOnboardingDraft } from "@/providers/OnboardingDraftProvider";
import { createDogProfile } from "@/services/onboardingService";
import { onboardingFlowSchema } from "@/validation/onboardingSchemas";

const SCROLL_HEADROOM = 130;
const ORDER = ["experience", "time", "motivation"] as const;
type Question = (typeof ORDER)[number];

export default function OnboardingSetupScreen() {
  const { draft, update } = useOnboardingDraft();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const openY = useRef(0);
  const reduceMotion = useReducedMotion();

  const displayName = draft.name.trim() || "your dog";

  const [open, setOpen] = useState<Question | null>(() => {
    if (draft.experience === null) return "experience";
    if (draft.dailyMinutes === null) return "time";
    if (draft.motivation === null) return "motivation";
    return null;
  });

  const ready =
    draft.experience !== null && draft.dailyMinutes !== null && draft.motivation !== null;

  const createDog = useMutation({
    mutationFn: createDogProfile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentDog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile });
      void queryClient.invalidateQueries({ queryKey: ["dogRoadmap"] });
      router.replace("/(tabs)/train");
    },
  });

  const building = createDog.isPending;
  const handoff = useSharedValue(0);
  useEffect(() => {
    handoff.value = withTiming(building ? 1 : 0, {
      duration: building ? motion.duration.reveal : motion.duration.exit,
      easing: motion.easing.out,
    });
  }, [building]);

  const formStyle = useAnimatedStyle(() => ({
    opacity: 1 - handoff.value,
    transform: reduceMotion ? [] : [{ translateY: handoff.value * -10 }],
  }));

  const advanceFrom = (question: Question) => {
    const next = ORDER.slice(ORDER.indexOf(question) + 1).find((q) =>
      q === "time" ? draft.dailyMinutes === null : draft.motivation === null,
    );
    setOpen(next ?? null);
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, openY.current - SCROLL_HEADROOM),
        animated: true,
      });
    }, 80);
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/onboarding/goals");
  };

  const submit = () => {
    const parsed = onboardingFlowSchema.safeParse(draft);
    if (!parsed.success) {
      router.replace("/onboarding");
      return;
    }
    const values = parsed.data;
    createDog.mutate({
      name: values.name,
      gender: "unknown",
      breed: "",
      birthday: null,
      ageYears: ageYearsForBucket(values.ageBucket),
      ownedSince: ownedSinceForDuration(values.together),
      adoptionDate: null,
      obedienceLevel: values.obedienceLevel,
      energyLevel: values.energyLevel,
      goalKeys: [],
      existingSkillIds: [],
      targetSkillIds: [],
      concernKeys: [],
      concernOtherNote: null,
      selectedTrainingGoals: values.selectedTrainingGoals,
      planPreferences: {
        trainingExperience: values.experience,
        dailyMinutes: values.dailyMinutes,
        motivation: values.motivation,
      },
    });
  };

  const answered =
    (draft.experience ? 1 : 0) + (draft.dailyMinutes ? 1 : 0) + (draft.motivation ? 1 : 0);

  const sentence = (): SentencePart[] => {
    const clauses: Array<{ clause: Clause; question: Question }> = [];
    if (draft.experience) {
      clauses.push({ clause: experienceClause(draft.experience), question: "experience" });
    }
    if (draft.dailyMinutes) {
      clauses.push({ clause: minutesClause(draft.dailyMinutes), question: "time" });
    }
    if (draft.motivation) {
      clauses.push({ clause: motivationClause(draft.motivation), question: "motivation" });
    }
    if (clauses.length === 0) return [];

    const parts: SentencePart[] = [{ kind: "plain", text: "We'll" }];
    clauses.forEach(({ clause, question }, i) => {
      const last = i === clauses.length - 1;
      const punctuation = last ? "." : clauses.length > 2 ? "," : "";
      const join = i > 0 && last ? "and " : "";
      const lead = `${join}${clause.lead.replace("{name}", displayName)}`.trim();
      if (lead) parts.push({ kind: "plain", text: lead });

      const value = clause.value.replace("{name}", displayName);
      const trail = clause.trail.trim();
      if (trail) {
        parts.push({ kind: "value", text: value, onPress: () => setOpen(question) });
        parts.push({ kind: "plain", text: trail, suffix: punctuation });
      } else {
        parts.push({
          kind: "value",
          text: value,
          suffix: punctuation,
          onPress: () => setOpen(question),
        });
      }
    });
    return parts;
  };

  const openBlock = () => {
    if (open === "experience") {
      return (
        <>
          <Text style={styles.prompt}>How much training experience do you have?</Text>
          <View style={styles.stack}>
            {experienceOptions.map((option) => (
              <ScaleRow
                key={option.value}
                title={option.title}
                consequence={option.consequence}
                selected={draft.experience === option.value}
                onSelect={() => {
                  update({ experience: option.value as TrainingExperience });
                  advanceFrom("experience");
                }}
              />
            ))}
          </View>
        </>
      );
    }
    if (open === "time") {
      return (
        <>
          <Text style={styles.prompt}>How much time feels realistic each day?</Text>
          <SegmentedScale
            options={dailyMinuteOptions}
            format={formatMinutes}
            value={draft.dailyMinutes}
            accessibilityLabel="Minutes a day"
            onChange={(minutes) => {
              update({ dailyMinutes: minutes as DailyMinutes });
              advanceFrom("time");
            }}
          />
        </>
      );
    }
    if (open === "motivation") {
      return (
        <>
          <Text style={styles.prompt}>{`What motivates ${displayName} most?`}</Text>
          <SelectChipRow
            options={motivationOptions.map((o) => ({ label: o.label, value: o.value }))}
            value={draft.motivation ?? ""}
            onChange={(value) => {
              update({ motivation: value as Motivation });
              advanceFrom("motivation");
            }}
          />
        </>
      );
    }
    return null;
  };

  const parts = sentence();

  return (
    <OnboardingScreen
      stage={3}
      onBack={goBack}
      scrollRef={scrollRef}
      ctaLabel={`Build ${displayName === "your dog" ? "the" : `${displayName}'s`} plan`}
      ctaDisabled={!ready}
      ctaLoading={building}
      ctaFootnote="You can change these anytime."
      onContinue={submit}
    >
      <View style={styles.hero}>
        <View style={styles.headline}>
          <QuestionHeadline
            scale="title"
            parts={[
              { kind: "text", value: "How" },
              { kind: "text", value: "should" },
              { kind: "accent", value: "PAWS" },
              { kind: "text", value: "work" },
              { kind: "text", value: "for" },
              { kind: "text", value: "you?" },
            ]}
          />
        </View>
        <MascotRunner progress={answered / ORDER.length} />
      </View>

      <Text style={styles.supporting}>
        {`We'll adjust ${displayName}'s plan to fit your experience and routine.`}
      </Text>

      <Animated.View
        style={formStyle}
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

        {open !== null ? (
          <Animated.View
            key={open}
            style={styles.question}
            onLayout={(event) => (openY.current = event.nativeEvent.layout.y)}
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.reveal)}
            layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
          >
            {openBlock()}
          </Animated.View>
        ) : null}

        {createDog.error ? (
          <Text style={styles.error}>
            {getErrorMessage(createDog.error, "Dog profile creation failed. Please retry.")}
          </Text>
        ) : null}
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
  supporting: {
    ...type.body,
    color: text.secondary,
    marginTop: space.lg,
    maxWidth: 300,
  },
  sentence: {
    marginTop: space.sectionLg,
  },
  question: {
    marginTop: space.sectionLg,
  },
  prompt: {
    ...type.sectionTitle,
    color: text.primary,
    marginBottom: space.lg,
  },
  stack: {
    gap: space.md,
  },
  error: {
    ...type.supporting,
    color: text.primary,
    marginTop: space.xxl,
  },
});
