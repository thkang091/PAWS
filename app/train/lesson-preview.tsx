import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, type ScrollView, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowCounterClockwiseIcon,
  BookmarkSimpleIcon,
  CheckCircleIcon,
  PauseIcon,
  PlayIcon,
  QuestionIcon,
} from "phosphor-react-native";

import { CURRENT_LESSON } from "@/features/train/components/currentLesson";
import { LessonHero } from "@/features/train/components/LessonHero";
import { LessonNowPlaying } from "@/features/train/components/LessonNowPlaying";
import { LessonPreparation } from "@/features/train/components/LessonPreparation";
import {
  cueIndexAt,
  flattenCues,
} from "@/features/train/components/lessonScript";
import { PressScale } from "@/components/ui/PressScale";
import { useLessonPlayback } from "@/hooks/useLessonPlayback";
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
import { markTopicLessonDone } from "@/features/train/state/trainingTopic";
import type { TopicKey } from "@/constants/trainingTopics";

const LESSON = CURRENT_LESSON;

const SHEET_LIFT = 28;
const BAR = 132;
const SCROLL_LEAD = 280;

type Phase = "intro" | "sweeping" | "live";

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export default function LessonScreen() {
  const { dayId, totalDays, title, purpose, topic, lesson } = useLocalSearchParams<{
    dayId?: string; totalDays?: string; title?: string; purpose?: string; topic?: string; lesson?: string;
  }>();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");

  const script = LESSON.script;
  const cues = useMemo(() => flattenCues(script), [script]);
  const playback = useLessonPlayback(script.duration);

  const cueIndex = playback.status === "idle" ? -1 : cueIndexAt(cues, playback.time);
  const current = cueIndex >= 0 ? cues[cueIndex] : undefined;

  const heroMax = Math.min(Math.round(height * 0.58), 500);
  const heroMin = insets.top + 72;
  const range = Math.max(1, heroMax - heroMin);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const collapse = useDerivedValue(() =>
    reduceMotion ? 0 : Math.min(1, Math.max(0, scrollY.value / range)),
  );

  const heroStyle = useAnimatedStyle(() => ({
    height: reduceMotion ? heroMax : interpolate(collapse.value, [0, 1], [heroMax, heroMin]),
  }));

  const barLine = useDerivedValue(() => {
    const on = scrollY.value > 8 ? 1 : 0;
    return reduceMotion ? on : withTiming(on, { duration: motion.duration.select });
  });
  const barStyle = useAnimatedStyle(() => ({
    borderTopColor: `rgba(232,231,226,${barLine.value})`,
  }));

  const swept = useSharedValue(0);

  const introStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - swept.value / 0.55),
    transform: [{ translateX: swept.value * 96 }],
  }));

  const liveStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, (swept.value - 0.3) / 0.7),
    transform: [{ translateX: (1 - swept.value) * -28 }],
  }));

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const startSession = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const travelling = !reduceMotion && scrollY.value > 4;
    if (travelling) {
      (scrollRef.current as unknown as ScrollView | null)?.scrollTo({ y: 0, animated: true });
    }

    const begin = () => {
      playback.start();
      setPhase("sweeping");
      swept.value = reduceMotion
        ? 1
        : withTiming(1, { duration: motion.duration.reveal, easing: motion.easing.out });
      timers.current.push(
        setTimeout(() => setPhase("live"), reduceMotion ? 0 : motion.duration.reveal),
      );
    };

    if (travelling) timers.current.push(setTimeout(begin, SCROLL_LEAD));
    else begin();
  };

  const startsSession = Boolean(dayId);
  const finishSession = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (startsSession) {
      router.push(`/train/activity/${dayId}${totalDays ? `?totalDays=${totalDays}` : ""}`);
      return;
    }
    // Topics without a server curriculum keep their progress here, so the trail moves on for real.
    if (topic && lesson != null) markTopicLessonDone(topic as TopicKey, Number(lesson));
    setDone(true);
  };

  const step = current ? script.steps[current.step] : undefined;

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.hero, heroStyle]}>
        <LessonHero
          lessonNumber={LESSON.number}
          title={title ?? LESSON.title}
          chapter={LESSON.chapter}
          badge={LESSON.badge}
          collapse={collapse}
          topInset={insets.top}
          onBack={() => router.back()}
          onPlay={phase === "intro" ? startSession : undefined}
        >
          <VideoSlot />
        </LessonHero>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        style={{ marginTop: heroMin }}
        contentContainerStyle={{ paddingTop: range, paddingBottom: BAR + insets.bottom }}
      >
        <View style={styles.sheet}>
          {phase !== "live" ? (
            <Animated.View
              style={[styles.intro, phase === "sweeping" && styles.leaving, introStyle]}
              pointerEvents={phase === "intro" ? "auto" : "none"}
            >
              <LessonPreparation
                purpose={purpose ?? LESSON.blurb}
                materials={LESSON.materials}
              />
            </Animated.View>
          ) : null}

          {phase !== "intro" && current && step ? (
            <Animated.View style={liveStyle}>
              <LessonNowPlaying
                stepNumber={current.step + 1}
                stepCount={script.steps.length}
                stepTitle={step.title}
                cues={step.cues}
                spoken={current.cue}
                progress={playback.progress}
                remaining={clock(script.duration - playback.time)}
                onSeek={playback.seek}
              />
            </Animated.View>
          ) : null}
        </View>
      </Animated.ScrollView>

      <Animated.View style={[styles.bar, barStyle, { paddingBottom: insets.bottom + space.lg }]}>
        {playback.status === "ended" ? (
          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : FadeIn.duration(motion.duration.enter).withInitialValues({
                    opacity: 0,
                    transform: [{ scale: 0.9 }],
                  })
            }
          >
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Watch again from the start"
              style={styles.quiet}
              onPress={() => {
                void Haptics.selectionAsync();
                playback.restart();
              }}
            >
              <ArrowCounterClockwiseIcon
                size={iconSize.button}
                color={text.primary}
                weight="bold"
              />
            </PressScale>
          </Animated.View>
        ) : null}

        <Animated.View style={styles.primaryWrap} layout={settle}>
          <Primary
            status={playback.status}
            done={done}
            reduceMotion={reduceMotion}
            onStart={startSession}
            onPause={() => {
              void Haptics.selectionAsync();
              playback.pause();
            }}
            onResume={() => {
              void Haptics.selectionAsync();
              playback.resume();
            }}
            onFinish={finishSession}
            onToggleDone={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setDone((d) => !d);
            }}
          />
        </Animated.View>

        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Need help with this lesson"
          style={styles.quiet}
          onPress={() => {
            void Haptics.selectionAsync();
            if (playback.status === "playing") playback.pause();
            const query = [
              current ? `step=${current.step}` : null,
              `state=${playback.status === "ended" ? "finished" : phase === "intro" ? "intro" : "live"}`,
              dayId ? `dayId=${dayId}` : null,
            ]
              .filter(Boolean)
              .join("&");
            router.push(`/train/help?${query}`);
          }}
        >
          <QuestionIcon size={iconSize.button} color={text.secondary} weight="regular" />
        </PressScale>

        <PressScale
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? "Saved for later" : "Save for later"}
          style={styles.quiet}
          onPress={() => {
            void Haptics.selectionAsync();
            setSaved((s) => !s);
          }}
        >
          <BookmarkSimpleIcon
            size={iconSize.button}
            color={saved ? text.primary : text.secondary}
            weight={saved ? "fill" : "regular"}
          />
        </PressScale>
      </Animated.View>
    </View>
  );
}

