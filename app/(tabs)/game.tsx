import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { BackpackIcon, BasketIcon, FlowerIcon, GhostIcon, HeartIcon, LeafIcon, PackageIcon, SnowflakeIcon, SunHorizonIcon, SunIcon, TreeEvergreenIcon, UmbrellaIcon, WavesIcon } from "phosphor-react-native";

import { useState } from "react";
import { PressScale } from "@/components/ui/PressScale";
import { PlayMenu } from "@/features/game/components/PlayMenu";
import { MakeSheet } from "@/features/rooms/components/PlayStart";
import { HeroDeck, type HeroSlide } from "@/features/game/components/HeroDeck";
import { ModeDeck, type DeckCard } from "@/features/game/components/ModeDeck";
import { WeekBest, weekMeta } from "@/features/game/components/WeekBest";
import { TournamentArt } from "@/features/tournament/components/TournamentArt";
import { useDuels } from "@/hooks/useArena";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { usePrefetchPetCatalog } from "@/hooks/usePetRewards";
import { poseKeys, useReelChallenges, useSeasonalChallenges } from "@/hooks/usePhotoPose";
import { useGamesOfTheWeek, useTournamentOverview } from "@/hooks/useTournaments";
import { joinChallenge, type MediaChallenge } from "@/services/mediaService";
import type { WeekGame } from "@/services/weekService";
import { layout, radius, space, text } from "@/constants/design";

const TAB_CLEARANCE = 116;
const TOURNAMENT_GAMES = new Set(["largest_country", "photo_pose", "seasonal_selfie", "dog_reels", "number_trail", "steal_territory", "steal_road", "find_mafia"]);
const plays = (n: number) => `${n} ${n === 1 ? "play" : "plays"} this week`;
const DAY = 86_400_000;
const daysLeft = (iso: string, now: number) => {
  const d = Math.ceil((Date.parse(iso) - now) / DAY);
  return d <= 0 ? null : d === 1 ? "Last day" : `${d} days left`;
};

/** Each month's picture: what the theme looks like, drawn with one icon in layered circles. */
const SEASON_ICON: Record<number, typeof LeafIcon> = {
  1: SnowflakeIcon, 2: HeartIcon, 3: FlowerIcon, 4: UmbrellaIcon, 5: BasketIcon, 6: SunIcon,
  7: WavesIcon, 8: SunHorizonIcon, 9: BackpackIcon, 10: GhostIcon, 11: LeafIcon, 12: TreeEvergreenIcon,
};
const SEASON_COLORS: Record<string, { from: string; to: string }> = {
  winter: { from: "#6C9BE0", to: "#3E6BC2" },
  spring: { from: "#7DC896", to: "#3F8F62" },
  summer: { from: "#F7A84A", to: "#D9792A" },
  autumn: { from: "#F08A4B", to: "#C2552A" },
};
const SeasonArt = ({ month }: { month: number }) => {
  const Icon = SEASON_ICON[month] ?? LeafIcon;
  return (
    <View style={art.outer}>
      <View style={art.mid}>
        <View style={art.inner}>
          <Icon size={54} color="#FFFFFF" weight="fill" />
        </View>
      </View>
    </View>
  );
};

const current = (list: readonly MediaChallenge[] | undefined) => (list ?? []).filter((c) => !c.private && (c.phase === "entries" || c.phase === "voting")).sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0] ?? null;

/**
 * Game: the month's challenge and the week's news on top, then the modes, then the week's most played games. The Pet
 * Shop is the box at the top right. Every number shown comes from the server; nothing is made up.
 */
