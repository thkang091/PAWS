import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowCounterClockwiseIcon, QuestionIcon, XIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { TrainingClipGuide, TrainingClipTimeline } from "../TrainingClipGuide";
import { TrainingClipVideo } from "../TrainingClipVideo";
import { getTrainingClipAssets } from "@/features/train/media/trainingClipAssets";
import { getTrainingClipLessons } from "@/features/train/media/trainingClipLessons";
import { useTrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";
import { TrainingFlowButton } from "./TrainingFlowScreen";
import { PREVIEW_LESSON } from "./previewData";
import { bg, border, layout, radius, space, text, type } from "@/constants/design";

/** Reuses the production player without starting or reporting a training session. */
export function TrainingPracticePreview({ level, onContinue, onClose, onStruggle, reviewAt }: {
  level: number; onContinue: () => void; onClose: () => void;
  onStruggle?: (concept: string) => void; reviewAt?: number;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const lesson = getTrainingClipLessons(PREVIEW_LESSON.code).find(item => item.levelNumber === level)!;
  const assets = getTrainingClipAssets(PREVIEW_LESSON.code, level)!;
  const playback = useTrainingClipPlayback(lesson, assets.source, true);
  const sought = useRef(false);
  useEffect(() => {
    if (reviewAt !== undefined && !playback.loading && !sought.current) {
      sought.current = true;
      playback.seek(reviewAt);
    }
  }, [reviewAt, playback.loading, playback.seek]);
  const leave = (action: () => void) => { playback.pause(); action(); };
  const openCoach = () => {
    playback.pause();
    onStruggle?.(`level-${level}`);
    router.push({ pathname: "/train/help", params: {
      preview: "doorway", previewLevel: String(level),
      step: String(playback.currentCue?.stepIndex ?? 0), state: "live",
    } });
  };
  return <View style={styles.screen}>
    <View style={[styles.stage, { height: Math.round(height * 0.4) }]}>
      <TrainingClipVideo playback={playback} poster={assets.poster} />
      <PressScale accessibilityRole="button" accessibilityLabel="Close video" onPress={() => leave(onClose)} style={[styles.close, { top: insets.top + space.sm }]}><XIcon size={24} color={text.inverse} /></PressScale>
    </View>
    <View style={styles.sheet}>
      <Text style={styles.eyebrow}>{PREVIEW_LESSON.title}</Text>
      <Text style={styles.title}>{lesson.steps[0].title}</Text>
      <TrainingClipGuide lesson={lesson} playback={playback} />
    </View>
    <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
      <TrainingClipTimeline lesson={lesson} playback={playback} />
      <View style={styles.controls}>
        <PressScale accessibilityRole="button" accessibilityLabel="Watch again" style={styles.round} onPress={playback.playWhole}><ArrowCounterClockwiseIcon size={24} color={text.primary} /></PressScale>
        <View style={styles.flex}><TrainingFlowButton label={reviewAt !== undefined ? "Back to question" : "Continue"} disabled={reviewAt === undefined && !playback.hasCompleted} onPress={() => leave(onContinue)} /></View>
        {onStruggle ? <PressScale accessibilityRole="button" accessibilityLabel="I need help" style={styles.round} onPress={openCoach}><QuestionIcon size={24} color={text.secondary} /></PressScale> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  stage: { backgroundColor: "#141414" },
  close: { position: "absolute", left: layout.gutter, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(28,27,26,0.55)", alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, minHeight: 0, paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.sm, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.canvas, marginTop: -space.sm },
  eyebrow: { ...type.eyebrow, color: text.tertiary },
  title: { ...type.sectionTitle, color: text.primary },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: border.soft },
  controls: { flexDirection: "row", gap: space.md, alignItems: "center" },
  round: { width: layout.controlHeight, height: layout.controlHeight, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
});
