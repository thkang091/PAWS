import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn, useReducedMotion, FadeIn } from "react-native-reanimated";
import { SealCheckIcon, TrophyIcon } from "phosphor-react-native";

import { formatArea, formatAreaAlt, formatDistance, formatDuration } from "@/features/tournament/format";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

/** The checked result of one territory: area big, then distance, time and place. */
export const TournamentResultCard = ({
  areaM2,
  distanceM,
  elapsedSeconds,
  rank,
  total,
  personalBest,
  flagged,
}: {
  areaM2: number;
  distanceM: number;
  elapsedSeconds: number;
  rank: number | null;
  total: number | null;
  personalBest: boolean;
  flagged: boolean;
}) => {
  const reduceMotion = useReducedMotion();
  const alt = formatAreaAlt(areaM2);
  return (
    <View style={styles.card}>
      <View style={styles.badges}>
        {personalBest && !flagged ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(260).duration(motion.duration.enter)} style={styles.pb}>
            <TrophyIcon size={15} color={text.primary} weight="fill" />
            <Text style={styles.pbText}>Personal best</Text>
          </Animated.View>
        ) : null}
        <View style={styles.checked}>
          <SealCheckIcon size={15} color={flagged ? text.secondary : "#2F8F4E"} weight="fill" />
          <Text style={styles.checkedText}>{flagged ? "Being checked" : "Verified by PAWS"}</Text>
        </View>
      </View>
      <Animated.Text
        entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.92 }], opacity: 0 })}
        style={styles.area}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formatArea(areaM2)}
      </Animated.Text>
      {alt ? <Text style={styles.alt}>{alt}</Text> : null}
      <View style={styles.stats}>
        <Stat label="Walked" value={formatDistance(distanceM)} />
        <Stat label="Time" value={formatDuration(elapsedSeconds * 1000)} />
        <Stat label="Place" value={rank ? `${rank}${total ? ` of ${total}` : ""}` : flagged ? "Pending" : "-"} />
      </View>
      {flagged ? <Text style={styles.flagNote}>The server's two measurements disagreed, so this territory waits for a check before it joins the board.</Text> : null}
    </View>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: { padding: space.xl, borderRadius: 28, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pb: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  pbText: { fontSize: 12, fontWeight: "800", color: text.primary },
  checked: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  checkedText: { fontSize: 12, fontWeight: "700", color: text.secondary },
  area: { fontSize: 48, lineHeight: 56, fontWeight: "800", letterSpacing: -1.4, color: text.primary, fontVariant: ["tabular-nums"], marginTop: space.md },
  alt: { ...type.supporting, color: text.secondary, fontVariant: ["tabular-nums"] },
  stats: { flexDirection: "row", marginTop: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  stat: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  flagNote: { ...type.caption, color: text.secondary, marginTop: space.md },
});
