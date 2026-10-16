import { StyleSheet, Text, View } from "react-native";
import { ArrowRightIcon, CaretDownIcon } from "phosphor-react-native";

import { TrainCompanion, companionAspect } from "@/features/train/components/TrainCompanion";
import { PressScale } from "@/components/ui/PressScale";
import type { TrainingTopic } from "@/constants/trainingTopics";
import { accent, icon, pastel, radius, space, text, type } from "@/constants/design";

const ART_H = 96;

export const TopicHeader = ({
  topic,
  done,
  total,
  onContinue,
  onOpenPicker,
}: {
  topic: TrainingTopic;
  done: number;
  total: number;
  onContinue: () => void;
  onOpenPicker: () => void;
}) => {
  const complete = total > 0 && done >= total;
  const fraction = total === 0 ? 0 : done / total;
  const label = complete ? "Rewatch" : done === 0 ? "Start" : "Continue";

  return (
    <View style={[styles.card, { backgroundColor: pastel[topic.tint] }]}>
      <View style={styles.top}>
        <View style={styles.copy}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Topic: ${topic.title}. Change topic.`}
            accessibilityHint="Opens the list of training topics"
            scaleTo={0.97}
            style={styles.switcher}
            onPress={onOpenPicker}
          >
            <Text style={styles.title} numberOfLines={2}>
              {topic.title}
            </Text>
            <View style={styles.caret}>
              <CaretDownIcon size={13} color={text.primary} weight="bold" />
            </View>
          </PressScale>

          <Text style={styles.blurb} numberOfLines={2}>
            {topic.blurb}
          </Text>
        </View>

        <View style={styles.art} pointerEvents="none">
          <TrainCompanion pose={topic.pose} width={Math.min(112, ART_H * companionAspect(topic.pose))} />
        </View>
      </View>

      <View style={styles.foot}>
        <View style={styles.progress}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
          </View>
          <Text style={styles.count}>
            {complete ? "All done" : done === 0 ? `${total} lessons` : `${done} of ${total} done`}
          </Text>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`${label} ${topic.title}`}
          scaleTo={0.95}
          style={styles.cta}
          onPress={onContinue}
        >
          <Text style={styles.ctaText}>{label}</Text>
          <ArrowRightIcon size={icon.inline} color={text.primary} weight="bold" />
        </PressScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 26, padding: space.lg, gap: space.lg },
  top: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  copy: { flex: 1 },

  switcher: { flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start" },
  title: {
    ...type.sectionTitle,
    fontSize: 23,
    lineHeight: 27,
    letterSpacing: -0.4,
    color: text.primary,
    flexShrink: 1,
  },
  caret: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: "rgba(28,27,26,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },

  blurb: { ...type.caption, fontSize: 13, lineHeight: 18, color: text.secondary, marginTop: 4 },
  art: { height: ART_H, justifyContent: "flex-end", marginRight: -4 },

  foot: { flexDirection: "row", alignItems: "center", gap: space.md },
  progress: { flex: 1, gap: 6 },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: "rgba(28,27,26,0.08)", overflow: "hidden" },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: accent.band },
  count: { ...type.caption, fontWeight: "600", color: text.secondary },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    height: 42,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  ctaText: { ...type.supporting, fontWeight: "700", color: text.primary },
});
