import { memo } from "react";
import Svg, { G, Path } from "react-native-svg";

import {
  WELCOME_SCENES,
  type SceneFill,
  type WelcomeSceneKey,
} from "@/features/welcome/components/welcomeScenePaths";
import { scene } from "@/constants/design";

const FILL: Record<SceneFill, string> = {
  meadow: scene.meadow,
  cream: scene.cream,
  sage: scene.sage,
  skin: scene.skin,
  ball: scene.ball,
  sageDeep: scene.sageDeep,
  hair: scene.hair,
  ink: scene.ink,
};

export const sceneAspect = (key: WelcomeSceneKey): number => WELCOME_SCENES[key].aspect;

export const WelcomeScene = memo(
  ({ sceneKey, width }: { sceneKey: WelcomeSceneKey; width: number }) => {
    const art = WELCOME_SCENES[sceneKey];

    return (
      <Svg width={width} height={width / art.aspect} viewBox={art.viewBox}>
        <G transform={art.transform}>
          {art.layers.map((layer, index) => (
            <Path key={index} d={layer.d} fill={FILL[layer.fill]} />
          ))}
        </G>
      </Svg>
    );
  },
);

WelcomeScene.displayName = "WelcomeScene";
