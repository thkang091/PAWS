import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon, XIcon } from "phosphor-react-native";

import { CoachComposer } from "@/features/train/components/coach/CoachComposer";
import { CoachMark, CoachReply, CoachThinking } from "@/features/train/components/coach/CoachReply";
import { StepRail } from "@/features/train/components/coach/StepRail";
import { UserBubble } from "@/features/train/components/coach/UserBubble";
import { CURRENT_LESSON } from "@/features/train/components/currentLesson";
import { getTrainingClipLessons } from "@/features/train/media/trainingClipLessons";
import { makeRefresherQuestion } from '@/features/train/rounds/refresherQuestion';
import { isCoachConversation, recordCoachConversation, type CoachPracticeContext } from '@/services/coachPractice';
import { PressScale } from "@/components/ui/PressScale";
import { buildChapters } from "@/constants/trainingChapters";
import { queryKeys } from "@/constants/queryKeys";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useDogContext } from "@/features/care/intel/useDogContext";
import { useDogRoadmap } from "@/hooks/useDogRoadmap";
import { buildCardSequence } from "@/services/lessonCardSequence";
import { getTrainingLevelDetail, resolveSkillSession } from "@/services/trainingCurriculumService";
import {
  askCoach,
  transcribe,
  type ChatTurn,
  type CoachBrief,
  type VoiceClip,
} from "@/services/trainerChat";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

type Turn = ChatTurn & {
  fromChoice?: boolean;
  voice?: { durationMs: number; levels: readonly number[]; transcribing: boolean };
};

type Failure = { text: string; retry?: () => void };

let counter = 0;
const nextId = () => `t${Date.now()}-${counter++}`;

const sample = (levels: readonly number[], count = 24) =>
  Array.from({ length: count }, (_, i) => levels[Math.floor((i / count) * levels.length)] ?? 0.1);

const SHEET_GAP = 56;
const DISMISS_DISTANCE = 140;
const DISMISS_VELOCITY = 0.5;

