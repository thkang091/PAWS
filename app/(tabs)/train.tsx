import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon, ClockCounterClockwiseIcon, CoinsIcon, FireIcon, LightningIcon } from "phosphor-react-native";

import { SaveProgressBanner } from "@/components/account/SaveProgressBanner";
import { TopicHeader } from "@/features/train/components/TopicHeader";
import { TopicPicker } from "@/features/train/components/TopicPicker";
import { TopicTrail, type TrailStep } from "@/features/train/components/TopicTrail";
import { GardenBackdrop } from "@/features/train/components/GardenBackdrop";
import { EnergySheet } from "@/features/train/components/EnergySheet";
import { PressScale } from "@/components/ui/PressScale";
import { LoadingState } from "@/components/ui/LoadingState";
import { accent, bg, border, icon, layout, motion, radius, scene, space, text, type } from "@/constants/design";
import { buildChapters } from "@/constants/trainingChapters";
import { queryKeys } from "@/constants/queryKeys";
import { isCurriculumTopic, SECTION_NUMBER_BY_TOPIC_KEY } from "@/constants/trainingCurriculumMapping";
import { TRAINING_TOPICS, topicForFocus, type TopicKey, type TrainingTopic } from "@/constants/trainingTopics";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogRoadmap } from "@/hooks/useDogRoadmap";
import { useDogStreak } from "@/hooks/useDogStreak";
import { useProfileDashboard } from "@/hooks/useProfileDashboard";
import { useWallet } from "@/hooks/useWallet";
import { getErrorMessage } from "@/lib/errors";
import { generateRoadmap } from "@/services/curriculumService";
import { getAllSectionRoadmaps, getTrainingEnergy, resetTrainingEnergy } from "@/services/trainingCurriculumService";
import { setActiveTopic, useTrainingTopic } from "@/features/train/state/trainingTopic";
import type { PersonalizedRoadmapDay, SectionRoadmap } from "@/types/domain";

type ShelfTopic = TrainingTopic & {
  done: number;
  total: number;
  steps: TrailStep[];
  days: PersonalizedRoadmapDay[] | null;
  skillIds: string[] | null;
};

const curriculumStepsFor = (roadmap: SectionRoadmap): { steps: TrailStep[]; skillIds: string[]; done: number } => {
  let sawCurrent = false;
  const steps = roadmap.nodes.map((node) => {
    const isDone = Boolean(node.progress?.level5CompletedAt || node.progress?.checkpointStatus === "passed");
    const state: TrailStep["state"] = isDone ? "done" : !sawCurrent ? "current" : "available";
    if (!isDone && !sawCurrent) sawCurrent = true;
    return { id: node.skill.id, title: node.skill.title, state };
  });
  return {
    steps,
    skillIds: roadmap.nodes.map((node) => node.skill.id),
    done: steps.filter((step) => step.state === "done").length,
  };
};

