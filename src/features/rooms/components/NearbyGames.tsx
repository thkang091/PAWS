import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { CaretRightIcon, CheckIcon, UsersThreeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { TournamentArt } from "@/features/tournament/components/TournamentArt";
import type { RoomGame } from "@/services/roomService";
import type { TournamentGame } from "@/services/tournamentService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

/** Every nearby game, in a line each. The rules are explained in the game itself, not up front. */
export const NEARBY_GAMES: readonly { key: RoomGame; title: string; line: string; players: string; min: number }[] = [
  { key: "steal_territory", title: "Steal Your Territory", line: "Walk loops. Claim the ground inside.", players: "2 to 10", min: 2 },
  { key: "steal_road", title: "Steal Your Road", line: "Walk a road end to end to own it.", players: "2 to 10", min: 2 },
  { key: "find_mafia", title: "Find the Mafia", line: "One walker has a secret route.", players: "4 to 10", min: 4 },
  { key: "number_trail", title: "Number Trail", line: "Walk a number on real streets.", players: "2 to 10", min: 2 },
];

export type GameRowProps = {
  game: TournamentGame;
  title: string;
  line: string;
  meta?: string;
  metaTone?: "plain" | "warn" | "live" | "wait";
  /** "players" shows the people icon; "status" is a plain fact (a tournament's state, practice). */
  metaKind?: "players" | "status";
  /** Picked: a check badge. */
  selected?: boolean;
  role?: "radio" | "button";
  onPress?: () => void;
  disabled?: boolean;
  /** Not playable yet: shown quietly, can't be opened. */
  muted?: boolean;
};

/** One game: its art, name, one line and a small fact (players, or where its tournament stands). */
export const GameRow = ({ game, title, line, meta, metaTone = "plain", metaKind = "players", selected = false, role, onPress, disabled = false, muted = false }: GameRowProps) => {
  const reduceMotion = useReducedMotion();
  const metaColor = metaTone === "warn" ? "#B4442C" : metaTone === "live" ? "#2F7D6D" : metaTone === "wait" ? "#9A5B12" : text.secondary;
  const body = (
    <>
      <View style={[styles.art, muted && styles.artMuted]}>
        <TournamentArt game={game} width={76} height={76} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, muted && styles.mutedText]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {title}
        </Text>
        <Text style={styles.line} numberOfLines={2}>
          {line}
        </Text>
        {meta ? (
          <View style={styles.meta}>
            {metaTone === "live" ? <View style={styles.liveDot} /> : metaKind === "players" ? <UsersThreeIcon size={13} color={metaColor} weight="bold" /> : null}
            <Text style={[styles.metaText, { color: metaColor }]}>{meta}</Text>
          </View>
        ) : null}
      </View>
      {selected ? (
        <Animated.View entering={reduceMotion ? FadeIn.duration(motion.duration.select) : ZoomIn.duration(160).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.9 }] })} style={styles.check}>
          <CheckIcon size={14} color={text.primary} weight="bold" />
        </Animated.View>
      ) : onPress && role !== "radio" && !muted ? (
        <CaretRightIcon size={18} color={text.tertiary} weight="bold" />
      ) : null}
    </>
  );
  const label = `${title}${selected ? ", picked" : ""}. ${line}${meta ? ` ${meta}.` : ""}`;
  return onPress && !muted ? (
    <PressScale
      accessibilityRole={role ?? "button"}
      accessibilityState={role === "radio" ? { selected, disabled } : { disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      scaleTo={0.98}
      style={[styles.card, selected && styles.cardOn]}
      onPress={onPress}
    >
      {body}
    </PressScale>
  ) : (
    <View style={[styles.card, selected && styles.cardOn, muted && styles.cardMuted]} accessible accessibilityLabel={muted ? `${label} Coming soon.` : label}>
      {body}
    </View>
  );
};

/**
 * The nearby games page. In a room the host picks with a tap (`onPick`, radio rows). Before a room, a tap makes a room
 * for that game (`onOpen`).
 */
export const NearbyGames = ({
  selected = null,
  onPick,
  onOpen,
  busy = false,
  players,
  topInset,
  bottomInset,
  heading,
}: {
  selected?: RoomGame | null;
  onPick?: (g: RoomGame) => void;
  onOpen?: (g: RoomGame) => void;
  busy?: boolean;
  players?: number;
  topInset: number;
  bottomInset: number;
  heading?: string;
}) => (
  <ScrollView contentContainerStyle={[gameStyles.body, { paddingTop: topInset, paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false}>
    {heading ? <Text style={gameStyles.heading}>{heading}</Text> : null}
    <View style={[gameStyles.list, !heading && gameStyles.listTop]}>
      {NEARBY_GAMES.map((g) => {
        const short = players != null && players < g.min;
        return (
          <GameRow
            key={g.key}
            game={g.key}
            title={g.title}
            line={g.line}
            // Not an error: the room just needs more people. Say how many, calmly.
            meta={short ? `${g.min - players!} more to play` : g.players}
            metaTone={short ? "wait" : "plain"}
            selected={selected === g.key}
            role={onPick ? "radio" : onOpen ? "button" : undefined}
            disabled={busy}
            onPress={onPick ? () => onPick(g.key) : onOpen ? () => onOpen(g.key) : undefined}
          />
        );
      })}
      {/* Before a room: Number Trail on your own, around you. */}
      {onPick ? null : <GameRow game="number_trail" title="Number Trail solo" line="Find your numbers. Walk one." meta="Practice" metaKind="status" onPress={() => router.push("/game/number-trail/near")} />}
    </View>
  </ScrollView>
);

export const gameStyles = StyleSheet.create({
  body: { paddingHorizontal: layout.gutter },
  heading: { fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6, color: text.primary },
  list: { gap: space.sm, marginTop: space.lg },
  listTop: { marginTop: 0 },
  section: { ...type.caption, fontWeight: "800", color: text.tertiary, marginTop: space.md },
});

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: bg.surface, borderWidth: 2, borderColor: border.soft },
  cardOn: { borderColor: accent.band, backgroundColor: accent.soft },
  cardMuted: { borderColor: bg.subtle, backgroundColor: bg.subtle },
  art: { width: 76, height: 76, borderRadius: 18, overflow: "hidden", backgroundColor: bg.subtle },
  artMuted: { opacity: 0.55 },
  text: { flex: 1, gap: 2 },
  title: { ...type.cardTitle, fontSize: 17, fontWeight: "800", color: text.primary },
  mutedText: { color: text.secondary },
  line: { ...type.caption, color: text.secondary },
  meta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2F8F4E" },
  metaText: { fontSize: 12, fontWeight: "700" },
  check: { width: 26, height: 26, borderRadius: 13, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
});