export default function CoachSheet() {
  const params = useLocalSearchParams<{ step?: string; state?: string; dayId?: string; skillId?: string; levelId?: string; cardIndex?: string; preview?: string; previewLevel?: string; clip?: string; reinforcement?: string; dogId?: string; roundId?: string; sessionId?: string; reviewAt?: string; skillCode?: string; levelNumber?: string; lessonTitle?: string }>();
  const queryClient = useQueryClient();
  const recorded = useRef(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const dog = useCurrentDog();

  const resolution = useQuery({
    queryKey: dog.data?.id && params.skillId ? queryKeys.skillSessionResolution(dog.data.id, params.skillId) : ["skillSessionResolution", "missing"],
    queryFn: () => resolveSkillSession(dog.data?.id ?? "", params.skillId ?? ""),
    enabled: Boolean(dog.data?.id && params.skillId && !params.levelId),
  });
  const levelId = params.levelId || resolution.data?.levelId || null;
  const levelDetail = useQuery({
    queryKey: levelId ? queryKeys.trainingLessonLevel(levelId) : ["trainingLessonLevel", "missing"],
    queryFn: () => getTrainingLevelDetail(levelId ?? ""),
    enabled: Boolean(levelId),
  });

  const realClip = params.clip === "1" && levelDetail.data
    ? getTrainingClipLessons(levelDetail.data.skill.skillCode).find(item => item.levelNumber === levelDetail.data?.levelNumber)
    : null;
  const realLesson = levelDetail.data
    ? {
        number: levelDetail.data.levelNumber ?? 1,
        chapter: levelDetail.data.skill.title,
        title: levelDetail.data.title,
        steps: realClip ? realClip.steps.map(step => ({ title: step.title, cues: step.cues.map(cue => cue.text) })) : buildCardSequence(levelDetail.data)
          .filter((card) => card.type !== "completion")
          .map((card) => ({
            title: card.title ?? levelDetail.data!.title,
            cues: [card.body, card.tryIt, card.keyAction, card.harderPart, card.hint].filter(
              (text): text is string => Boolean(text),
            ),
          })),
      }
    : null;

  // Preview context uses the existing Coach without changing live lesson resolution.
  const previewClip = __DEV__ && params.preview === "doorway" && !params.skillId && !params.levelId
    ? getTrainingClipLessons("1-1").find(item => item.levelNumber === Number(params.previewLevel))
    : undefined;
  const lesson = realLesson ?? (previewClip ? {
    number: 1,
    chapter: "Rules & Boundaries",
    title: "Wait at the Door",
    steps: previewClip.steps.map(step => ({ title: step.title, cues: step.cues.map(cue => cue.text) })),
  } : {
    number: CURRENT_LESSON.number,
    chapter: CURRENT_LESSON.chapter,
    title: CURRENT_LESSON.title,
    steps: CURRENT_LESSON.script.steps.map((step) => ({ title: step.title, cues: step.cues.map((c) => c.text) })),
  });
  const steps = lesson.steps;
  const stepIndex =
    params.cardIndex !== undefined && !Number.isNaN(Number(params.cardIndex))
      ? Number(params.cardIndex)
      : params.step !== undefined && !Number.isNaN(Number(params.step))
        ? Number(params.step)
        : null;
  const sessionState: CoachBrief["sessionState"] =
    params.state === "finished" ? "finished" : params.state === "live" ? "in progress" : "not started";

  const { days } = useDogRoadmap(dog.data?.id);
  const programme = useMemo(() => {
    const chapters = buildChapters(days);
    const chapter =
      chapters.find((item) => item.steps.some((step) => step.day.id === params.dayId)) ??
      chapters.find((item) => item.nextDay !== null) ??
      null;
    return chapter ? { title: chapter.title, done: chapter.doneCount, total: chapter.steps.length } : null;
  }, [days, params.dayId]);
  const dogName = dog.data?.name?.trim() || null;

  const [chosen, setChosen] = useState<number | null>(null);
  const [turns, setTurnsState] = useState<Turn[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const setTurns = (next: Turn[] | ((current: Turn[]) => Turn[])) => {
    const value = typeof next === "function" ? next(turnsRef.current) : next;
    turnsRef.current = value;
    setTurnsState(value);
  };
  const context = useDogContext();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);

  const focus = chosen ?? stepIndex;

  const brief: CoachBrief = {
    lesson: {
      number: lesson.number,
      chapter: lesson.chapter,
      title: lesson.title,
      steps: steps.map((step) => ({ title: step.title, cues: step.cues })),
    },
    stepIndex,
    struggleStep: chosen,
    sessionState,
    reinforcement: params.reinforcement === "1",
    dog: dogName ? { name: dogName, breed: dog.data?.breed ?? null, ageYears: dog.data?.ageYears ?? null } : null,
    programme,
    profile: context.brief,
  };

  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const sheetHeight = height - insets.top - SHEET_GAP;
  const open = useSharedValue(reduceMotion ? 1 : 0);
  const drag = useSharedValue(0);
  const closing = useRef(false);

  useEffect(() => {
    if (!reduceMotion) open.value = withTiming(1, { duration: 480, easing: motion.easing.drawer });
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardUp(false));
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    const pending = timers.current;
    return () => {
      show.remove();
      hide.remove();
      back.remove();
      pending.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    Keyboard.dismiss();
    void Haptics.selectionAsync();
    if (reduceMotion) {
      router.back();
      return;
    }
    open.value = withTiming(0, { duration: 260, easing: motion.easing.out });
    timers.current.push(setTimeout(() => router.back(), 250));
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          drag.value = g.dy > 0 ? g.dy : g.dy * 0.18;
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > DISMISS_DISTANCE || g.vy > DISMISS_VELOCITY) {
            drag.value = withTiming(sheetHeight, { duration: 220, easing: motion.easing.out });
            close();
          } else {
            drag.value = withSpring(0, { damping: 22, stiffness: 260 });
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheetHeight],
  );

  const scrim = useAnimatedStyle(() => ({ opacity: open.value * (1 - Math.min(1, drag.value / sheetHeight)) }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - open.value) * sheetHeight + drag.value }],
  }));

  const saveConversation = async (context: CoachPracticeContext) => {
    try {
      await recordCoachConversation(context);
      recorded.current = true;
      setNotice(null);
      void queryClient.invalidateQueries({ queryKey: ['trainingRound', context.dogId, context.skillId] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allTrainingSectionRoadmaps(context.dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dogTrainingOverview(context.dogId) });
    } catch {
      setNotice({ text: 'Your reply is here. Saving this practice will retry when you continue.',
        action: { label: 'Retry saving', run: () => { void saveConversation(context); } } });
    }
  };

  const reply = async (history: Turn[]) => {
    setBusy(true);
    setFailure(null);
    // Freeze the lesson context before awaiting a response or leaving the sheet.
    const conversationClip = realClip ?? (params.skillCode ? getTrainingClipLessons(params.skillCode).find(item => item.levelNumber === Number(params.levelNumber)) : null);
    const selectedCue = chosen !== null && chosen >= 0 ? conversationClip?.steps[chosen]?.cues[0]?.at : undefined;
    const at = selectedCue ?? (Number.isFinite(Number(params.reviewAt)) ? Number(params.reviewAt) : 0);
    const practice: CoachPracticeContext | null = params.dogId && params.skillId && params.roundId && params.sessionId && conversationClip && (levelDetail.data || params.skillCode)
      ? { dogId: params.dogId, skillId: params.skillId, roundId: params.roundId, sessionId: params.sessionId,
        question: makeRefresherQuestion(levelDetail.data?.skill.skillCode ?? params.skillCode!, levelDetail.data?.skill.title ?? params.lessonTitle ?? lesson.title, conversationClip, at) } : null;
    const result = await askCoach({ ...brief }, history);
    setBusy(false);
    if (result.state === "ready") {
      void Haptics.selectionAsync();
      setTurns((current) => [...current, { id: nextId(), role: "coach", text: result.text }]);
      if (!recorded.current && practice && isCoachConversation(history, result)) await saveConversation(practice);
    } else {
      setFailure({
        text:
          result.state === "unconfigured"
            ? "Your coach is not available right now. Try again soon."
            : result.state === "offline"
              ? "Could not reach your coach. Check the connection."
              : "Your coach could not answer that one.",
        retry: result.state === "unconfigured" ? undefined : () => void reply(history),
      });
    }
  };

  const choose = (index: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChosen(index);
    setNotice(null);
    setTurns((current) => [
      ...current,
      { id: nextId(), role: "user", text: `Step ${index + 1}, ${steps[index].title}.`, fromChoice: true },
    ]);
    timers.current.push(
      setTimeout(
        () =>
          setTurns((current) => [
            ...current,
            {
              id: nextId(),
              role: "coach",
              text: `What happens when you try it? Tell me what ${dogName ?? "your dog"} does, say it, or show me a photo.`,
            },
          ]),
        reduceMotion ? 0 : 380,
      ),
    );
  };

  const chooseOther = () => {
    void Haptics.selectionAsync();
    setChosen(-1);
    inputRef.current?.focus();
  };

  const send = ({ text: message, image }: { text: string; image?: ChatTurn["image"] }) => {
    if (chosen === null) setChosen(-1);
    setNotice(null);
    const next = [...turnsRef.current, { id: nextId(), role: "user" as const, text: message, image }];
    setTurns(next);
    void reply(next);
  };

  const sendVoice = async (clip: VoiceClip, levels: readonly number[]) => {
    if (chosen === null) setChosen(-1);
    setNotice(null);
    const id = nextId();
    const placeholder: Turn = {
      id,
      role: "user",
      text: "",
      voice: { durationMs: clip.durationMs, levels: sample(levels), transcribing: true },
    };
    setTurns((current) => [...current, placeholder]);

    const heard = await transcribe(clip);
    if (heard.state !== "ready") {
      setTurns((current) => current.filter((turn) => turn.id !== id));
      setNotice({
        text:
          heard.state === "silent"
            ? "Did not catch that. Try again a little closer to the phone."
            : heard.state === "unconfigured"
              ? "Voice is not available right now."
              : "Could not send that voice note. Check the connection.",
      });
      return;
    }

    const history = turnsRef.current.map((turn) =>
      turn.id === id && turn.voice
        ? { ...turn, text: heard.text, voice: { ...turn.voice, transcribing: false } }
        : turn,
    );
    setTurns(history);
    void reply(history);
  };

  const focusLabel =
    focus !== null && focus >= 0 && steps[focus]
      ? `Step ${focus + 1} of ${steps.length}, ${steps[focus].title}`
      : `Lesson ${lesson.number}, ${steps.length} steps`;

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter).easing(motion.easing.out);
  const morph = reduceMotion ? undefined : LinearTransition.duration(440).easing(motion.easing.drawer);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Back to the lesson" />
      </Animated.View>

      <Animated.View style={[styles.sheet, { top: insets.top + SHEET_GAP }, sheet]}>
        <View {...pan.panHandlers} style={styles.head}>
          <View style={styles.grabber} />
          <View style={styles.headRow}>
            <CoachMark breathing={busy} reduceMotion={reduceMotion} size={40} />
            <View style={styles.headCopy}>
              <Text style={styles.title}>Coach</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {lesson.title}
              </Text>
            </View>
            <PressScale accessibilityRole="button" accessibilityLabel="Close coach" scaleTo={0.9} style={styles.close} onPress={close}>
              <XIcon size={iconSize.standard} color={text.primary} weight="bold" />
            </PressScale>
          </View>
          <StepRail count={steps.length} active={focus !== null && focus >= 0 ? focus : null} label={focusLabel} reduceMotion={reduceMotion} />
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + SHEET_GAP}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: !reduceMotion })}
            showsVerticalScrollIndicator={false}
          >
            <Animated.Text
              entering={reduceMotion ? undefined : FadeIn.duration(360).delay(220).easing(motion.easing.out).withInitialValues({ transform: [{ translateY: 12 }] })}
              style={styles.question}
            >
              Which part is {dogName ?? "your dog"} finding hard?
            </Animated.Text>

            {steps.map((step, index) => {
              if (chosen !== null && chosen !== index) return null;
              const picked = chosen === index;
              const here = index === stepIndex;
              return (
                <Animated.View
                  key={`choice-${index}`}
                  layout={morph}
                  entering={reduceMotion ? undefined : FadeIn.duration(300).delay(300 + index * 55).easing(motion.easing.out).withInitialValues({ transform: [{ translateY: 10 }] })}
                  exiting={reduceMotion ? undefined : FadeOut.duration(100)}
                  style={picked ? styles.pickedWrap : undefined}
                >
                  {picked ? (
                    <View style={styles.picked}>
                      <Text style={styles.pickedText}>
                        Step {index + 1}, {step.title}.
                      </Text>
                    </View>
                  ) : (
                    <PressScale
                      accessibilityRole="button"
                      accessibilityLabel={`Step ${index + 1}, ${step.title}${here ? ", where the video is" : ""}`}
                      scaleTo={0.98}
                      style={[styles.choice, index === 0 && styles.choiceFirst]}
                      onPress={() => choose(index)}
                    >
                      <Text style={styles.choiceNumber}>{index + 1}</Text>
                      <View style={styles.choiceCopy}>
                        <Text style={styles.choiceTitle}>{step.title}</Text>
                        {here ? <Text style={styles.choiceHere}>Where the video is</Text> : null}
                      </View>
                      <ArrowRightIcon size={iconSize.inline} color={text.tertiary} weight="bold" />
                    </PressScale>
                  )}
                </Animated.View>
              );
            })}

            {chosen === null ? (
              <Animated.View
                key="choice-other"
                entering={reduceMotion ? undefined : FadeIn.duration(300).delay(300 + steps.length * 55)}
                exiting={reduceMotion ? undefined : FadeOut.duration(140)}
              >
                <PressScale accessibilityRole="button" accessibilityLabel="Something else" scaleTo={0.98} style={styles.choice} onPress={chooseOther}>
                  <View style={styles.choiceCopy}>
                    <Text style={[styles.choiceTitle, styles.choiceOther]}>Something else</Text>
                  </View>
                  <ArrowRightIcon size={iconSize.inline} color={text.tertiary} weight="bold" />
                </PressScale>
                <Text style={styles.privacy}>
                  Photos and voice notes go to Google Gemini to answer. PAWS keeps neither.
                </Text>
              </Animated.View>
            ) : null}

            {turns.map((turn) =>
              turn.fromChoice ? null : (
                <Animated.View key={turn.id} layout={settle} style={styles.turn}>
                  {turn.role === "coach" ? (
                    <CoachReply value={turn.text} animate reduceMotion={reduceMotion} />
                  ) : (
                    <UserBubble
                      turn={{ text: turn.text, imageUri: turn.image?.uri, voice: turn.voice }}
                      animate
                      reduceMotion={reduceMotion}
                    />
                  )}
                </Animated.View>
              ),
            )}

            {busy ? (
              <Animated.View layout={settle} style={styles.turn}>
                <CoachThinking
                  label={focus !== null && focus >= 0 ? `Reading step ${focus + 1}` : "Reading the lesson"}
                  reduceMotion={reduceMotion}
                />
              </Animated.View>
            ) : null}

            {failure || notice ? (
              <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} layout={settle} style={styles.note}>
                <Text style={styles.noteText}>{failure?.text ?? notice?.text}</Text>
                {(failure?.retry || notice?.action) ? (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={failure?.retry ? "Try again" : notice?.action?.label}
                    scaleTo={0.96}
                    style={styles.noteAction}
                    onPress={() => (failure?.retry ? failure.retry() : notice?.action?.run())}
                  >
                    <Text style={styles.noteActionText}>{failure?.retry ? "Try again" : notice?.action?.label}</Text>
                  </PressScale>
                ) : null}
              </Animated.View>
            ) : null}
          </ScrollView>

          <CoachComposer
            placeholder={dogName ? `What is ${dogName} doing?` : "What is happening?"}
            busy={busy}
            reduceMotion={reduceMotion}
            bottomInset={keyboardUp ? 0 : insets.bottom}
            inputRef={inputRef}
            onSend={send}
            onVoice={(clip, levels) => void sendVoice(clip, levels)}
            onNotice={(message, action) => setNotice(message ? { text: message, action } : null)}
          />
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(28,27,26,0.42)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: "hidden",
  },

  head: { paddingHorizontal: space.xl, paddingBottom: space.lg, backgroundColor: bg.canvas },
  grabber: {
    alignSelf: "center",
    width: 38,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: border.default,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg },
  headCopy: { flex: 1 },
  title: { ...type.sectionTitle, color: text.primary },
  subtitle: { ...type.caption, color: text.secondary, marginTop: 1 },
  close: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },

  thread: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xxl },

  question: {
    ...type.pageTitle,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: text.primary,
    marginBottom: space.xl,
  },

  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: border.soft,
  },
  choiceFirst: { borderTopWidth: 1, borderTopColor: border.soft },
  choiceNumber: {
    ...type.sectionTitle,
    width: 22,
    color: accent.band,
    fontVariant: ["tabular-nums"],
  },
  choiceCopy: { flex: 1 },
  choiceTitle: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary },
  choiceHere: { ...type.caption, color: accent.band, fontWeight: "600", marginTop: 2 },
  choiceOther: { color: text.secondary },
  privacy: { ...type.caption, color: text.tertiary, marginTop: space.lg, lineHeight: 17 },

  pickedWrap: { alignItems: "flex-end" },
  picked: {
    backgroundColor: accent.deep,
    borderRadius: 24,
    borderBottomRightRadius: 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    maxWidth: "82%",
  },
  pickedText: { ...type.body, fontSize: 16.5, lineHeight: 23, color: text.primary },

  turn: { marginTop: space.xl },

  note: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  noteText: { ...type.supporting, color: text.secondary, flexShrink: 1 },
  noteAction: {
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    justifyContent: "center",
  },
  noteActionText: { ...type.caption, fontWeight: "600", color: text.primary },
});
