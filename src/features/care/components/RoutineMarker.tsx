import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { CheckIcon, PlayIcon } from "phosphor-react-native";

import { accent, bg, border, icon, scene, text } from "@/constants/design";

export type RoutineState = "done" | "now" | "waiting";

export const MARKER = 34;
const BREATH_MS = 1700;

export const RoutineMarker = ({ state }: { state: RoutineState }) => {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (state !== "now" || reduceMotion) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: BREATH_MS, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [breath, reduceMotion, state]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.34 * (1 - breath.value),
    transform: [{ scale: 1 + breath.value * 0.3 }],
  }));

  return (
    <View style={styles.box}>
      {state === "now" ? <Animated.View style={[styles.halo, haloStyle]} /> : null}
      <View
        style={[
          styles.marker,
          state === "done" && styles.done,
          state === "now" && styles.now,
          state === "waiting" && styles.waiting,
        ]}
      >
        {state === "done" ? (
          <CheckIcon size={icon.inline} color={bg.surface} weight="bold" />
        ) : state === "now" ? (
          <PlayIcon size={icon.inline} color={text.primary} weight="fill" />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    width: MARKER,
    height: MARKER,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    backgroundColor: accent.deep,
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  done: {
    backgroundColor: scene.forest,
  },
  now: {
    backgroundColor: accent.deep,
  },
  waiting: {
    backgroundColor: bg.subtle,
    borderWidth: 1,
    borderColor: border.soft,
  },
});
