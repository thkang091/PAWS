import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { LockOpenIcon } from "phosphor-react-native";
import { CelebratingPawsDog } from "./CelebratingPawsDog";
import { TrainingFlowButton, TrainingFlowScreen } from "./TrainingFlowScreen";
import { accent, radius, space, text, type } from "@/constants/design";

export function TrainingRoundComplete({ lessonTitle, lessonComplete = false, onClose, onViewVideos }: {
  lessonTitle: string;
  lessonComplete?: boolean;
  onClose: () => void;
  onViewVideos?: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return <TrainingFlowScreen label={lessonTitle} centered onClose={onClose} footer={<>
    <TrainingFlowButton label="Continue" onPress={onClose} />
    {lessonComplete && onViewVideos ? <TrainingFlowButton label="Rewatch lesson" onPress={onViewVideos} secondary /> : null}
  </>}>
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)} style={styles.celebration}>
      <CelebratingPawsDog />
      <Text accessibilityRole="header" style={styles.title}>{lessonComplete ? "You did it!" : "Nice work,\nboth of you!"}</Text>
      <Text style={styles.copy}>{lessonComplete ? "You've finished this lesson together." : "A good moment to pause.\nWe'll pick up here next time."}</Text>
      {lessonComplete ? <View style={styles.unlocked}>
        <LockOpenIcon size={22} color={text.primary} />
        <View style={styles.unlockCopy}><Text style={styles.unlockTitle}>All lesson videos unlocked</Text><Text style={styles.unlockDetail}>Rewatch whenever you need.</Text></View>
      </View> : null}
    </Animated.View>
  </TrainingFlowScreen>;
}

const styles = StyleSheet.create({
  celebration: { alignItems: "center", gap: space.lg, paddingVertical: space.md },
  title: { ...type.pageTitle, color: text.primary, textAlign: "center" },
  copy: { ...type.body, color: text.secondary, textAlign: "center", maxWidth: 290 },
  unlocked: { flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: accent.soft, borderRadius: radius.card, padding: space.lg, marginTop: space.md, alignSelf: "stretch" },
  unlockCopy: { flex: 1, gap: space.xs },
  unlockTitle: { ...type.supporting, fontWeight: "600", color: text.primary },
  unlockDetail: { ...type.supporting, color: text.secondary },
});
