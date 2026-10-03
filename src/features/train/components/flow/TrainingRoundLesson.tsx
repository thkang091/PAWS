import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LessonHero } from "../LessonHero";
import { LessonPreparation } from "../LessonPreparation";
import { UnlockedLessonVideos } from "../UnlockedLessonVideos";
import { TrainingReviewQuiz } from "./TrainingReviewQuiz";
import { TrainingPracticeClip } from "./TrainingPracticeClip";
import { TrainingRoundComplete } from "./TrainingRoundComplete";
import { TrainingFlowButton } from "./TrainingFlowScreen";
import { getAllSectionRoadmaps, getTrainingLevelDetail, getTrainingPreparation } from "@/services/trainingCurriculumService";
import { newRoundKey, trainingRoundAction, type RoundAction, type RoundQuestion, type TrainingRoundContext } from "@/services/trainingRoundService";
import { makeRefresherQuestion } from "../../rounds/refresherQuestion";
import { getTrainingClipLessons } from "../../media/trainingClipLessons";
import { getTrainingClipAssets } from "../../media/trainingClipAssets";
import { prepareTrainingClip } from "../../media/prepareTrainingClip";
import { queryKeys } from "@/constants/queryKeys";
import { getErrorMessage } from "@/lib/errors";
import { bg, border, layout, radius, space, text, type } from "@/constants/design";

