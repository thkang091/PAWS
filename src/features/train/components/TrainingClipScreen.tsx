import type { ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowCounterClockwiseIcon, QuestionIcon, XIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { bg, border, layout, radius, space, text, type } from "@/constants/design";
import type { TrainingClipLesson } from "../media/doorwayWaitLesson";
import type { TrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";
import { TrainingClipGuide, TrainingClipTimeline } from "./TrainingClipGuide";
import { TrainingFlowButton } from "./flow/TrainingFlowScreen";

export type LessonProgressSlot = ReactNode | ((playbackProgress: number) => ReactNode);

export function TrainingClipScreen({ title, lesson, playback, video, minimumVideoHeight, videoActions, sourceLink, navigation, lessonProgress,
  onClose, onContinue, onReplay, onHelp, continueLabel = "Continue", continueDisabled = false, replayDisabled = false,
  busy = false, error }: {
  title: string; lesson: TrainingClipLesson;
  playback: Pick<TrainingClipPlayback, "time" | "currentCue" | "error" | "seek" | "retry">;
  video: ReactNode; minimumVideoHeight?: number; videoActions?: ReactNode; sourceLink?: ReactNode; navigation?: ReactNode; lessonProgress?: LessonProgressSlot;
  onClose: () => void; onContinue: () => void; onReplay: () => void; onHelp?: () => void;
  continueLabel?: string; continueDisabled?: boolean; replayDisabled?: boolean; busy?: boolean; error?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return <View style={styles.screen}>
    {navigation}
    <View style={[styles.stage, { height: Math.max(minimumVideoHeight ?? 0, Math.round(height * 0.4)) }]}>
      {video}
      <PressScale accessibilityRole="button" accessibilityLabel="Close video" onPress={onClose}
        style={[styles.close, { position: "absolute", top: insets.top + space.sm, left: layout.gutter }]}><XIcon size={24} color={text.inverse} /></PressScale>
      {videoActions ? <View style={{ position: "absolute", top: insets.top + space.sm, right: layout.gutter }}>{videoActions}</View> : null}
    </View>
    <View style={styles.sheet}>
      {sourceLink}
      <Text style={styles.eyebrow}>{title}</Text>
      <Text style={styles.title}>{lesson.steps[0].title}</Text>
      <TrainingClipGuide lesson={lesson} playback={playback} />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </View>
    <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
      {typeof lessonProgress === 'function'
        ? lessonProgress(lesson.duration > 0 ? Math.max(0, Math.min(1, playback.time / lesson.duration)) : 0)
        : lessonProgress ?? <TrainingClipTimeline lesson={lesson} playback={playback} />}
      <View style={styles.controls}>
        <PressScale accessibilityRole="button" accessibilityLabel="Watch again" disabled={replayDisabled} style={styles.round} onPress={onReplay}><ArrowCounterClockwiseIcon size={24} color={text.primary} /></PressScale>
        <View style={styles.flex}><TrainingFlowButton label={busy ? "Saving…" : continueLabel} disabled={busy || continueDisabled} onPress={onContinue} /></View>
        {onHelp ? <PressScale accessibilityRole="button" accessibilityLabel="I need help" disabled={busy} style={styles.round} onPress={onHelp}><QuestionIcon size={24} color={text.secondary} /></PressScale> : null}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  stage: { backgroundColor: "#141414" },
  close: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: "rgba(28,27,26,0.55)", alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, minHeight: 0, paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.sm, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.canvas, marginTop: -space.sm },
  eyebrow: { ...type.eyebrow, color: text.tertiary },
  title: { ...type.sectionTitle, color: text.primary },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: border.soft },
  controls: { flexDirection: "row", gap: space.md, alignItems: "center" },
  round: { width: layout.controlHeight, height: layout.controlHeight, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  error: { ...type.supporting, color: "#B3261E" },
});
