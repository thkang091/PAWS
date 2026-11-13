import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { UsersThreeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import type { CatalogGame } from "@/features/tournament/catalog";
import { TournamentArt } from "@/features/tournament/components/TournamentArt";
import { TournamentStatusBadge, type BadgeKind } from "@/features/tournament/components/TournamentStatusBadge";
import { formatArea, formatCountdown } from "@/features/tournament/format";
import type { TournamentSummary } from "@/services/tournamentService";
import { bg, border, layout, radius, space, text, type } from "@/constants/design";

export const badgeFor = (t: TournamentSummary | null, now: number): { kind: BadgeKind; label: string } => {
  if (!t) return { kind: "none", label: "No tournament yet" };
  switch (t.phase) {
    case "active":
      return { kind: "live", label: "Live now" };
    case "registration":
      return { kind: "open", label: "Registration open" };
    case "upcoming":
      return { kind: "upcoming", label: formatCountdown(t.registrationOpensAt, now, "Opens") ?? "Upcoming" };
    case "completed":
      return { kind: "finished", label: "Finished" };
    default:
      return { kind: "cancelled", label: "Cancelled" };
  }
};

/**
 * A game on the Tournament hub. The playable game is a large card with its art, where it stands and a Play button;
 * games still being built are compact rows marked Coming soon that cannot be opened.
 */
export const TournamentGameCard = ({
  game,
  tournament,
  now,
  onPress,
  unavailable = false,
}: {
  game: CatalogGame;
  tournament: TournamentSummary | null;
  now: number;
  onPress?: () => void;
  /** The game's server side isn't set up here: shown, but it can't be opened. */
  unavailable?: boolean;
}) => {
  const { width } = useWindowDimensions();
  const eyebrow = `${game.mode === "online" ? "ONLINE" : "NEARBY"} · ${game.category.toUpperCase()}`;

  if (!game.playable) {
    return (
      <View style={styles.compact} accessible accessibilityLabel={`${game.title}. ${game.line}. Coming soon.`}>
        <View style={styles.compactArt}>
          <TournamentArt game={game.key} width={92} height={92} />
        </View>
        <View style={styles.flex}>
          <View style={styles.compactTop}>
            <Text style={styles.eyebrow} numberOfLines={1}>
              {eyebrow}
            </Text>
            <View style={styles.soon}>
              <Text style={styles.soonText}>Soon</Text>
            </View>
          </View>
          <Text style={styles.compactTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {game.title}
          </Text>
          <Text style={styles.compactLine} numberOfLines={2}>
            {game.line}
          </Text>
        </View>
      </View>
    );
  }

  // Nearby games are played in rooms, not scheduled tournaments.
  const nearby = game.mode === "nearby";
  const badge = unavailable ? { kind: "none" as BadgeKind, label: "Unavailable" } : nearby ? { kind: "open" as BadgeKind, label: game.players ?? "Nearby" } : badgeFor(tournament, now);
  const live = nearby || tournament?.phase === "active" || tournament?.phase === "registration";
  const meta = tournament
    ? tournament.phase === "active"
      ? formatCountdown(tournament.endsAt, now, "Ends")
      : tournament.phase === "registration"
        ? formatCountdown(tournament.startsAt, now, "Starts")
        : null
    : null;
  const artWidth = width - layout.gutter * 2;

  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`${game.title}. ${badge.label}. ${game.line}`} accessibilityState={{ disabled: unavailable }} disabled={unavailable} scaleTo={0.98} style={styles.card} onPress={onPress}>
      <View style={styles.art}>
        <TournamentArt game={game.key} width={artWidth} height={176} />
        <View style={styles.badgeSlot}>
          <TournamentStatusBadge kind={badge.kind} label={badge.label} />
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{game.title}</Text>
        <Text style={styles.line}>{game.line}</Text>
        {tournament ? (
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <UsersThreeIcon size={16} color={text.secondary} weight="fill" />
              <Text style={styles.metaText}>{`${tournament.participants} ${tournament.participants === 1 ? "player" : "players"}`}</Text>
            </View>
            {meta ? <Text style={styles.metaText}>{meta}</Text> : null}
            {tournament.myBestM2 ? <Text style={styles.metaText}>{`Your best ${formatArea(tournament.myBestM2)}`}</Text> : null}
          </View>
        ) : null}
        <RaisedButton
          label={unavailable ? "Not available yet" : nearby ? (game.cta ?? "Create a room") : live ? (tournament?.joined && tournament.phase === "active" ? "Play" : "Join") : "View"}
          disabled={unavailable}
          tone={live && !unavailable ? "yellow" : "white"}
          height={54}
          onPress={() => onPress?.()}
          style={styles.action}
        />
      </View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 28, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden" },
  art: { height: 176, backgroundColor: bg.subtle },
  badgeSlot: { position: "absolute", top: space.md, left: space.md },
  body: { padding: space.xl, paddingTop: space.lg },
  eyebrow: { ...type.eyebrow, color: text.tertiary },
  title: { fontSize: 22, lineHeight: 27, fontWeight: "800", letterSpacing: -0.4, color: text.primary, marginTop: 4 },
  line: { ...type.supporting, color: text.secondary, marginTop: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md, marginTop: space.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { ...type.caption, fontWeight: "700", color: text.secondary, fontVariant: ["tabular-nums"] },
  action: { marginTop: space.lg },

  compact: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  compactArt: { width: 92, height: 92, borderRadius: 18, overflow: "hidden", opacity: 0.85 },
  compactTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary, marginTop: 2 },
  compactLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  compactTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  soon: { height: 22, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  soonText: { fontSize: 11, fontWeight: "800", color: text.secondary, letterSpacing: 0.3 },
});
