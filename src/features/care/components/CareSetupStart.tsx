import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { PawsMark } from "@/features/welcome/components/PawsMark";
import { ONBOARDING_SCENE } from "@/features/welcome/components/onboardingScenePaths";
import { PressScale } from "@/components/ui/PressScale";
import type { CarePlan } from "@/constants/careSetup";
import {
  accent,
  bg,
  layout,
  motion,
  radius,
  scene as sceneColor,
  space,
  text,
  type,
} from "@/constants/design";

const FILL: Record<string, string> = {
  meadow: sceneColor.meadow,
  cream: sceneColor.cream,
  sage: sceneColor.sage,
  sageDeep: sceneColor.sageDeep,
  skin: sceneColor.skin,
  hair: sceneColor.hair,
  ball: sceneColor.ball,
  blob: sceneColor.blob,
  deep: accent.deep,
  ink: sceneColor.ink,
};

export const CareSetupStart = ({
  onStart,
  onAutomatic,
  onClose,
  bottomInset = 0,
  title = "A routine that\nfits your life",
  subtitle = "Training, care, and walks organized into small, manageable steps.",
  startLabel = "Start",
  automaticLabel = "I don\u2019t know where to start",
}: {
  plan?: CarePlan;
  onStart: () => void;
  onAutomatic?: () => void;
  /** Shown as the secondary link when there is no "automatic" path, e.g. "Not now". */
  onClose?: () => void;
  bottomInset?: number;
  title?: string;
  subtitle?: string;
  startLabel?: string;
  automaticLabel?: string;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const artWidth = Math.min(
    stage.width,
    stage.height * ONBOARDING_SCENE.aspect,
    420,
  );

  const arrival = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    arrival.value = reduceMotion
      ? 1
      : withDelay(60, withSpring(1, { duration: 620, dampingRatio: 0.82 }));
  }, [arrival, reduceMotion]);

  const artStyle = useAnimatedStyle(() => ({
    opacity: arrival.value,
    transform: [
      { translateY: (1 - arrival.value) * 18 },
      { scale: 0.96 + arrival.value * 0.04 },
    ],
  }));

  const enter = (order: number) =>
    reduceMotion
      ? undefined
      : FadeInDown.duration(motion.duration.enter).delay(220 + order * 70);

  const takeThePlan = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (onAutomatic ?? onClose)?.();
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.mark}>
          <PawsMark />
        </View>

        <View
          style={styles.stage}
          pointerEvents="none"
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setStage((current) =>
              current.width === width && current.height === height
                ? current
                : { width, height },
            );
          }}
        >
          {artWidth > 0 ? (
            <Animated.View style={artStyle}>
              <Svg
                width={artWidth}
                height={artWidth / ONBOARDING_SCENE.aspect}
                viewBox={ONBOARDING_SCENE.viewBox}
              >
                <G transform={ONBOARDING_SCENE.transform}>
                  {ONBOARDING_SCENE.layers.map((layer, index) => (
                    <Path key={index} d={layer.d} fill={FILL[layer.fill] ?? sceneColor.ink} />
                  ))}
                </G>
              </Svg>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <View style={[styles.sheet, { paddingBottom: insets.bottom + bottomInset + space.lg }]}>
        <View style={styles.copy}>
          <Animated.Text entering={enter(0)} style={styles.title}>
            {title}
          </Animated.Text>
          <Animated.Text entering={enter(1)} style={styles.sub}>
            {subtitle}
          </Animated.Text>
        </View>

        <View style={styles.dock}>
            <Animated.View entering={enter(2)}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={startLabel}
                scaleTo={0.97}
                style={styles.start}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onStart();
                }}
              >
                <Text style={styles.startText}>{startLabel}</Text>
              </PressScale>
            </Animated.View>

            {onAutomatic || onClose ? (
            <Animated.View entering={enter(3)}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={onAutomatic ? "I don't know where to start. PAWS will ask when you are out and build the day around it." : automaticLabel}
                scaleTo={0.97}
                style={styles.secondary}
                onPress={takeThePlan}
              >
                <Text style={styles.secondaryText}>{automaticLabel}</Text>
              </PressScale>
            </Animated.View>
            ) : null}
        </View>
      </View>
    </View>
  );
};

const SHEET_LIFT = 28;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },

  top: { flex: 1, backgroundColor: bg.stage },
  mark: { paddingHorizontal: layout.gutter },

  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginTop: -space.sm,
    paddingBottom: SHEET_LIFT,
  },

  sheet: {
    backgroundColor: bg.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    marginTop: -SHEET_LIFT,
    paddingTop: space.section,
    paddingHorizontal: layout.gutter,
  },

  copy: { alignItems: "center" },
  title: {
    ...type.hero,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
    color: text.primary,
    textAlign: "center",
  },
  sub: {
    ...type.body,
    color: text.secondary,
    textAlign: "center",
    marginTop: space.md,
    maxWidth: 320,
  },

  dock: {
    paddingTop: space.xl,
  },
  start: {
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  startText: { ...type.sectionTitle, fontWeight: "700", color: text.primary },

  secondary: { height: 48, alignItems: "center", justifyContent: "center", marginTop: space.xs },
  secondaryText: { ...type.supporting, color: text.secondary },
});
