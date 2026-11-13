import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";
import { CheckCircleIcon, CircleDashedIcon, CircleHalfIcon, ProhibitIcon } from "phosphor-react-native";

import type { RegionStage, RoadStatus } from "@/features/rooms/regionAdmin";
import { STAGE_LABEL } from "@/features/rooms/regionCopy";
import { accent, bg, radius, text } from "@/constants/design";

/**
 * How each review state draws on the map. Colour is never the only signal: every state has its own line pattern and
 * weight, so a red/green colour-blind organizer can still tell verified (solid) from unsafe (long dashes).
 */
export const ROAD_STYLE: Record<RoadStatus, { color: string; width: number; dash: number[] | undefined }> = {
  pending: { color: "#1C1B1A", width: 4, dash: [2, 6] },
  verified: { color: "#2F7A47", width: 6, dash: undefined },
  unsafe: { color: "#C2412D", width: 6, dash: [12, 7] },
  disabled: { color: "#A3A29C", width: 3, dash: [3, 9] },
};

export const SELECTED_ROAD = { color: "#F5C518", width: 14 } as const;

/** A short sample of a road's line, for legends and rows. */
export const RoadSwatch = ({ status, width = 28 }: { status: RoadStatus; width?: number }) => {
  const s = ROAD_STYLE[status];
  return (
    <Svg width={width} height={10} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={3} y1={5} x2={width - 3} y2={5} stroke={s.color} strokeWidth={Math.min(5, s.width - 1)} strokeLinecap="round" strokeDasharray={s.dash?.map((d) => d * 0.7)} />
    </Svg>
  );
};

const STAGE_TONE: Record<RegionStage, { bg: string; ink: string }> = {
  draft: { bg: bg.subtle, ink: text.secondary },
  in_review: { bg: accent.soft, ink: "#8A5A10" },
  published: { bg: "#E6F2E9", ink: "#2F6B40" },
  disabled: { bg: bg.subtle, ink: text.tertiary },
};

const STAGE_ICON: Record<RegionStage, typeof CircleDashedIcon> = { draft: CircleDashedIcon, in_review: CircleHalfIcon, published: CheckCircleIcon, disabled: ProhibitIcon };

/** A region's stage as icon plus word. */
export const StageBadge = ({ stage, style }: { stage: RegionStage; style?: StyleProp<ViewStyle> }) => {
  const Icon = STAGE_ICON[stage];
  const tone = STAGE_TONE[stage];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }, style]}>
      <Icon size={13} color={tone.ink} weight="bold" />
      <Text style={[styles.badgeText, { color: tone.ink }]}>{STAGE_LABEL[stage]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, height: 24, paddingHorizontal: 8, borderRadius: radius.pill, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
});
