import { memo } from "react";
import Svg, { G, Path } from "react-native-svg";

import {
  CARD_ASPECT,
  CARD_VIEW_BOX,
  FETCH,
  FETCH_ASPECT,
  FETCH_FRISBEE,
  FETCH_FRISBEE_FILL,
  FETCH_VIEW_BOX,
  HERO,
  HERO_ASPECT,
  HERO_RISE,
  HERO_VIEW_BOX,
  PEEK,
  PEEK_ASPECT,
  PEEK_CUSHION,
  PEEK_VIEW_BOX,
  PUPPY,
  QUESTION,
  SENIOR,
  YOUNG,
  type DogLayers,
} from "@/components/mascot/pawsDogPaths";
import { accent, mascot } from "@/constants/design";

const POSES = { puppy: PUPPY, young: YOUNG, senior: SENIOR, unsure: YOUNG } as const;

export type DogPose = keyof typeof POSES;

const Drawing = ({
  layers,
  ink = true,
  between,
}: {
  layers: DogLayers;
  ink?: boolean;
  between?: { paths: readonly string[]; fill: string };
}) => (
  <G transform={layers.place}>
    <G transform={layers.transform}>
      {layers.body.map((d, i) => (
        <Path key={`b${i}`} d={d} fill={mascot.coat} />
      ))}
      {between
        ? between.paths.map((d, i) => <Path key={`m${i}`} d={d} fill={between.fill} />)
        : null}
      {ink
        ? layers.ink.map((d, i) => <Path key={`i${i}`} d={d} fill={mascot.ink} />)
        : null}
    </G>
  </G>
);

type PawsDogProps = {
  size: number;
  pose?: DogPose;
  curious?: boolean;
};

export const PawsDog = memo(({ size, pose = "young", curious = false }: PawsDogProps) => (
  <Svg width={size} height={size / CARD_ASPECT} viewBox={CARD_VIEW_BOX}>
    <Drawing layers={POSES[pose]} />
    {curious ? <Drawing layers={QUESTION} /> : null}
  </Svg>
));

PawsDog.displayName = "PawsDog";

export const PawsDogHero = memo(({ width }: { width: number }) => (
  <Svg width={width} height={width / HERO_ASPECT} viewBox={HERO_VIEW_BOX}>
    <Path d={HERO_RISE} fill={accent.primary} />
    <Drawing layers={HERO} />
  </Svg>
));

PawsDogHero.displayName = "PawsDogHero";

export const PawsDogPeek = memo(({ width }: { width: number }) => (
  <Svg width={width} height={width / PEEK_ASPECT} viewBox={PEEK_VIEW_BOX}>
    <G transform={PEEK.transform}>
      {PEEK_CUSHION.map((d, i) => (
        <Path key={`c${i}`} d={d} fill={accent.primary} />
      ))}
    </G>
    <Drawing layers={PEEK} />
  </Svg>
));

PawsDogPeek.displayName = "PawsDogPeek";

export const PawsDogFetch = memo(({ width }: { width: number }) => (
  <Svg width={width} height={width / FETCH_ASPECT} viewBox={FETCH_VIEW_BOX}>
    <Drawing
      layers={FETCH}
      between={{ paths: FETCH_FRISBEE, fill: FETCH_FRISBEE_FILL }}
    />
  </Svg>
));

PawsDogFetch.displayName = "PawsDogFetch";