export default function TrainTabScreen() {
  const { width, height } = useWindowDimensions();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const queryClient = useQueryClient();
  const [energyOpen, setEnergyOpen] = useState(false);
  const refill = useMutation({
    mutationFn: (id: string) => resetTrainingEnergy(id),
    retry: false,
    onSuccess: async (_, id) => {
      await queryClient.invalidateQueries({ queryKey: ["trainingEnergy", id] });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEnergyOpen(false);
    },
  });

  const { roadmap, days, refetch } = useDogRoadmap(dogId);
  const wallet = useWallet(dogId ?? "");
  const streak = useDogStreak(dogId);
  const streakCount = streak.isSuccess ? (streak.data?.currentStreak ?? 0) : undefined;
  const energy = useQuery({
    queryKey: dogId ? queryKeys.trainingEnergy(dogId, new Date().toDateString()) : ["trainingEnergy", "missing"],
    queryFn: () => getTrainingEnergy(dogId ?? ""),
    enabled: Boolean(dogId),
  });
  useProfileDashboard(dogId);

  const sectionRoadmaps = useQuery({
    queryKey: dogId ? queryKeys.allTrainingSectionRoadmaps(dogId) : ["allTrainingSectionRoadmaps", "missing"],
    queryFn: () => getAllSectionRoadmaps(dogId ?? ""),
    enabled: Boolean(dogId),
  });
  const roadmapBySectionNumber = useMemo(
    () => new Map((sectionRoadmaps.data ?? []).map((r) => [r.section.sectionNumber, r])),
    [sectionRoadmaps.data],
  );

  const reduceMotion = useReducedMotion();
  const { active, done: sampleDone } = useTrainingTopic();
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const direction = useRef(1);
  const contentRef = useRef<ScrollView>(null);

  const topics = useMemo<ShelfTopic[]>(() => {
    const chapters = buildChapters(days);
    return TRAINING_TOPICS.map((topic) => {
      const sectionNumber = SECTION_NUMBER_BY_TOPIC_KEY[topic.key];
      const sectionRoadmap = sectionNumber !== undefined ? roadmapBySectionNumber.get(sectionNumber) : undefined;
      if (sectionRoadmap && sectionRoadmap.nodes.length > 0) {
        const { steps, skillIds, done } = curriculumStepsFor(sectionRoadmap);
        return { ...topic, done, total: steps.length, steps, days: null, skillIds };
      }

      const chapter = chapters.find((item) => topicForFocus(item.key) === topic.key);
      if (chapter) {
        return {
          ...topic,
          done: chapter.doneCount,
          total: chapter.steps.length,
          steps: chapter.steps.map((step) => ({ id: step.day.id, title: step.title, state: step.state })),
          days: chapter.steps.map((step) => step.day),
          skillIds: null,
        };
      }
      if (isCurriculumTopic(topic.key)) {
        return { ...topic, done: 0, total: topic.lessons.length, steps: [], days: null, skillIds: null };
      }
      const doneCount = Math.min(sampleDone[topic.key] ?? 0, topic.lessons.length);
      return {
        ...topic,
        done: doneCount,
        total: topic.lessons.length,
        steps: topic.lessons.map((lesson, index) => ({
          id: lesson.id,
          title: lesson.title,
          state: index < doneCount ? "done" : index === doneCount ? "current" : "locked",
        })),
        days: null,
        skillIds: null,
      };
    });
  }, [days, sampleDone, roadmapBySectionNumber]);

  const activeIndex = Math.max(0, topics.findIndex((topic) => topic.key === active));
  const topic = topics[activeIndex];
  const trailWidth = Math.min(width - layout.gutter * 2, 520);

  const openLesson = (item: ShelfTopic, index: number) => {
    void Haptics.selectionAsync();
    const skillId = item.skillIds?.[index];
    if (skillId) {
      router.push(`/train/lesson/${skillId}`);
      return;
    }
    const day = item.days?.[index];
    router.push({
      pathname: "/train/lesson-preview",
      params: {
        title: item.steps[index]?.title ?? item.title,
        purpose: item.blurb,
        ...(day ? { dayId: day.id, totalDays: String(days.length) } : { topic: item.key, lesson: String(index) }),
      },
    });
  };

  const continueTopic = (item: ShelfTopic) => {
    const next = item.steps.findIndex((step) => step.state === "current");
    openLesson(item, next === -1 ? 0 : next);
  };

  const selectTopic = (key: TopicKey, index: number) => {
    direction.current = index > activeIndex ? 1 : -1;
    setActiveTopic(key);
    contentRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleGenerate = async () => {
    if (!dogId) return;
    try {
      setGenerating(true);
      setGenerateError(null);
      await generateRoadmap(dogId, false);
      void refetch();
    } catch (error) {
      setGenerateError(getErrorMessage(error, "Plan generation failed. Please retry."));
    } finally {
      setGenerating(false);
    }
  };

  if (dog.isLoading && !dog.error) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState message="Loading your training…" />
      </SafeAreaView>
    );
  }

  const enter = reduceMotion
    ? undefined
    : FadeIn.duration(300)
        .delay(90)
        .easing(motion.easing.out)
        .withInitialValues({ transform: [{ translateY: 18 * direction.current }] });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <GardenBackdrop width={width} height={height} />
      <View style={[styles.contentFrame, styles.header]}>
        <PressScale
          style={styles.silver}
          accessibilityRole="button"
          accessibilityLabel={`Energy: ${energy.data?.remaining ?? "Loading"}. Refill energy`}
          disabled={!dogId}
          onPress={() => {
            refill.reset();
            void energy.refetch();
            void Haptics.selectionAsync();
            setEnergyOpen(true);
          }}
        >
          <LightningIcon size={icon.inline} color={accent.band} weight="fill" />
          <Text style={styles.silverNum}>{energy.data?.remaining ?? "—"}</Text>
        </PressScale>

        <View
          style={styles.silver}
          accessible
          accessibilityLabel={`Streak: ${streakCount ?? "Loading"} days`}
        >
          <FireIcon size={icon.inline} color={accent.band} weight="fill" />
          <Text style={styles.silverNum}>{streakCount ?? "—"}</Text>
        </View>

        <View
          style={styles.silver}
          accessible
          accessibilityLabel={`Coins: ${wallet.data?.silverBalance ?? "Loading"}`}
        >
          <CoinsIcon size={icon.inline} color={accent.band} weight="fill" />
          <Text style={styles.silverNum}>{wallet.data?.silverBalance.toLocaleString() ?? "—"}</Text>
        </View>

        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Lesson history"
          scaleTo={0.9}
          style={styles.round}
          onPress={() => {
            void Haptics.selectionAsync();
            router.push("/training/history");
          }}
        >
          <ClockCounterClockwiseIcon size={icon.standard} color={text.primary} weight="regular" />
        </PressScale>
      </View>

      <View style={styles.body}>
        <View style={styles.contentFrame}>
          <SaveProgressBanner />

          {topic ? (
            <Animated.View
              key={topic.key}
              entering={enter}
              exiting={reduceMotion ? undefined : FadeOut.duration(90)}
            >
              <TopicHeader
                topic={topic}
                done={topic.done}
                total={topic.total}
                onContinue={() => continueTopic(topic)}
                onOpenPicker={() => {
                  void Haptics.selectionAsync();
                  setPicking(true);
                }}
              />

              {dog.data && !roadmap ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Build ${dog.data.name}'s personal plan`}
                  disabled={generating}
                  scaleTo={0.98}
                  style={styles.build}
                  onPress={() => void handleGenerate()}
                >
                  <Text style={styles.buildText} numberOfLines={2}>
                    {generateError ?? `Build ${dog.data.name}'s personal plan`}
                  </Text>
                  {generating ? (
                    <ActivityIndicator color={text.secondary} />
                  ) : (
                    <ArrowRightIcon size={icon.inline} color={text.secondary} weight="bold" />
                  )}
                </PressScale>
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        <ScrollView
          ref={contentRef}
          style={styles.column}
          contentContainerStyle={[styles.contentFrame, styles.columnInner]}
          showsVerticalScrollIndicator={false}
        >
          {topic ? (
            <Animated.View
              key={topic.key}
              entering={enter}
              exiting={reduceMotion ? undefined : FadeOut.duration(90)}
            >
              <TopicTrail
                topicKey={topic.key}
                steps={topic.steps}
                doneCount={topic.done}
                width={trailWidth}
                onStepPress={(_, index) => openLesson(topic, index)}
              />
            </Animated.View>
          ) : null}
        </ScrollView>
      </View>

      {energyOpen ? (
        <EnergySheet
          energy={energy.data}
          busy={refill.isPending}
          error={refill.isError ? "Couldn't refill energy. Please try again." : undefined}
          onClose={() => setEnergyOpen(false)}
          onRefill={() => { if (dogId && !refill.isPending) refill.mutate(dogId); }}
        />
      ) : null}

      <TopicPicker
        topics={topics}
        activeKey={topic?.key ?? active}
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={selectTopic}
      />
    </SafeAreaView>
  );
}

const TAB_CLEARANCE = 112;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: scene.ground },

  contentFrame: {
    width: "100%",
    maxWidth: 520 + layout.gutter * 2,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  silver: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
  },
  silverNum: { ...type.caption, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  round: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  body: { flex: 1 },
  column: { flex: 1 },
  columnInner: {
    paddingBottom: TAB_CLEARANCE + space.lg,
  },

  build: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginTop: space.md,
    paddingHorizontal: space.lg,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
  },
  buildText: { ...type.supporting, fontWeight: "600", color: text.primary, flexShrink: 1 },
});