export function TrainingRoundLesson({ dogId, skillId, initial }: { dogId: string; skillId: string; initial: TrainingRoundContext }) {
  const [context, setContext] = useState(initial);
  const [preparing, setPreparing] = useState(true);
  const [library, setLibrary] = useState(false);
  const [watch, setWatch] = useState<RoundQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const startKey = useRef(newRoundKey());
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const collapse = useSharedValue(0);
  const paid = Boolean(context.round || context.canResume);
  const needsProgress = preparing && !paid && !context.unlocked;
  const lessonStarted = useQuery({
    queryKey: queryKeys.allTrainingSectionRoadmaps(dogId),
    queryFn: () => getAllSectionRoadmaps(dogId),
    enabled: needsProgress,
    select: roadmaps => roadmaps.some(section => section.nodes.some(node =>
      node.skill.id === skillId && node.progress != null && node.progress.status !== "not_started")),
  });
  const level = useQuery({ queryKey: queryKeys.trainingLessonLevel(context.levelId), queryFn: () => getTrainingLevelDetail(context.levelId) });
  const preparation = useQuery({ queryKey: ["trainingPreparation", skillId], queryFn: () => getTrainingPreparation(skillId) });
  const skill = level.data?.skill;
  const code = skill?.skillCode ?? "";
  const clips = getTrainingClipLessons(code);
  const clip = clips.find(item => item.levelNumber === level.data?.levelNumber);
  const source = getTrainingClipAssets(code, clip?.levelNumber)?.source;
  // Download during preparation/quiz. The existing player also handles loading
  // and retry, so slow media never advances or consumes an extra round.
  useEffect(() => { if (source) void prepareTrainingClip(source).catch(() => {}); }, [source]);

  const invalidate = () => {
    for (const key of [queryKeys.allTrainingSectionRoadmaps(dogId), queryKeys.dogTrainingOverview(dogId), queryKeys.skillSessionResolution(dogId,skillId), queryKeys.activeTrainingSession(dogId,skillId), queryKeys.trainingEnergy(dogId,new Date().toDateString()), ["trainingRound",dogId,skillId]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
  const act = async (action: RoundAction, extra: Record<string,unknown> = {}) => {
    if (pending.current) return null;
    pending.current=true; setBusy(true); setError(null);
    try {
      const updated = await trainingRoundAction(dogId,skillId,action, {
        roundId: context.round?.id, sessionId: context.session?.id, ...extra,
      });
      setContext(updated);
      invalidate();
      return updated;
    } catch (e) {
      const message = getErrorMessage(e,"Couldn't save this step. Please try again.");
      setError(message === "insufficient_training_energy" ? "No Energy left. Refill from the Train tab, then try again." : message);
      return null;
    }
    finally { pending.current=false; setBusy(false); }
  };
  // Closing pauses by leaving the active round on the server. No mutation is
  // needed, so a network loss cannot turn Pause into End or lose paid progress.
  const close = () => { invalidate(); router.back(); };
  const acknowledge = async (showVideos = false) => {
    const done = context.round?.status === "completed" && !context.round.acknowledged_at;
    if (done && !await act("ack")) return;
    if (showVideos) { setPreparing(false); setLibrary(true); } else close();
  };
  const start = async () => {
    if (context.unlocked) { await acknowledge(true); return; }
    const result = await act("start", { key: startKey.current });
    if (result) setPreparing(false);
  };

  if (level.isLoading || preparation.isLoading || (needsProgress && lessonStarted.isLoading)) return <SafeAreaView style={styles.screen}><LoadingState message="Preparing lesson…" /></SafeAreaView>;
  if (level.isError || preparation.isError || (needsProgress && lessonStarted.isError && lessonStarted.data === undefined) || !skill || !clip) return <SafeAreaView style={styles.screen}><ErrorState message="Couldn't prepare this lesson." onRetry={() => { void level.refetch(); void preparation.refetch(); if (needsProgress) void lessonStarted.refetch(); }} /><TrainingFlowButton label="Back to roadmap" onPress={close} /></SafeAreaView>;

  if (library) return <UnlockedLessonVideos skillCode={code} title={skill.title} onClose={close} />;
  if (watch) return <TrainingPracticeClip key={watch.id} skillCode={watch.skillCode} title={watch.lessonTitle} level={watch.level} reviewAt={watch.cueAt} onContinue={() => setWatch(null)} onClose={() => setWatch(null)} />;
  if (!preparing && context.round?.phase === "quiz") return <TrainingReviewQuiz
    questions={context.round.review_items.map(item => item.question)}
    saved={{ index: context.round.quiz_cursor, answers: context.round.answers }} busy={busy} error={error}
    onAnswer={answer => { void act("answer",answer); }}
    onAdvance={() => { void act("advance_quiz", { cursor: context.round!.quiz_cursor }); }}
    onComplete={() => {}} onClose={close} onWatch={question => setWatch(question as RoundQuestion)} />;
  if (!preparing && context.round?.status === "completed") return <TrainingRoundComplete lessonTitle={skill.title} lessonComplete={context.unlocked}
    busy={busy} error={error} onClose={() => { void acknowledge(); }} onViewVideos={() => { void acknowledge(true); }} />;
  if (!preparing && context.session) return <TrainingPracticeClip key={context.session.id} skillCode={code} title={skill.title} level={clip.levelNumber}
    sessionId={context.session.id} busy={busy} error={error} onClose={close}
    onContinue={() => { void act("continue"); }}
    onHelp={(at, step) => {
      const question = makeRefresherQuestion(code,skill.title,clip,at);
      void act("help", { question }).then(result => {
        if (result) router.push({ pathname:"/train/help", params:{ skillId, levelId: context.levelId, step: String(step), clip: "1", state:"live" } });
      });
    }} />;

  const unavailable = !context.unlocked && !paid && context.energy.remaining === 0;
  const sessionLabel = paid || lessonStarted.data ? "Continue session" : "Start session";
  const startLabel = paid ? sessionLabel : `${sessionLabel} · 1 Energy`;
  return <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.preparation}>
      <View style={{ height: Math.round(height*0.45) }}>
        <LessonHero title={skill.title} collapse={collapse} topInset={insets.top} showChrome={false}
          poster={getTrainingClipAssets(code,1)?.poster} />
      </View>
      <View style={styles.sheet}>
        <LessonPreparation skillCode={code} purpose={skill.oneLineGoal} materials={preparation.data?.materials ?? []} />
        {unavailable ? <Text style={styles.note}>Refill Energy from the Train tab to start a new session.</Text> : null}
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      </View>
    </ScrollView>
    <PressScale accessibilityRole="button" accessibilityLabel="Close" style={[styles.close,{top:insets.top+space.sm}]} onPress={close}><XIcon size={24} color={text.inverse} /></PressScale>
    <View style={[styles.footer,{paddingBottom:insets.bottom+space.lg}]}>
      <TrainingFlowButton label={busy ? "Preparing…" : context.unlocked ? "Watch lesson videos" : unavailable ? "No Energy left today" : startLabel} disabled={busy || unavailable} onPress={() => { void start(); }} />
      {context.round?.status === "active" ? <TrainingFlowButton label="End this session" secondary disabled={busy} onPress={() => { void act("end").then(result => { if (result) close(); }); }} /> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex:1,backgroundColor:bg.canvas },
  preparation: { flexGrow:1 },
  sheet: { padding:layout.gutter,gap:space.lg,marginTop:-space.xl,borderTopLeftRadius:radius.sheet,borderTopRightRadius:radius.sheet,backgroundColor:bg.canvas },
  close: { position:"absolute",left:layout.gutter,width:44,height:44,borderRadius:radius.pill,backgroundColor:"rgba(28,27,26,0.5)",alignItems:"center",justifyContent:"center" },
  footer: { padding:layout.gutter,gap:space.sm,borderTopWidth:1,borderTopColor:border.soft },
  error: { ...type.supporting,color:"#B3261E" },
  note: { ...type.supporting,color:text.secondary },
});
