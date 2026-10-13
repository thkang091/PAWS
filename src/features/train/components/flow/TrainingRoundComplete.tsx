import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { LessonConfetti } from "./LessonConfetti";
import { TrainingFlowButton, TrainingFlowScreen } from "./TrainingFlowScreen";
import { accent, radius, space, text, type } from "@/constants/design";

export function TrainingRoundComplete({ lessonTitle, lessonComplete = false, needsReinforcement = false, onClose, onViewVideos, busy = false, error }: {
  lessonTitle: string;
  lessonComplete?: boolean;
  needsReinforcement?: boolean;
  onClose: () => void;
  onViewVideos?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const reduceMotion = useReducedMotion();

  return <View style={styles.screen}><TrainingFlowScreen label={lessonTitle} centered onClose={onClose} footer={<>
    <TrainingFlowButton label={busy ? "Saving…" : "Continue"} disabled={busy} onPress={onClose} />
    {lessonComplete && onViewVideos ? <TrainingFlowButton label="Rewatch lesson" disabled={busy} onPress={onViewVideos} secondary /> : null}
  </>}>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)} style={styles.celebration}>
      <Text accessibilityRole="header" style={styles.title}>{lessonComplete ? "You did it!" : "Nice work,\nboth of you!"}</Text>
      <Text style={styles.copy}>{lessonComplete ? "You've finished this lesson together." : needsReinforcement ? "A good moment to PAWSE.\nWe'll revisit the tricky parts next time." : "A good moment to PAWSE.\nWe'll pick up here next time."}</Text>
      {lessonComplete ? <View style={styles.unlocked}>
        <View style={styles.unlockCopy}><Text style={styles.unlockTitle}>All lesson videos unlocked</Text><Text style={styles.unlockDetail}>Rewatch whenever you need.</Text></View>
      </View> : null}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </Animated.View>
  </TrainingFlowScreen>{lessonComplete ? <LessonConfetti /> : null}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  celebration: { alignItems: "center", gap: space.lg, paddingVertical: space.md },
  error: { ...type.supporting, color: "#B3261E" },
  title: { ...type.pageTitle, color: text.primary, textAlign: "center" },
  copy: { ...type.body, color: text.secondary, textAlign: "center", maxWidth: 290 },
  unlocked: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: accent.soft, borderRadius: radius.card, padding: space.lg, marginTop: space.md, alignSelf: "stretch" },
  unlockCopy: { flex: 1, gap: space.xs },
  unlockTitle: { ...type.supporting, fontWeight: "600", color: text.primary },
  unlockDetail: { ...type.supporting, color: text.secondary },
});
