import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { CaretRightIcon, ScalesIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { TEAM_COLOR, TEAM_NAME } from "@/features/rooms/components/BattleMap";
import { BATTLE_MINUTES, ROUTES, teamCounts, unevenNote } from "@/features/rooms/lobbyRules";
import { useOrganizer, usePublishedRegions } from "@/hooks/useRegions";
import { setBattleSettings, type RoomState, type Team } from "@/services/roomService";
import { accent, bg, border, radius, space, text, type } from "@/constants/design";

/** Next team when the host taps a player: none, blue, orange, none. */
export const nextTeam = (t: Team | null): Team | null => (t === null ? "blue" : t === "blue" ? "orange" : null);

/** A player's team as a chip: colour plus a word and a shape, never colour alone. */
export const TeamChip = ({ team }: { team: Team | null }) => (
  <View style={[styles.chip, team && { backgroundColor: `${TEAM_COLOR[team]}22`, borderColor: TEAM_COLOR[team] }, team === "orange" && styles.chipDashed]}>
    <View style={[styles.mark, team === "blue" && styles.markCircle, team === "orange" && styles.markSquare, team && { backgroundColor: TEAM_COLOR[team] }]} />
    <Text style={styles.chipText}>{team ? TEAM_NAME[team] : "No team"}</Text>
  </View>
);

/**
 * The battle part of a nearby lobby: team counts and auto-balance, match length, and the region (needed for roads,
 * optional bounds for territory). Hosts change these; everyone sees the same.
 */
export const BattleLobby = ({ state, onBalance, onChanged, onError, busy }: { state: RoomState; onBalance: () => void; onChanged: () => void; onError: (code: string | undefined) => void; busy: boolean }) => {
  const { room, me, members } = state;
  const regions = usePublishedRegions();
  const organizer = useOrganizer();
  const road = room.gameType === "steal_road";
  const counts = teamCounts(members);
  const uneven = unevenNote(members);
  const host = me.isHost;
  const set = (minutes: number, regionId: string | null) =>
    void setBattleSettings(room.id, minutes, regionId)
      .catch((e) => onError((e as { code?: string }).code))
      .finally(onChanged);
  // A picked area that has since been disabled shows as unpicked, so the host knows to choose again.
  const picked = (regions.data ?? []).some((r) => r.id === room.regionId) ? room.regionId : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.teams}>
        {(["blue", "orange"] as Team[]).map((t) => (
          <View key={t} style={[styles.team, { borderColor: TEAM_COLOR[t] }, t === "orange" && styles.teamDashed]}>
            <Text style={[styles.teamName, { color: TEAM_COLOR[t] }]}>{TEAM_NAME[t].toUpperCase()}</Text>
            <Text style={styles.teamCount}>{counts[t]}</Text>
          </View>
        ))}
      </View>
      {counts.none > 0 ? <Text style={styles.note}>{`${counts.none} ${counts.none === 1 ? "player has" : "players have"} no team yet.`}</Text> : uneven ? <Text style={styles.note}>{uneven}</Text> : null}
      {host ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Balance teams" style={styles.balance} disabled={busy} onPress={onBalance}>
          <ScalesIcon size={18} color={text.primary} weight="fill" />
          <Text style={styles.balanceText}>Balance teams</Text>
          <Text style={styles.balanceNote}>Tap a player to switch them</Text>
        </PressScale>
      ) : null}

      <View style={styles.labelRow}>
        <Text style={styles.label}>MATCH LENGTH</Text>
        {!host ? <Text style={styles.hostOnly}>Set by the host</Text> : null}
      </View>
      <View style={styles.row}>
        {BATTLE_MINUTES.map((m) => (
          <PressScale key={m} accessibilityRole="button" accessibilityState={{ selected: room.battleMinutes === m, disabled: !host }} disabled={!host} style={[styles.opt, room.battleMinutes === m && styles.optOn, !host && room.battleMinutes !== m && styles.optIdle]} onPress={() => set(m, picked)}>
            <Text style={styles.optText}>{`${m} min`}</Text>
          </PressScale>
        ))}
      </View>

      <View style={styles.labelRow}>
        <Text style={styles.label}>{road ? "ROAD AREA" : "PLAY AREA"}</Text>
        {!host ? <Text style={styles.hostOnly}>Set by the host</Text> : null}
      </View>
      {regions.isPending ? (
        <View style={styles.regionLoading} />
      ) : regions.error ? (
        <PressScale accessibilityRole="button" style={styles.region} onPress={() => void regions.refetch()}>
          <Text style={styles.regionName}>{"Couldn't load road areas"}</Text>
          <Text style={styles.regionNote}>Tap to try again.</Text>
        </PressScale>
      ) : (regions.data ?? []).length === 0 ? (
        <View style={road ? styles.empty : undefined}>
          <Text style={road ? styles.emptyText : styles.note}>{road ? "No road area has been published yet. Organizers check every road before an area can be played." : "Anywhere you walk."}</Text>
        </View>
      ) : (
        <View style={styles.regions}>
          {!road ? (
            <PressScale accessibilityRole="button" accessibilityState={{ selected: !picked }} disabled={!host} style={[styles.region, !picked && styles.regionOn]} onPress={() => set(room.battleMinutes, null)}>
              <Text style={styles.regionName}>Anywhere</Text>
              <Text style={styles.regionNote}>Loops count wherever you walk.</Text>
            </PressScale>
          ) : null}
          {(regions.data ?? []).map((r) => (
            <PressScale key={r.id} accessibilityRole="button" accessibilityState={{ selected: picked === r.id }} disabled={!host} style={[styles.region, picked === r.id && styles.regionOn]} onPress={() => set(room.battleMinutes, r.id)}>
              <Text style={styles.regionName}>{r.name}</Text>
              <Text style={styles.regionNote}>{`${r.roads} checked roads${r.attribution ? `. ${r.attribution}` : ""}`}</Text>
            </PressScale>
          ))}
        </View>
      )}
      {road && host && organizer.data ? (
        <PressScale accessibilityRole="button" style={styles.manage} onPress={() => router.push(ROUTES.regions as never)}>
          <Text style={styles.manageText}>Manage road areas</Text>
          <CaretRightIcon size={13} color={text.secondary} weight="bold" />
        </PressScale>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: space.xl, gap: space.sm },
  teams: { flexDirection: "row", gap: space.md },
  team: { flex: 1, padding: space.lg, borderRadius: radius.card, borderWidth: 2, backgroundColor: bg.surface, alignItems: "center" },
  teamDashed: { borderStyle: "dashed" },
  teamName: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  teamCount: { fontSize: 28, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  balance: { flexDirection: "row", alignItems: "center", gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: accent.soft },
  balanceText: { ...type.supporting, fontWeight: "700", color: text.primary },
  balanceNote: { ...type.caption, color: text.secondary, flex: 1, textAlign: "right" },
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.lg },
  label: { ...type.eyebrow, color: text.tertiary },
  hostOnly: { ...type.caption, color: text.tertiary },
  row: { flexDirection: "row", gap: space.sm },
  opt: { flex: 1, height: 42, borderRadius: 14, borderWidth: 2, borderColor: border.soft, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  optOn: { borderColor: accent.band, backgroundColor: accent.soft },
  optIdle: { opacity: 0.55 },
  optText: { fontSize: 14, fontWeight: "700", color: text.primary },
  note: { ...type.caption, color: text.secondary },
  regions: { gap: space.sm },
  region: { padding: space.md, borderRadius: radius.card, borderWidth: 2, borderColor: border.soft, backgroundColor: bg.surface },
  regionOn: { borderColor: accent.band, backgroundColor: accent.soft },
  regionName: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  regionNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  manage: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", minHeight: 44 },
  manageText: { ...type.supporting, fontWeight: "700", color: text.secondary },
  regionLoading: { height: 64, borderRadius: radius.card, backgroundColor: bg.subtle },
  empty: { padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  emptyText: { ...type.supporting, color: text.primary },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 9, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.default, backgroundColor: bg.subtle },
  chipDashed: { borderStyle: "dashed" },
  chipText: { fontSize: 11, fontWeight: "800", color: text.primary },
  mark: { width: 9, height: 9, backgroundColor: border.default, borderRadius: 2 },
  markCircle: { borderRadius: 5 },
  markSquare: { borderRadius: 1 },
});
