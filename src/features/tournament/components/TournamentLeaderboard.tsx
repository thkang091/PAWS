import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";

import { formatBoardValue } from "@/features/tournament/format";
import type { BoardRow, BoardUnit } from "@/services/tournamentService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const MEDAL = [
  { face: "#F6C350", ring: "#D18E2A" },
  { face: "#DDE1E6", ring: "#9AA0A6" },
  { face: "#E7B48A", ring: "#B9774A" },
];

const AVATAR_TINTS = ["#F4F2C0", "#E6F3EA", "#E7F1FB", "#FBECF1", "#FDEFE3", "#EDEBFA"];

/** A soft circle with the dog's initial; the tint is picked from the name so it stays the same every time. */
const Avatar = ({ name }: { name: string }) => {
  const tint = AVATAR_TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <View style={[styles.avatar, { backgroundColor: tint }]}>
      <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
};

/**
 * Ranked results, best first. The top three wear medals; your own row is tinted. Shows only names and areas,
 * never where anyone walked.
 */
export const TournamentLeaderboard = ({ rows, limit, unit = "m2" }: { rows: readonly BoardRow[]; limit?: number; unit?: BoardUnit }) => {
  const reduceMotion = useReducedMotion();
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <View style={styles.board}>
      {shown.map((r, i) => {
        const medal = r.rank <= 3 ? MEDAL[r.rank - 1] : null;
        return (
          <Animated.View
            key={`${r.rank}-${r.name}`}
            entering={reduceMotion ? undefined : FadeIn.delay(Math.min(i, 8) * 40).duration(motion.duration.enter)}
            style={[styles.row, i > 0 && styles.rule, r.isMine && styles.mine]}
            accessible
            accessibilityLabel={`${r.rank}. ${r.name}${r.isMine ? ", you" : ""}. ${formatBoardValue(unit, r.value)}`}
          >
            <View style={[styles.rank, medal && { backgroundColor: medal.face, borderColor: medal.ring }]}>
              <Text style={[styles.rankText, medal && styles.rankTop]}>{r.rank}</Text>
            </View>
            <Avatar name={r.name} />
            <Text style={[styles.name, r.isMine && styles.nameMine]} numberOfLines={1}>
              {r.isMine ? `${r.name} (you)` : r.name}
            </Text>
            <Text style={styles.area}>{formatBoardValue(unit, r.value)}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  board: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, height: 60 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  mine: { backgroundColor: accent.soft },
  rank: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: bg.subtle, borderWidth: 2, borderColor: "transparent" },
  rankText: { fontSize: 13, fontWeight: "800", color: text.secondary, fontVariant: ["tabular-nums"] },
  rankTop: { color: text.primary },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "800", color: text.primary },
  name: { ...type.cardTitle, color: text.primary, flex: 1 },
  nameMine: { fontWeight: "700" },
  area: { fontSize: 15, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
});
