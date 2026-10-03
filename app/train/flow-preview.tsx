import { useEffect, useState } from "react";
import { BackHandler, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { ArrowLeftIcon, ArrowRightIcon, LightningIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { LessonHero } from "@/features/train/components/LessonHero";
import { LessonPreparation } from "@/features/train/components/LessonPreparation";
import { UnlockedLessonVideos } from "@/features/train/components/UnlockedLessonVideos";
import { TrainingFlowButton } from "@/features/train/components/flow/TrainingFlowScreen";
import { TrainingReviewQuiz, type TrainingReviewQuestion } from "@/features/train/components/flow/TrainingReviewQuiz";
import { TrainingRoundComplete } from "@/features/train/components/flow/TrainingRoundComplete";
import { TrainingPracticePreview } from "@/features/train/components/flow/TrainingPracticePreview";
import { PREVIEW_LESSON, PREVIEW_QUESTIONS } from "@/features/train/components/flow/previewData";
import { getTrainingClipAssets } from "@/features/train/media/trainingClipAssets";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

type Screen = "gallery" | "prepare" | "quiz" | "practice" | "sessionComplete" | "lessonComplete" | "library";
const SCREENS: readonly Screen[] = ["gallery", "prepare", "quiz", "practice", "sessionComplete", "lessonComplete", "library"];

// This route is intentionally separate from the live roadmap. No Energy,
// progress, quiz responses, or help selections leave this local preview.
export default function TrainingFlowPreviewRoute() {
  if (!__DEV__) return <Redirect href="/(tabs)/train" />;
  return <><Stack.Screen options={{ headerShown: false }} /><View style={styles.device}><TrainingFlowPreview /></View></>;
}

function TrainingFlowPreview() {
  const params = useLocalSearchParams<{ screen?: string }>();
  const initial = SCREENS.includes(params.screen as Screen) ? params.screen as Screen : "gallery";
  const [screen, setScreen] = useState<Screen>(initial);
  const [round, setRound] = useState<1 | 2>(1);
  const [level, setLevel] = useState(1);
  const [struggles, setStruggles] = useState<string[]>([]);
  const [questions, setQuestions] = useState<readonly TrainingReviewQuestion[]>(PREVIEW_QUESTIONS.slice(0, 2));
  const [reviewClip, setReviewClip] = useState<TrainingReviewQuestion | null>(null);
  const [run, setRun] = useState(0);
  const [finishedFirst, setFinishedFirst] = useState(false);
  const gallery = () => setScreen("gallery");

  useEffect(() => {
    if (screen === "gallery") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { setScreen("gallery"); return true; });
    return () => subscription.remove();
  }, [screen]);

  const prepare = (nextRound: 1 | 2, sample = false) => {
    setRound(nextRound);
    setLevel(nextRound === 1 ? 1 : 3);
    const priority = sample ? [PREVIEW_QUESTIONS[1]] : PREVIEW_QUESTIONS.filter(item => struggles.includes(item.id) || struggles.includes(`level-${item.level}`));
    setQuestions(nextRound === 1 ? [] : [...priority, ...PREVIEW_QUESTIONS.filter(item => !priority.includes(item))].slice(0, 2));
    if (nextRound === 1) { setStruggles([]); setFinishedFirst(false); }
    setRun(previous => previous + 1);
    setScreen("prepare");
  };
  const continuePractice = () => {
    if (round === 1 && level === 3) { setFinishedFirst(true); setScreen("sessionComplete"); }
    else if (level === 5) setScreen("lessonComplete");
    else setLevel(previous => previous + 1);
  };
  let content;
  switch (screen) {
    case "prepare": content = <PreparationPreview round={round} onClose={gallery} onStart={() => setScreen(questions.length ? "quiz" : "practice")} />; break;
    case "quiz": content = <TrainingReviewQuiz key={run} questions={questions} onClose={gallery} onWatch={setReviewClip} onComplete={() => { setLevel(round === 1 ? 1 : 3); setScreen("practice"); }} />; break;
    case "practice": content = <TrainingPracticePreview key={`${run}-${level}`} level={level} onClose={gallery} onContinue={continuePractice} onStruggle={concept => setStruggles(previous => previous.includes(concept) ? previous : [...previous, concept])} />; break;
    case "sessionComplete": content = <TrainingRoundComplete lessonTitle={PREVIEW_LESSON.title} onClose={gallery} />; break;
    case "lessonComplete": content = <TrainingRoundComplete lessonTitle={PREVIEW_LESSON.title} lessonComplete onClose={gallery} onViewVideos={() => setScreen("library")} />; break;
    case "library": content = <UnlockedLessonVideos skillCode={PREVIEW_LESSON.code} title={PREVIEW_LESSON.title} onClose={gallery} />; break;
    default: content = <SafeAreaView style={styles.screen}>
      <View style={styles.galleryHeader}><PressScale accessibilityRole="button" accessibilityLabel="Back to Train" onPress={() => router.replace("/(tabs)/train")} style={styles.back}><ArrowLeftIcon size={24} color={text.primary} /></PressScale><Text style={styles.eyebrow}>DESIGN PREVIEW</Text></View>
      <ScrollView contentContainerStyle={styles.gallery}>
        <Text accessibilityRole="header" style={styles.title}>Your training, one session at a time.</Text>
        <Text style={styles.copy}>Wait at the Door · Screen previews only. Energy and training progress stay unchanged.</Text>
        <View style={styles.demoCard}><Text style={styles.cardTitle}>Walk through the flow</Text><Text style={styles.copy}>Preparation → practice → a little celebration. Help opens your existing Coach.</Text><TrainingFlowButton label="Start first session" onPress={() => prepare(1)} />
          {finishedFirst ? <TrainingFlowButton label="Continue to next session" secondary onPress={() => prepare(2)} /> : null}
          <TrainingFlowButton label="Preview returning session" secondary onPress={() => prepare(2, true)} />
        </View>
        <Text style={styles.cardTitle}>Explore each screen</Text>
        {([
          ["quiz", "Review quiz", "Two questions · selection & feedback"],
          ["practice", "Practice & help", "Existing player & Coach"],
          ["sessionComplete", "Session complete", "A little celebration together"],
          ["lessonComplete", "Lesson complete", "Celebrate & unlock your videos"],
          ["library", "Your lesson videos", "Choose a moment to rewatch"],
        ] as const).map(([target, title, description]) => <PressScale key={target} accessibilityRole="button" accessibilityLabel={title} onPress={() => {
          if (target === "quiz") { setRound(2); setQuestions(PREVIEW_QUESTIONS.slice(0, 2)); setRun(previous => previous + 1); }
          if (target === "practice") { setRound(1); setLevel(2); }
          setScreen(target);
        }} style={styles.screenRow}><View style={styles.flex}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.smallCopy}>{description}</Text></View><ArrowRightIcon size={22} color={text.secondary} /></PressScale>)}
      </ScrollView>
    </SafeAreaView>;
  }

  return <View style={styles.screen}>{content}
    <Modal visible={reviewClip !== null} animationType="slide" onRequestClose={() => setReviewClip(null)}>
      {reviewClip ? <View style={styles.device}><TrainingPracticePreview key={reviewClip.id} level={reviewClip.level} reviewAt={reviewClip.cueAt} onContinue={() => setReviewClip(null)} onClose={() => setReviewClip(null)} /></View> : null}
    </Modal>
  </View>;
}