const Primary = ({
  status,
  done,
  reduceMotion,
  onStart,
  onPause,
  onResume,
  onFinish,
  onToggleDone,
}: {
  status: "idle" | "playing" | "paused" | "ended";
  done: boolean;
  reduceMotion: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onToggleDone: () => void;
}) => {
  const face =
    status === "playing"
      ? { key: "pause", label: "Pause", glyph: PauseIcon, filled: true }
      : status === "paused"
        ? { key: "resume", label: "Resume", glyph: PlayIcon, filled: true }
        : status === "ended"
          ? { key: "finish", label: "Finish session", glyph: CheckCircleIcon, filled: true }
          : done
            ? { key: "completed", label: "Completed", glyph: CheckCircleIcon, filled: false }
            : { key: "start", label: "Start session", glyph: PlayIcon, filled: true };

  const Glyph = face.glyph;

  const press = () => {
    if (status === "playing") return onPause();
    if (status === "paused") return onResume();
    if (status === "ended") return onFinish();
    if (done) return onToggleDone();
    return onStart();
  };

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={face.label}
      style={[styles.primary, !face.filled && styles.primaryDone]}
      onPress={press}
    >
      <Animated.View
        key={face.key}
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
        style={styles.primaryFace}
      >
        {Glyph ? (
          <Glyph
            size={iconSize.button}
            color={text.primary}
            weight={face.key === "completed" ? "fill" : "bold"}
          />
        ) : null}
        <Text style={styles.primaryText}>{face.label}</Text>
      </Animated.View>
    </PressScale>
  );
};

const VideoSlot = () => <View style={styles.videoSlot} />;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  hero: { position: "absolute", top: 0, left: 0, right: 0 },
  videoSlot: { flex: 1, backgroundColor: bg.subtle },

  sheet: {
    marginTop: -SHEET_LIFT,
    paddingHorizontal: layout.gutter,
    paddingTop: space.xl,
    paddingBottom: space.section,
    backgroundColor: bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  intro: { paddingBottom: space.md },
  leaving: { position: "absolute", left: layout.gutter, right: layout.gutter, top: space.xl },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingTop: space.lg,
    paddingHorizontal: layout.gutter,
    backgroundColor: bg.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryWrap: { flex: 1 },
  primary: {
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    justifyContent: "center",
    overflow: "hidden",
  },
  primaryFace: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  primaryDone: { backgroundColor: accent.primary },
  primaryText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  quiet: {
    width: layout.controlHeight,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
});
