import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";

import { Reveal } from "@/features/onboarding/components/Reveal";
import { TrainCompanion } from "@/features/train/components/TrainCompanion";
import type { TrainingTopic } from "@/constants/trainingTopics";
import { accent, border, motion, pastel, radius, space, text, type } from "@/constants/design";

const SHOWN = 4;

export const TopicPreview = ({ topic }: { topic: TrainingTopic }) => {
  const reduceMotion = useReducedMotion();
  const minutes = Math.round(topic.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0) / topic.lessons.length);

  return (
    <Animated.View
      key={topic.key}
      entering={
        reduceMotion
          ? undefined
          : FadeIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({
              transform: [{ translateY: 10 }],
            })
      }
      style={styles.card}
    >
      <View style={[styles.head, { backgroundColor: pastel[topic.tint] }]}>
        <View style={styles.headCopy}>
          <Text style={styles.title}>{topic.title}</Text>
          <Text style={styles.meta}>
            {topic.lessons.length} lessons, about {minutes} min each
          </Text>
        </View>
        <View style={styles.art} pointerEvents="none">
          <TrainCompanion pose={topic.pose} width={112} />
        </View>
      </View>

      <View style={styles.list}>
        {topic.lessons.slice(0, SHOWN).map((lesson, index) => (
          <Reveal key={lesson.id} index={index} offset={140}>
            <View style={[styles.row, index > 0 && styles.rowRule]}>
              <Text style={styles.number}>{index + 1}</Text>
              <Text style={styles.lesson} numberOfLines={1}>
                {lesson.title}
              </Text>
              <Text style={styles.minutes}>{lesson.minutes} min</Text>
            </View>
          </Reveal>
        ))}
        {topic.lessons.length > SHOWN ? (
          <Text style={styles.more}>and {topic.lessons.length - SHOWN} more in the roadmap</Text>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", paddingLeft: space.lg, minHeight: 104 },
  headCopy: { flex: 1, paddingVertical: space.lg },
  title: { ...type.sectionTitle, color: text.primary },
  meta: { ...type.caption, fontWeight: "600", color: text.secondary, marginTop: 4 },
  art: { marginRight: -8, marginBottom: -14, alignSelf: "flex-end" },
  list: { paddingHorizontal: space.lg, paddingBottom: space.md },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  rowRule: { borderTopWidth: 1, borderTopColor: border.soft },
  number: { ...type.cardTitle, width: 18, fontWeight: "700", color: accent.band, fontVariant: ["tabular-nums"] },
  lesson: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },
  minutes: { ...type.caption, color: text.tertiary, fontVariant: ["tabular-nums"] },
  more: { ...type.caption, color: text.tertiary, paddingTop: space.xs },
});
