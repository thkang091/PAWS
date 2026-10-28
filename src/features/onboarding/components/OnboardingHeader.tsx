import { StyleSheet, Text, View } from "react-native";
import { ArrowLeft } from "phosphor-react-native";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon, layout, motion, radius, space, text, type } from "@/constants/design";

const TOTAL_STAGES = 3;

const Segment = ({ fill, index }: { fill: number; index: number }) => {
  const reduceMotion = useReducedMotion();
  const progress = useDerivedValue(
    () =>
      withTiming(fill, {
        duration: motion.duration.enter,
        easing: motion.easing.out,
      }),
    [fill],
  );

  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.value > 0 ? 1 : 0,
    transform: reduceMotion ? [{ scaleX: progress.value }] : [{ scaleX: progress.value }],
  }));

  return (
    <View style={[styles.segmentTrack, index > 0 && styles.segmentSpacing]}>
      <Animated.View style={[styles.segmentFill, fillStyle]} />
    </View>
  );
};

type OnboardingHeaderProps = {
  stage: number;
  onBack: () => void;
  canGoBack?: boolean;
  fraction?: number;
  /** How many stages the flow has; first-run onboarding has three. */
  total?: number;
};

export const OnboardingHeader = ({
  stage,
  onBack,
  canGoBack = true,
  fraction = 1,
  total = TOTAL_STAGES,
}: OnboardingHeaderProps) => (
  <View>
    <View style={styles.backRow}>
      {canGoBack ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={onBack}
          scaleTo={0.92}
          style={styles.backButton}
        >
          <ArrowLeft size={icon.button} color={text.primary} weight="regular" />
        </PressScale>
      ) : (
        <View style={styles.backSpacer} />
      )}
    </View>

    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: stage }}
      style={styles.progressRow}
    >
      <View style={styles.segments}>
        {Array.from({ length: total }, (_, i) => (
          <Segment
            key={i}
            index={i}
            fill={i < stage - 1 ? 1 : i === stage - 1 ? fraction : 0}
          />
        ))}
      </View>
      <Text style={styles.counter}>
        {stage} / {total}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  backRow: {
    flexDirection: "row",
  },
  backSpacer: {
    width: layout.iconButton,
    height: layout.iconButton,
  },
  backButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: space.xxl,
  },
  segments: {
    flex: 1,
    flexDirection: "row",
  },
  segmentTrack: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: border.soft,
    overflow: "hidden",
  },
  segmentSpacing: {
    marginLeft: space.sm,
  },
  segmentFill: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    transformOrigin: "left",
  },
  counter: {
    ...type.caption,
    color: text.tertiary,
    marginLeft: space.lg,
    fontVariant: ["tabular-nums"],
  },
});
