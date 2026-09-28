import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CoinsIcon,
  PauseIcon,
  PlayIcon,
  QuestionIcon,
  XIcon,
} from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LessonHero } from "@/features/train/components/LessonHero";
import { LessonNowPlaying } from "@/features/train/components/LessonNowPlaying";
import { TrainingLessonVideo } from "@/features/train/components/TrainingLessonVideo";
import type { LessonCue } from "@/features/train/components/lessonScript";
import { useLessonPlayback } from "@/hooks/useLessonPlayback";
import { accent, bg, border, icon as iconSize, layout, radius, space, text, type } from "@/constants/design";
import { queryKeys } from "@/constants/queryKeys";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { getErrorMessage } from "@/lib/errors";
import {
  endTrainingSession,
  getActiveTrainingSession,
  getTrainingEnergy,
  getTrainingLevelDetail,
  reportTrainingResult,
  resolveSkillSession,
  setSessionCardPosition,
  startTrainingSession,
} from "@/services/trainingCurriculumService";
import { buildCardSequence, findCardIndex } from "@/services/lessonCardSequence";
import type { TrainingSession } from "@/types/domain";

const findIndex = findCardIndex;

const BAR = 116;
const MIN_STAGE = 208;

export default function LessonScreen() {
  const { skillId } = useLocalSearchParams<{ skillId: string }>();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;
  const queryClient = useQueryClient();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const resolution = useQuery({
    queryKey: dogId && skillId ? queryKeys.skillSessionResolution(dogId, skillId) : ["skillSessionResolution", "missing"],
    queryFn: () => resolveSkillSession(dogId ?? "", skillId ?? ""),
    enabled: Boolean(dogId && skillId),
  });

  const levelId = resolution.data?.levelId ?? null;
  const levelDetail = useQuery({
    queryKey: levelId ? queryKeys.trainingLessonLevel(levelId) : ["trainingLessonLevel", "missing"],
    queryFn: () => getTrainingLevelDetail(levelId ?? ""),
    enabled: Boolean(levelId),
  });

  const activeSessionQuery = useQuery({
    queryKey: dogId && skillId ? queryKeys.activeTrainingSession(dogId, skillId) : ["activeTrainingSession", "missing"],
    queryFn: () => getActiveTrainingSession(dogId ?? "", skillId ?? ""),
    enabled: Boolean(dogId && skillId && resolution.data?.resolution === "resume"),
  });

  const energyQuery = useQuery({
    queryKey: dogId ? queryKeys.trainingEnergy(dogId, new Date().toDateString()) : ["trainingEnergy", "missing"],
    queryFn: () => getTrainingEnergy(dogId ?? ""),
    enabled: Boolean(dogId),
  });

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [settledResult, setSettledResult] = useState<"success" | "not_yet" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const cards = useMemo(() => (levelDetail.data ? buildCardSequence(levelDetail.data) : []), [levelDetail.data]);
  const activeCard = cards[cardIndex] ?? null;

  useEffect(() => {
    if (activeSessionQuery.data && !session) {
      setSession(activeSessionQuery.data);
      setCardIndex(findIndex(cards, activeSessionQuery.data.currentCardKey));
    }
  }, [activeSessionQuery.data, cards, session]);

  const CLIP_SECONDS = 5;
  const cardCues: LessonCue[] = useMemo(() => {
    if (!activeCard) return [];
    return [activeCard.body, activeCard.tryIt, activeCard.keyAction, activeCard.harderPart, activeCard.hint]
      .filter((text): text is string => Boolean(text))
      .map((text, index) => ({ at: index * CLIP_SECONDS, text }));
  }, [activeCard]);
  const cardDuration = cardCues.length > 0 ? (cardCues.length - 1) * CLIP_SECONDS + CLIP_SECONDS : 0;
  const playback = useLessonPlayback(cardDuration);

  useEffect(() => {
    if (session && cardDuration > 0) playback.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardIndex, session, cardDuration]);

  const heroMax = Math.min(Math.round(height * 0.5), 420);
  const heroMin = insets.top + 72;
  const range = Math.max(1, heroMax - heroMin);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const collapse = useDerivedValue(() => Math.min(1, Math.max(0, scrollY.value / range)));
  const heroStyle = useAnimatedStyle(() => ({
    height: interpolate(collapse.value, [0, 1], [heroMax, heroMin]),
  }));

  const isLoading = dog.isLoading || resolution.isLoading || levelDetail.isLoading || (resolution.data?.resolution === "resume" && activeSessionQuery.isLoading);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingState message="Preparing lesson…" />
      </SafeAreaView>
    );
  }

  if (resolution.isError || levelDetail.isError || !dogId || !skillId || cards.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState
          message={getErrorMessage(resolution.error ?? levelDetail.error, "This lesson could not be prepared.")}
          onRetry={() => {
            void resolution.refetch();
            void levelDetail.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  const close = () => router.back();

  const refreshProgressCaches = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.allTrainingSectionRoadmaps(dogId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dogTrainingOverview(dogId) });
  };

  const handleStart = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await startTrainingSession(dogId, skillId);
      setSession(result.session);
      setCardIndex(findIndex(cards, result.session.currentCardKey ?? cards[0]?.key ?? null));
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainingEnergy(dogId, new Date().toDateString()) });
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not start this lesson."));
    } finally {
      setSubmitting(false);
    }
  };

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(cards.length - 1, index));
    setCardIndex(clamped);
    if (session) void setSessionCardPosition(session.id, cards[clamped].key);
  };

  const handleReport = async (result: "success" | "not_yet") => {
    if (!session) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const outcome = await reportTrainingResult(session.id, result, cards[cardIndex].dbCardId);
      setSession(outcome.session);
      if (!outcome.settled) {
        const practiceIndex = cards.findIndex((c) => c.type === "additional_practice");
        goTo(practiceIndex === -1 ? cardIndex : practiceIndex);
      } else {
        setSettledResult(outcome.result);
        goTo(cards.findIndex((c) => c.type === "completion"));
        refreshProgressCaches();
        void queryClient.invalidateQueries({ queryKey: queryKeys.trainingEnergy(dogId, new Date().toDateString()) });
      }
    } catch (error) {
      setActionError(getErrorMessage(error, "Could not save that result."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEndLesson = async () => {
    void Haptics.selectionAsync();
    if (session && session.status === "active") {
      try {
        await endTrainingSession(session.id, "guardian_ended");
      } catch {
      }
    }
    close();
  };

  const ready = levelDetail.data?.readyCard;
  const isNewSession = resolution.data?.resolution !== "resume";
  const remaining = energyQuery.data?.remaining;
  const card = session ? activeCard : null;
  const isFirst = cardIndex === 0;
  const isCompletion = card?.type === "completion";

  const clockDone = cardCues.length === 0 || playback.status === "ended";
  const spokenCue = playback.status === "idle" ? -1 : Math.min(
    cardCues.length - 1,
    Math.max(0, cardCues.reduce((last, cue, index) => (cue.at <= playback.time ? index : last), 0)),
  );
  const clock = (seconds: number) => {
    const whole = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  };

  const badge =
    levelDetail.data?.stageType === "checkpoint"
      ? "Checkpoint"
      : levelDetail.data?.levelNumber === 1
        ? "Most popular lesson"
        : undefined;

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.hero, heroStyle]}>
        <LessonHero
          title={levelDetail.data?.title ?? ""}
          chapter={levelDetail.data?.skill.title}
          badge={badge}
          collapse={collapse}
          topInset={insets.top}
        >
          <TrainingLessonVideo media={levelDetail.data?.media ?? null} fill />
        </LessonHero>
      </Animated.View>

      <View style={[styles.topBar, { top: insets.top }]} pointerEvents="box-none">
        {session ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.iconButton}
            disabled={isFirst || isCompletion}
            onPress={() => goTo(cardIndex - 1)}
          >
            <ArrowLeftIcon size={iconSize.standard} color={isFirst || isCompletion ? "rgba(255,255,255,0.4)" : bg.surface} weight="bold" />
          </PressScale>
        ) : (
          <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.iconButton} onPress={close}>
            <XIcon size={iconSize.standard} color={bg.surface} weight="bold" />
          </PressScale>
        )}

        {session && card ? (
          <View style={styles.progressDots}>
            {cards
              .filter((c) => c.type !== "additional_practice" || c.key === card.key)
              .map((c) => (
                <View key={c.key} style={[styles.dot, c.key === card.key && styles.dotActive]} />
              ))}
          </View>
        ) : remaining !== undefined ? (
          <View style={styles.energyPill}>
            <CoinsIcon size={iconSize.inline} color={accent.band} weight="fill" />
            <Text style={styles.energyText}>{remaining}</Text>
          </View>
        ) : (
          <View />
        )}

        {session ? (
          <PressScale accessibilityRole="button" accessibilityLabel="End lesson" style={styles.iconButton} onPress={() => void handleEndLesson()}>
            <XIcon size={iconSize.standard} color={bg.surface} weight="bold" />
          </PressScale>
        ) : (
          <View style={styles.iconButton} />
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={{ marginTop: heroMin }}
        contentContainerStyle={{ paddingTop: range, paddingBottom: BAR + insets.bottom }}
      >
        <View style={styles.sheet}>
          {!session ? (
            <>
              <Text style={styles.skillLabel}>{levelDetail.data?.skill.title}</Text>
              <Text style={styles.title}>{levelDetail.data?.title}</Text>
              {levelDetail.data?.goal ? <Text style={styles.body}>{levelDetail.data.goal}</Text> : null}

              {ready ? (
                <View style={styles.stack}>
                  {ready.materials.map((m) => (
                    <View key={m.label} style={styles.materialRow}>
                      <Text style={styles.materialLabel}>{m.label}</Text>
                      <Text style={styles.materialDetail}>{m.detail}</Text>
                    </View>
                  ))}
                  <Text style={styles.safetyCopy}>{ready.safetyCopy}</Text>
                </View>
              ) : null}

              {isNewSession && remaining === 0 ? (
                <Text style={styles.energyWarning}>
                  Out of Energy for today. It refills tomorrow — come back then to start this lesson.
                </Text>
              ) : null}

              {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
            </>
          ) : card ? (
            <>
              {card.type === "additional_practice" ? <Text style={styles.eyebrow}>Let's make it easier</Text> : null}
              {card.title ? <Text style={styles.title}>{card.title}</Text> : null}

              {cardCues.length > 0 ? (
                <LessonNowPlaying
                  stepNumber={cardIndex + 1}
                  stepCount={cards.length}
                  stepTitle={card.title ?? levelDetail.data?.title ?? ""}
                  cues={cardCues}
                  spoken={spokenCue}
                  progress={playback.progress}
                  remaining={clock(cardDuration - playback.time)}
                  onSeek={playback.seek}
                />
              ) : card.body ? (
                <Text style={styles.body}>{card.body}</Text>
              ) : null}

              {isCompletion ? (
                <View style={styles.completionBlock}>
                  <Text style={styles.completionResult}>{settledResult === "success" ? "Success" : "Not yet"}</Text>
                  <Text style={styles.body}>{settledResult === "success" ? card.successCopy : card.notYetCopy}</Text>
                  {energyQuery.data ? <Text style={styles.energyFootnote}>Energy remaining today: {energyQuery.data.remaining}</Text> : null}
                </View>
              ) : null}

              {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
            </>
          ) : null}
        </View>
      </Animated.ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.barRow}>
          {session && !isCompletion && clockDone && playback.status === "ended" ? (
            <PressScale accessibilityRole="button" accessibilityLabel="Watch again" style={styles.quiet} onPress={() => playback.restart()}>
              <ArrowCounterClockwiseIcon size={iconSize.button} color={text.primary} weight="bold" />
            </PressScale>
          ) : null}

          <View style={styles.primaryWrap}>
            {!session ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={isNewSession ? "Start, uses 1 Energy" : "Resume"}
                style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
                disabled={submitting || (isNewSession && remaining === 0)}
                onPress={() => void handleStart()}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting
                    ? "Starting…"
                    : isNewSession
                      ? remaining === 0
                        ? "No Energy left today"
                        : `${ready?.primaryAction ?? "Continue"} · Uses 1 Energy`
                      : "Resume"}
                </Text>
              </PressScale>
            ) : isCompletion ? (
              <PressScale accessibilityRole="button" accessibilityLabel="Continue" style={styles.primaryButton} onPress={close}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </PressScale>
            ) : !clockDone ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={playback.status === "playing" ? "Pause" : "Resume"}
                style={styles.primaryButton}
                onPress={() => (playback.status === "playing" ? playback.pause() : playback.resume())}
              >
                <View style={styles.primaryFace}>
                  {playback.status === "playing" ? (
                    <PauseIcon size={iconSize.button} color={text.primary} weight="bold" />
                  ) : (
                    <PlayIcon size={iconSize.button} color={text.primary} weight="bold" />
                  )}
                  <Text style={styles.primaryButtonText}>{playback.status === "playing" ? "Pause" : "Resume"}</Text>
                </View>
              </PressScale>
            ) : card?.showResultButtons ? (
              <View style={styles.resultRow}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Not yet"
                  style={[styles.secondaryButton, submitting && styles.primaryButtonDisabled]}
                  disabled={submitting}
                  onPress={() => void handleReport("not_yet")}
                >
                  <Text style={styles.secondaryButtonText}>Not yet</Text>
                </PressScale>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Success"
                  style={[styles.primaryButton, styles.resultSuccess, submitting && styles.primaryButtonDisabled]}
                  disabled={submitting}
                  onPress={() => void handleReport("success")}
                >
                  <Text style={styles.primaryButtonText}>{submitting ? "Saving…" : "Success"}</Text>
                </PressScale>
              </View>
            ) : (
              <PressScale accessibilityRole="button" accessibilityLabel="Continue" style={styles.primaryButton} onPress={() => goTo(cardIndex + 1)}>
                <Text style={styles.primaryButtonText}>Continue</Text>
              </PressScale>
            )}
          </View>

          {session ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Need help with this lesson"
              style={styles.quiet}
              onPress={() => {
                void Haptics.selectionAsync();
                if (playback.status === "playing") playback.pause();
                router.push(
                  `/train/help?skillId=${skillId}&cardIndex=${cardIndex}&state=${isCompletion ? "finished" : "live"}`,
                );
              }}
            >
              <QuestionIcon size={iconSize.button} color={text.secondary} weight="regular" />
            </PressScale>
          ) : null}
        </View>

        {!session ? (
          <PressScale accessibilityRole="button" accessibilityLabel="End lesson" style={styles.textButton} onPress={close}>
            <Text style={styles.textButtonLabel}>{ready?.secondaryAction ?? "End lesson"}</Text>
          </PressScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  safe: { flex: 1, backgroundColor: bg.canvas },
  hero: { position: "absolute", top: 0, left: 0, right: 0, minHeight: MIN_STAGE },
  topBar: {
    position: "absolute",
    left: layout.gutter,
    right: layout.gutter,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  iconButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28,27,26,0.4)",
  },
  energyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: "rgba(28,27,26,0.55)",
  },
  energyText: { ...type.caption, fontWeight: "700", color: bg.surface },
  progressDots: { flexDirection: "row", gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: bg.surface, width: 18 },
  sheet: {
    backgroundColor: bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -space.xl,
    paddingHorizontal: layout.gutter,
    paddingTop: space.xl,
    paddingBottom: space.section,
    gap: space.md,
    minHeight: 420,
  },
  skillLabel: { ...type.eyebrow, color: text.secondary },
  eyebrow: { ...type.eyebrow, color: accent.band },
  title: { ...type.sectionTitle, color: text.primary },
  body: { ...type.body, color: text.secondary },
  stack: { gap: space.md, marginTop: space.lg },
  materialRow: { gap: 2 },
  materialLabel: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  materialDetail: { ...type.supporting, color: text.secondary },
  safetyCopy: { ...type.supporting, color: text.secondary, marginTop: space.sm },
  energyWarning: {
    ...type.supporting,
    color: "#8A5A00",
    backgroundColor: "#FFF3D6",
    padding: space.md,
    borderRadius: radius.card,
  },
  completionBlock: { alignItems: "flex-start", gap: space.sm, marginTop: space.md },
  completionResult: { ...type.pageTitle, color: text.primary },
  energyFootnote: { ...type.caption, color: text.secondary, marginTop: space.sm },
  errorText: { ...type.supporting, color: "#B3261E" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: bg.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: border.soft,
  },
  barRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  primaryWrap: { flex: 1 },
  primaryFace: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  quiet: {
    width: layout.controlHeight,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  resultRow: { flexDirection: "row", gap: space.md },
  primaryButton: {
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  resultSuccess: { flex: 1 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  secondaryButton: {
    height: layout.controlHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  secondaryButtonText: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  textButton: { alignItems: "center", paddingVertical: space.sm },
  textButtonLabel: { ...type.supporting, color: text.secondary },
});