export default function GameTabScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  usePrefetchPetCatalog(dog.data?.id);
  const week = useGamesOfTheWeek();
  const overview = useTournamentOverview();
  const duels = useDuels(dog.data?.id);
  const seasonal = useSeasonalChallenges();
  const reels = useReelChallenges();
  const [making, setMaking] = useState(false);
  const now = overview.data ? Date.parse(overview.data.serverNow) : Date.now();

  // ---------- The news on top ----------
  const season = current(seasonal.data);
  const reel = current(reels.data);
  const lc = (overview.data?.tournaments ?? []).find((t) => t.gameType === "largest_country" && !t.private && t.phase === "active") ?? null;
  const month = new Date(now).getUTCMonth() + 1;
  const seasonName = (season?.instructions as { season?: string } | undefined)?.season ?? "autumn";

  const joinSeason = async () => {
    if (!season) return;
    try {
      if (!season.joined && season.phase === "entries") {
        await joinChallenge(season.tournamentId, dog.data?.id ?? null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void queryClient.invalidateQueries({ queryKey: poseKeys.seasonal });
      }
    } catch {
      // The challenge screen explains anything that went wrong; joining is offered there too.
    }
    router.push({ pathname: season.phase === "voting" ? "/game/tournament/pose-vote" : "/game/tournament/pose", params: { challengeId: season.challengeId } });
  };

  const slides: HeroSlide[] = [
    ...(season
      ? [
          {
            key: "seasonal",
            badge: season.phase === "voting" ? "Voting now" : "This month",
            title: season.title,
            line: season.phase === "voting" ? "Pick the best seasonal selfie." : "A seasonal selfie with your dog.",
            meta: daysLeft(season.phase === "entries" ? season.entriesCloseAt : season.endsAt, now),
            ...SEASON_COLORS[seasonName],
            ink: "#FFFFFF",
            soft: "rgba(255,255,255,0.86)",
            art: <SeasonArt month={month} />,
            cta: season.phase === "voting" ? "Vote!" : season.joined ? "Go!" : "Join!",
            onPress: () => void joinSeason(),
          } satisfies HeroSlide,
        ]
      : []),
    {
      key: "reels",
      badge: "New game",
      title: "Dog Reels Battle",
      line: reel ? `15 seconds of your dog. This week: ${reel.title}.` : "15 seconds of your dog. Most votes wins.",
      // A week that closed with no clips says when the next opens, not a countdown to an empty vote.
      meta: reel ? (reel.phase === "voting" && reel.entries === 0 ? "New theme Monday" : daysLeft(reel.phase === "entries" ? reel.entriesCloseAt : reel.endsAt, now)) : null,
      from: "#2E2C29",
      to: "#141312",
      ink: "#FFFFFF",
      soft: "#C9C5BC",
      art: (
        <View style={art.tile}>
          <TournamentArt game="dog_reels" width={112} height={112} />
        </View>
      ),
      cta: "Play!",
      onPress: () => router.push("/game/tournament/reels"),
    },
    {
      key: "tournament",
      badge: "This week",
      title: "Largest Country",
      line: lc && lc.participants > 0 ? `${lc.participants} walking. Biggest loop wins.` : "Walk one loop. Biggest territory wins.",
      meta: lc ? daysLeft(lc.endsAt, now) : null,
      from: "#5DAE7C",
      to: "#2F7653",
      ink: "#FFFFFF",
      soft: "rgba(255,255,255,0.86)",
      art: (
        <View style={art.tile}>
          <TournamentArt game="largest_country" width={112} height={112} />
        </View>
      ),
      cta: "Join!",
      onPress: () => router.push("/game/tournament/largest-country"),
    },
  ];

  // ---------- Modes ----------
  const games = week.data?.games ?? [];
  const top = (pick: (g: WeekGame) => boolean) => games.find(pick);
  const soloTop = top((g) => g.game.startsWith("challenge:"));
  const duelTop = top((g) => g.game === "longest_sit" || g.game === "trick_combo");
  const tourTop = top((g) => TOURNAMENT_GAMES.has(g.game));
  const waiting = (duels.data ?? []).filter((d) => d.myTurnOpen).length;
  const leader = games[0];
  const cards: DeckCard[] = [
    { key: "solo", title: "Solo", badge: leader && soloTop === leader ? "Most played" : "Just you", headline: soloTop ? `${weekMeta(soloTop)?.name}. ${plays(soloTop.plays)}` : "Find the Treat. 3 minutes to start.", color: "#3F7A5C", ink: "#FFFFFF", soft: "#D6EBDD", art: "challenge", onPress: () => router.push("/game/challenge") },
    { key: "duel", title: "Duel", badge: waiting > 0 ? "Your turn" : "1 on 1", headline: waiting > 0 ? `${waiting} ${waiting === 1 ? "duel waits" : "duels wait"} for you` : duelTop ? `${weekMeta(duelTop)?.name}. ${plays(duelTop.plays)}` : "Send a code. Best score wins.", color: "#B9552F", ink: "#FFFFFF", soft: "#F8DCCF", art: "duel", onPress: () => router.push("/game/duel") },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: TAB_CLEARANCE + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={week.isRefetching} onRefresh={() => void Promise.all([week.refetch(), overview.refetch(), duels.refetch(), seasonal.refetch(), reels.refetch()])} />}
      >
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            Play
          </Text>
          <View style={styles.actions}>
            <PlayMenu onJoin={() => router.push({ pathname: "/game/room/join", params: { mode: "nearby" } })} onMake={() => setMaking(true)} />
            <PressScale accessibilityRole="button" accessibilityLabel="Pet Shop" scaleTo={0.92} style={styles.shop} onPress={() => router.push("/game/shop")}>
              <PackageIcon size={24} color={text.primary} weight="bold" />
            </PressScale>
          </View>
        </View>

        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(260)} style={styles.hero}>
          <HeroDeck slides={slides} />
        </Animated.View>

        <Text style={styles.section} accessibilityRole="header">
          Modes
        </Text>
        <ModeDeck cards={cards} />

        <WeekBest games={week.data?.games} loading={week.isLoading} />
      </ScrollView>
      <MakeSheet visible={making} mode="nearby" game={null} onClose={() => setMaking(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter },
  title: { fontSize: 40, lineHeight: 44, fontWeight: "800", letterSpacing: -1.4, color: text.primary },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm },
  shop: { width: 48, height: 48, borderRadius: radius.pill, backgroundColor: "#F4F4F2", alignItems: "center", justifyContent: "center" },
  hero: { marginTop: space.xl },
  section: { fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.6, color: text.primary, paddingHorizontal: layout.gutter, marginTop: space.lg },
});

const art = StyleSheet.create({
  outer: { width: 132, height: 132, borderRadius: 66, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  mid: { width: 104, height: 104, borderRadius: 52, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  inner: { width: 78, height: 78, borderRadius: 39, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" },
  tile: { width: 112, height: 112, borderRadius: 28, overflow: "hidden", transform: [{ rotate: "-6deg" }] },
});
