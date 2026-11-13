import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { StarIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { TournamentArt } from "@/features/tournament/components/TournamentArt";
import { GameArt, gameArtAspect } from "@/features/game/components/GameArt";
import { ModeIllustration, modeAspect } from "@/features/game/components/ModeIllustration";
import type { WeekGame } from "@/services/weekService";
import type { TournamentGame } from "@/services/tournamentService";
import { bg, layout, motion, space, text } from "@/constants/design";

type Meta = { name: string; route: string; art?: TournamentGame; icon?: "paw" | "bolt"; tint: string };

const META: Record<string, Meta> = {
  largest_country: { name: "Make the Largest Country", route: "/game/tournament/largest-country", art: "largest_country", tint: "#E7F0EA" },
  photo_pose: { name: "Photo Pose Challenge", route: "/game/tournament/photo-pose", art: "photo_pose", tint: "#FBF1D5" },
  seasonal_selfie: { name: "Seasonal Selfie", route: "/game/tournament/seasonal", art: "seasonal_selfie", tint: "#FBE6D9" },
  dog_reels: { name: "Dog Reels Battle", route: "/game/tournament/reels", art: "dog_reels", tint: "#ECEAE4" },
  number_trail: { name: "Number Trail", route: "/game/tournament?mode=nearby", art: "number_trail", tint: "#F4EFE2" },
  steal_territory: { name: "Steal Your Territory", route: "/game/tournament?mode=nearby", art: "steal_territory", tint: "#F4EFE2" },
  steal_road: { name: "Steal Your Road", route: "/game/tournament?mode=nearby", art: "steal_road", tint: "#E9EDDD" },
  find_mafia: { name: "Find the Mafia", route: "/game/tournament?mode=nearby", art: "find_mafia", tint: "#E3EBDD" },
  longest_sit: { name: "Longest Sit", route: "/game/duel", icon: "bolt", tint: "#F3D9CF" },
  trick_combo: { name: "Trick Combo", route: "/game/duel", icon: "bolt", tint: "#E4E0F2" },
};

/** What a row shows for a game key, or null for a game this app version doesn't know. */
export const weekMeta = (g: Pick<WeekGame, "game" | "title">): Meta | null => {
  if (g.game.startsWith("challenge:")) return { name: g.title ?? "Solo game", route: `/game/${g.game.slice("challenge:".length)}`, icon: "paw", tint: "#DCEBE4" };
  return META[g.game] ?? null;
};

export const formatMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);

/** Until anyone has played this week: one game from each kind (solo, duel, online, nearby). */
const PICKS: readonly { game: string; route: string; name: string; art?: TournamentGame; icon?: "paw" | "bolt"; tint: string; line: string }[] = [
  { game: "solo", name: "Find the Treat", route: "/game/challenge", icon: "paw", tint: "#DCEBE4", line: "Solo" },
  { game: "duel", name: "Longest Sit", route: "/game/duel", icon: "bolt", tint: "#F3D9CF", line: "Duel" },
  { game: "dog_reels", name: "Dog Reels Battle", route: "/game/tournament/reels", art: "dog_reels", tint: "#ECEAE4", line: "Online" },
  { game: "steal_territory", name: "Steal Your Territory", route: "/game/tournament?mode=nearby", art: "steal_territory", tint: "#F4EFE2", line: "Nearby" },
];

/** Stars for a game from this week's plays: the most played gets five, the rest by their share of it (at least one). */
const starsFor = (plays: number, top: number) => (top <= 0 ? 0 : Math.max(1, Math.round((plays / top) * 5)));

/**
 * Best of the week: the most played games since Monday (plays, then minutes, then players who came back), stars by how
 * much each was played. Before anyone has played, one pick from each kind of game.
 */
export const WeekBest = ({ games, loading }: { games: readonly WeekGame[] | undefined; loading: boolean }) => {
  const reduceMotion = useReducedMotion();
  const played = (games ?? []).map((g) => ({ g, m: weekMeta(g) })).filter((r): r is { g: WeekGame; m: Meta } => r.m != null);
  const top = played[0]?.g.plays ?? 0;
  const rows = played.length
    ? played.map(({ g, m }) => ({
        key: g.game,
        name: m.name,
        route: m.route,
        art: m.art,
        icon: m.icon,
        tint: m.tint,
        stars: starsFor(g.plays, top),
        line: g.minutes > 0 ? `Played ${formatMinutes(g.minutes)}` : `${g.plays} ${g.plays === 1 ? "play" : "plays"}`,
        label: `${m.name}. ${g.plays} plays this week${g.minutes > 0 ? `, ${formatMinutes(g.minutes)} played` : ""}`,
      }))
    : PICKS.map((p) => ({ key: p.game, name: p.name, route: p.route, art: p.art, icon: p.icon, tint: p.tint, stars: 5, line: p.line, label: `${p.name}. ${p.line}, a top pick` }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading} accessibilityRole="header">
        Best of the week
      </Text>
      {loading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : (
        <View style={styles.list}>
          {rows.map((r, i) => (
            <Animated.View key={r.key} entering={reduceMotion ? FadeIn.duration(motion.duration.enter) : FadeInDown.delay(i * 50).duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}>
              <PressScale accessibilityRole="button" accessibilityLabel={r.label} scaleTo={0.98} style={styles.row} onPress={() => router.push(r.route as never)}>
                <View style={[styles.tile, { backgroundColor: r.tint }]}>
                  {r.art ? <TournamentArt game={r.art} width={66} height={66} /> : <TileArt kind={r.icon ?? "paw"} />}
                </View>
                <View style={styles.text}>
                  {r.stars > 0 ? (
                    <View style={styles.stars} accessibilityElementsHidden>
                      {[0, 1, 2, 3, 4].map((s) => (
                        <Animated.View key={s} entering={reduceMotion ? undefined : ZoomIn.delay(i * 50 + s * 30).duration(160).withInitialValues({ transform: [{ scale: 0.6 }] })}>
                          <StarIcon size={15} color={s < r.stars ? "#F2B632" : "#E6E3DA"} weight="fill" />
                        </Animated.View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={styles.name} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.line}>{r.line}</Text>
                </View>
              </PressScale>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
};

/** The illustrated tile for games without a tournament picture: Find the Treat's own art, and the duel art for arena games. */
const TileArt = ({ kind }: { kind: "paw" | "bolt" }) =>
  kind === "paw" ? (
    <View style={styles.tileArt}>
      <GameArt game="treat" width={Math.min(60, 50 * gameArtAspect("treat"))} />
    </View>
  ) : (
    <View style={styles.tileArt}>
      <ModeIllustration mode="duel" width={Math.min(62, 52 * modeAspect("duel"))} />
    </View>
  );

const styles = StyleSheet.create({
  tileArt: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
  wrap: { paddingHorizontal: layout.gutter, marginTop: space.section },
  heading: { fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.6, color: text.primary },
  list: { gap: space.lg, marginTop: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  tile: { width: 66, height: 66, borderRadius: 20, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 3 },
  stars: { flexDirection: "row", gap: 2 },
  name: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2, color: text.primary },
  line: { fontSize: 13, fontWeight: "600", color: text.tertiary },
  skeleton: { height: 66, borderRadius: 20, backgroundColor: bg.subtle },
});