function PreparationPreview({ round, onStart, onClose }: { round: 1 | 2; onStart: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const collapse = useSharedValue(0);
  return <View style={styles.screen}>
    <ScrollView>
      <View style={{ height: Math.max(280, height * 0.4) }}><LessonHero title={PREVIEW_LESSON.title} chapter="Introduction" lessonNumber={1} poster={getTrainingClipAssets(PREVIEW_LESSON.code, 1)?.poster} collapse={collapse} topInset={insets.top} onBack={onClose} /></View>
      <View style={styles.preparation}>
        <LessonPreparation skillCode={PREVIEW_LESSON.code} purpose="Build a calm waiting habit at the door, one small step at a time." materials={[{ label: "Small treats", detail: "Easy to give on the waiting spot" }, { label: "A mat and a secure door", detail: "Keep the area quiet and use a leash when needed" }]} />
        <View style={styles.sessionNote}><Text style={styles.cardTitle}>This session</Text><Text style={styles.copy}>{round === 1 ? "Find the waiting spot and practise waiting as the door opens." : "Revisit the door opening, then practise leaving together."}</Text></View>
      </View>
    </ScrollView>
    <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.energy}><LightningIcon size={17} color={accent.band} weight="fill" /><Text style={styles.smallCopy}>1 Energy</Text></View>
      <TrainingFlowButton label="Start training" onPress={onStart} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  device: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center" },
  screen: { flex: 1, backgroundColor: bg.canvas },
  flex: { flex: 1 },
  galleryHeader: { paddingHorizontal: layout.gutter - space.sm, flexDirection: "row", alignItems: "center", gap: space.md },
  back: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  gallery: { padding: layout.gutter, gap: space.lg, paddingBottom: space.sectionLg },
  title: { ...type.pageTitle, color: text.primary },
  eyebrow: { ...type.eyebrow, color: text.secondary },
  copy: { ...type.body, color: text.secondary },
  smallCopy: { ...type.supporting, color: text.secondary },
  cardTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  demoCard: { backgroundColor: accent.soft, borderRadius: radius.card, padding: space.lg, gap: space.md },
  screenRow: { flexDirection: "row", gap: space.md, alignItems: "center", borderWidth: 1, borderColor: border.soft, borderRadius: radius.card, padding: space.lg },
  preparation: { marginTop: -space.xl, padding: layout.gutter, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.canvas, gap: space.xl },
  sessionNote: { padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft, gap: space.xs },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md, borderTopWidth: 1, borderTopColor: border.soft, gap: space.sm },
  energy: { flexDirection: "row", gap: space.xs, alignItems: "center", justifyContent: "center" },
});
