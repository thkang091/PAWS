import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { G, Path } from "react-native-svg";

import { GAME_ART, type GameKey } from "@/features/game/components/gamePaths";
import { border, radius } from "@/constants/design";

export const gameArtAspect = (game: GameKey) => GAME_ART[game].aspect;

export const GameArt = memo(({ game, width }: { game: GameKey; width: number }) => {
  const scene = GAME_ART[game];
  const height = width / scene.aspect;

  return (
    <View style={[styles.frame, { width, height }]}>
      <Svg width={width} height={height} viewBox={scene.viewBox}>
        <G transform={scene.transform}>
          {scene.layers.map((layer, index) => (
            <Path key={index} d={layer.d} fill={layer.fill} />
          ))}
        </G>
      </Svg>
    </View>
  );
});

GameArt.displayName = "GameArt";

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: border.soft,
  },
});
