import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

import { scene } from "@/constants/design";

const Shrub = ({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) => (
  <G transform={`translate(${x},${y}) scale(${s})`}>
    <Ellipse cx="0" cy="0" rx="30" ry="23" fill={fill} />
    <Ellipse cx="24" cy="7" rx="23" ry="17" fill={fill} />
    <Ellipse cx="-22" cy="8" rx="20" ry="15" fill={fill} />
  </G>
);

const Tuft = ({ x, y, s }: { x: number; y: number; s: number }) => (
  <G transform={`translate(${x},${y}) scale(${s})`}>
    <Path d="M0 0 C -1 -7 -4 -11 -7 -14" stroke={scene.shrub} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Path d="M2 0 C 2 -8 2 -12 2 -16" stroke={scene.shrub} strokeWidth={3} strokeLinecap="round" fill="none" />
    <Path d="M4 0 C 5 -7 8 -11 11 -14" stroke={scene.shrub} strokeWidth={3} strokeLinecap="round" fill="none" />
  </G>
);

const Flowers = ({ x, y }: { x: number; y: number }) => (
  <G transform={`translate(${x},${y})`}>
    <Circle cx="0" cy="0" r="3.2" fill="#FFFFFF" />
    <Circle cx="6" cy="3" r="2.6" fill="#FFFFFF" />
    <Circle cx="-5" cy="3" r="2.4" fill="#FFFFFF" />
  </G>
);

const BAND = 236;

export const GardenBackdrop = memo(
  ({ width, height }: { width: number; height: number }) => {
    const bands = Math.max(1, Math.ceil(height / BAND));

    return (
      <View
        style={[StyleSheet.absoluteFill, styles.ground]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {Array.from({ length: bands }, (_, b) => {
            const top = b * BAND;
            const near = b % 2 === 0;
            return (
              <G key={b}>
                <Shrub
                  x={near ? -6 : width - 16}
                  y={top + 52}
                  s={near ? 1 : 0.85}
                  fill={near ? scene.shrub : scene.shrubDeep}
                />
                <Tuft x={near ? 44 : width - 34} y={top + 140} s={1} />
                <Flowers x={near ? 24 : width - 52} y={top + 186} />
                <Tuft x={near ? 12 : width - 62} y={top + 214} s={0.75} />
              </G>
            );
          })}
        </Svg>
      </View>
    );
  },
);

GardenBackdrop.displayName = "GardenBackdrop";

const styles = StyleSheet.create({
  ground: {
    backgroundColor: scene.ground,
  },
});
