import { memo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Ellipse, G, Path } from "react-native-svg";

import { scene } from "@/constants/design";

const BLOB =
  "M40 152 C28 84 82 22 158 26 C226 30 268 4 316 34 C372 69 378 140 352 194 " +
  "C324 252 254 280 178 272 C104 264 52 222 40 152 Z";

const PAD = "M96 128 C60 128 34 152 34 184 C34 220 66 240 106 240 C150 240 182 220 182 184 C182 150 146 128 96 128 Z";

type Layer = {
  depth: number;
  x: number;
  y: number;
  width: number;
  rotate: number;
  opacity: number;
  shape: "blob" | "paw";
  fill: string;
};

const LAYERS: readonly Layer[] = [
  { depth: 0.12, x: 22, y: 96, width: 124, rotate: -14, opacity: 1, shape: "paw", fill: scene.blobSoft },
  { depth: 0.3, x: 150, y: 40, width: 208, rotate: -10, opacity: 1, shape: "blob", fill: scene.blob },
  { depth: 0.2, x: -52, y: 178, width: 168, rotate: 14, opacity: 1, shape: "blob", fill: scene.blobSoft },
  { depth: 0.42, x: 254, y: 212, width: 140, rotate: 28, opacity: 1, shape: "blob", fill: scene.blobSoft },
];

const Shape = ({ layer }: { layer: Layer }) =>
  layer.shape === "blob" ? (
    <Svg width={layer.width} height={layer.width * 0.72} viewBox="0 0 400 288">
      <Path d={BLOB} fill={layer.fill} />
    </Svg>
  ) : (
    <Svg width={layer.width} height={layer.width} viewBox="0 0 216 252">
      <G fill={layer.fill}>
        <Ellipse cx="42" cy="70" rx="27" ry="38" transform="rotate(-14 42 70)" />
        <Ellipse cx="96" cy="42" rx="27" ry="40" />
        <Ellipse cx="152" cy="54" rx="26" ry="38" transform="rotate(12 152 54)" />
        <Ellipse cx="196" cy="104" rx="23" ry="33" transform="rotate(24 196 104)" />
        <Path d={PAD} />
      </G>
    </Svg>
  );

const Drifting = ({
  layer,
  progress,
  span,
}: {
  layer: Layer;
  progress: SharedValue<number>;
  span: number;
}) => {
  const reduceMotion = useReducedMotion();

  const style = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    return {
      transform: [
        { translateX: -progress.value * span * layer.depth },
        { rotate: `${layer.rotate + interpolate(progress.value, [0, 2], [0, 10])}deg` },
      ],
    };
  }, [reduceMotion, span]);

  return (
    <Animated.View
      style={[
        styles.layer,
        { left: layer.x, top: layer.y, opacity: layer.opacity },
        style,
      ]}
      pointerEvents="none"
    >
      <Shape layer={layer} />
    </Animated.View>
  );
};

export const WelcomeBackdrop = memo(
  ({ progress, span }: { progress: SharedValue<number>; span: number }) => (
    <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
      {LAYERS.map((layer, index) => (
        <Drifting key={index} layer={layer} progress={progress} span={span} />
      ))}
    </Animated.View>
  ),
);

WelcomeBackdrop.displayName = "WelcomeBackdrop";

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
  },
});
