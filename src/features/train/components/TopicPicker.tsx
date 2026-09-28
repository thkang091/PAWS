import { useWindowDimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CheckIcon } from "phosphor-react-native";

import { TrainCompanion, companionAspect } from "@/features/train/components/TrainCompanion";
import { PressScale } from "@/components/ui/PressScale";
import type { TopicKey, TrainingTopic } from "@/constants/trainingTopics";
import {
  accent,
  bg,
  border,
  layout,
  motion,
  pastel,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

export type PickerTopic = TrainingTopic & { done: number; total: number };

const GAP = 10;
const COLUMNS = 3;

const Tile = ({
  topic,
  active,
  width,
  onPress,
}: {
  topic: PickerTopic;
  active: boolean;
  width: number;
  onPress: () => void;
}) => {
  const complete = topic.total > 0 && topic.done >= topic.total;
  const fraction = topic.total === 0 ? 0 : topic.done / topic.total;
  const art = Math.min(46, 34 * companionAspect(topic.pose));
  const line = complete
    ? "Done"
    : topic.done > 0
      ? `${topic.done} of ${topic.total}`
      : `${topic.total} lessons`;

  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={
        topic.total === 0
          ? topic.title
          : `${topic.title}, ${topic.done} of ${topic.total} lessons done`
      }
      scaleTo={0.96}
      style={[
        styles.tile,
        { width, backgroundColor: active ? accent.primary : pastel[topic.tint] },
        active && styles.tileOn,
      ]}
      onPress={onPress}
    >
      <View style={styles.art} pointerEvents="none">
        <TrainCompanion pose={topic.pose} width={art} />
      </View>

      <Text style={[styles.name, active && styles.nameOn]} numberOfLines={1}>
        {topic.short}
      </Text>

      <View style={styles.meta}>
        {complete ? <CheckIcon size={11} color={text.secondary} weight="bold" /> : null}
        <Text style={[styles.count, active && styles.countOn]} numberOfLines={1}>
          {line}
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
      </View>
    </PressScale>
  );
};

export const TopicPicker = ({
  topics,
  activeKey,
  visible,
  onClose,
  onSelect,
}: {
  topics: readonly PickerTopic[];
  activeKey: TopicKey;
  visible: boolean;
  onClose: () => void;
  onSelect: (key: TopicKey, index: number) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (!visible) return null;

  const gridWidth = Math.min(width - layout.gutter * 2, 460);
  const tileWidth = Math.floor((gridWidth - GAP * (COLUMNS - 1)) / COLUMNS);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
        exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
        style={styles.scrim}
      >
        <Pressable style={styles.scrimHit} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>

      <View style={styles.lift} pointerEvents="box-none">
        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : SlideInDown.duration(motion.duration.enter).easing(motion.easing.drawer)
          }
          exiting={reduceMotion ? undefined : SlideOutDown.duration(motion.duration.exit)}
          style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}
        >
          <View style={styles.grip} />
          <Text style={styles.heading}>What to work on</Text>

          <View style={[styles.grid, { width: gridWidth }]} accessibilityRole="radiogroup">
            {topics.map((topic, index) => (
              <Tile
                key={topic.key}
                topic={topic}
                active={topic.key === activeKey}
                width={tileWidth}
                onPress={() => {
                  void Haptics.selectionAsync();
                  if (topic.key !== activeKey) onSelect(topic.key, index);
                  onClose();
                }}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(28,27,26,0.28)",
  },
  scrimHit: { flex: 1 },
  lift: { flex: 1, justifyContent: "flex-end" },

  sheet: {
    backgroundColor: bg.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
  },
  grip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: border.default,
  },
  heading: {
    ...type.sectionTitle,
    color: text.primary,
    marginTop: space.xl,
    marginBottom: space.lg,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, alignSelf: "center" },
  tile: {
    height: 122,
    borderRadius: radius.card,
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  tileOn: { borderColor: "rgba(28,27,26,0.20)" },

  art: { flex: 1, justifyContent: "center" },
  name: { ...type.caption, fontSize: 13, fontWeight: "600", color: text.secondary },
  nameOn: { color: text.primary, fontWeight: "700" },

  meta: { flexDirection: "row", alignItems: "center", gap: 3 },
  count: { ...type.caption, fontSize: 11, color: text.secondary },
  countOn: { color: text.primary, fontWeight: "600" },
  track: {
    width: "70%",
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(28,27,26,0.10)",
    overflow: "hidden",
  },
  fill: { height: 4, borderRadius: radius.pill, backgroundColor: accent.band },
});
