import { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ArrowsCounterClockwiseIcon, CaretRightIcon, FlagIcon, MapTrifoldIcon, PathIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { FriendCode } from "@/features/rooms/components/OnlineHub";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { LARGEST_COUNTRY } from "@/features/tournament/catalog";
import { TournamentArt } from "@/features/tournament/components/TournamentArt";
import { TournamentLeaderboard } from "@/features/tournament/components/TournamentLeaderboard";
import { TournamentRulesModal } from "@/features/tournament/components/TournamentRulesModal";
import { TournamentStatusBadge, type BadgeKind } from "@/features/tournament/components/TournamentStatusBadge";
import { PHASE_LABEL, errorText, formatArea, formatCountdown, formatPeriod, formatWhen } from "@/features/tournament/format";
import { tournamentKeys, useTournamentBoard, useTournamentOverview } from "@/hooks/useTournaments";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { joinTournament, type TournamentSummary } from "@/services/tournamentService";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

const PRIORITY = { active: 0, registration: 1, upcoming: 2, completed: 3, cancelled: 4 } as const;
const BADGE: Record<TournamentSummary["phase"], BadgeKind> = { active: "live", registration: "open", upcoming: "upcoming", completed: "finished", cancelled: "cancelled" };
const BAR = 104;

/** Make the Largest Country: how it works, the current tournament, your best, the top of the board, and Play. */
export default function LargestCountryScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const overview = useTournamentOverview();
  const params = useLocalSearchParams<{ id?: string }>();
  const [rules, setRules] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = overview.data ? Date.parse(overview.data.serverNow) : Date.now();
  // A friend battle opens by its id; otherwise this week's public game.
  const tournament =
    (params.id ? (overview.data?.tournaments ?? []).find((t) => t.id === params.id) : null) ??
    ((overview.data?.tournaments ?? [])
      .filter((t) => t.gameType === "largest_country" && !t.private)
      .sort((a, b) => PRIORITY[a.phase] - PRIORITY[b.phase] || Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null);
  const board = useTournamentBoard(tournament?.id);
  const openHere = overview.data?.openSession?.tournament_id === tournament?.id ? overview.data?.openSession : null;
  const setupError = (overview.error as { code?: string } | null)?.code;

  const join = async () => {
    if (!tournament) return;
    setJoining(true);
    setError(null);
    try {
      await joinTournament(tournament.id, dog.data?.id ?? null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: tournamentKeys.overview });
    } catch (e) {
      setError(errorText((e as { code?: string }).code));
    } finally {
      setJoining(false);
    }
  };
  const walk = () => tournament && router.push({ pathname: "/game/tournament/walk", params: { id: tournament.id } });

  const action = (() => {
    if (!tournament) return null;
    if (tournament.phase === "completed") return { label: "See final results", tone: "white" as const, onPress: () => router.push({ pathname: "/game/tournament/leaderboard", params: { id: tournament.id } }) };
    if (tournament.phase === "cancelled" || tournament.phase === "upcoming") return null;
    if (!tournament.joined) return { label: "Join tournament", sub: "Free to enter", tone: "yellow" as const, onPress: () => void join(), busy: joining };
    if (tournament.phase === "registration") return { label: "You're in", sub: formatCountdown(tournament.startsAt, now, "Starts") ?? undefined, tone: "white" as const, onPress: () => undefined, disabled: true };
    return { label: openHere ? "Continue your walk" : "Start walking", tone: "yellow" as const, onPress: walk };
  })();

  return (
    <View style={styles.flex}>
      <DetailShell title="Largest Country" glyph={<MapTrifoldIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament">
        {tournament?.private && tournament.inviteCode ? <FriendCode code={tournament.inviteCode} game="Largest Country" /> : null}
        <View style={styles.hero}>
          <TournamentArt game="largest_country" width={width - layout.gutter * 2} height={196} />
        </View>
        <Text style={styles.title}>{LARGEST_COUNTRY.title}</Text>
        <Text style={styles.tagline}>Walk one loop, anywhere. Biggest wins.</Text>

        <View style={styles.how}>
          <How icon={<PathIcon size={20} color={text.primary} weight="bold" />} label="Walk a loop" />
          <How icon={<FlagIcon size={20} color={text.primary} weight="fill" />} label="Back to start" />
          <How icon={<ArrowsCounterClockwiseIcon size={20} color={text.primary} weight="bold" />} label="Biggest wins" />
        </View>
        <PressScale accessibilityRole="button" accessibilityLabel="Read the rules" style={styles.rulesLink} onPress={() => setRules(true)}>
          <Text style={styles.rulesText}>Rules and safety</Text>
          <CaretRightIcon size={16} color={text.primary} weight="bold" />
        </PressScale>

        {setupError ? (
          <Text style={styles.empty}>{errorText(setupError)}</Text>
        ) : !tournament ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No tournament right now</Text>
            <Text style={styles.cardLine}>The PAWS team schedules each tournament. When the next one opens, you'll find it here.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <TournamentStatusBadge kind={BADGE[tournament.phase]} label={PHASE_LABEL[tournament.phase]} />
              <Text style={styles.period}>{formatPeriod(tournament.startsAt, tournament.endsAt)}</Text>
            </View>
            <Text style={styles.cardTitle}>{tournament.name}</Text>
            {tournament.description ? <Text style={styles.cardLine}>{tournament.description}</Text> : null}
            <View style={styles.facts}>
              <Fact label="Players" value={String(tournament.participants)} />
              <Fact label="Your best" value={tournament.myBestM2 ? formatArea(tournament.myBestM2) : "-"} />
              <Fact label={formatWhen(tournament, now).label} value={formatWhen(tournament, now).value} />
            </View>
            {overview.data?.allTimeBestM2 && overview.data.allTimeBestM2 !== tournament.myBestM2 ? (
              <Text style={styles.allTime}>{`All-time best ${formatArea(overview.data.allTimeBestM2)}`}</Text>
            ) : null}
          </View>
        )}

        {tournament && board.data?.rows.length ? (
          <>
            <View style={styles.boardHead}>
              <Text style={styles.section}>Leaderboard</Text>
              <PressScale accessibilityRole="button" accessibilityLabel="See full leaderboard" onPress={() => router.push({ pathname: "/game/tournament/leaderboard", params: { id: tournament.id } })}>
                <Text style={styles.seeAll}>See all</Text>
              </PressScale>
            </View>
            <TournamentLeaderboard rows={board.data.rows} limit={5} />
          </>
        ) : tournament && (tournament.phase === "active" || tournament.phase === "completed") ? (
          <Text style={styles.empty}>No territories claimed yet. The first loop takes the top spot.</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: BAR + insets.bottom }} />
      </DetailShell>

      {action ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
          <RaisedButton label={action.label} sub={"sub" in action ? action.sub : undefined} tone={action.tone} busy={"busy" in action ? action.busy : false} disabled={"disabled" in action ? action.disabled : false} onPress={action.onPress} />
        </View>
      ) : null}

      <TournamentRulesModal visible={rules} onClose={() => setRules(false)} />
    </View>
  );
}

const How = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <View style={styles.howItem}>
    <View style={styles.howIcon}>{icon}</View>
    <Text style={styles.howLabel}>{label}</Text>
  </View>
);

const Fact = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.fact}>
    <Text style={styles.factValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.factLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  hero: { height: 196, borderRadius: 28, overflow: "hidden", marginTop: space.sm, backgroundColor: bg.subtle },
  title: { fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.6, color: text.primary, marginTop: space.xl },
  tagline: { ...type.body, color: text.secondary, marginTop: 4 },
  how: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  howItem: { flex: 1, alignItems: "center", gap: space.sm, paddingVertical: space.md, borderRadius: radius.card, backgroundColor: accent.soft },
  howIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  howLabel: { fontSize: 13, fontWeight: "700", color: text.primary },
  rulesLink: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: space.md, paddingVertical: space.xs },
  rulesText: { ...type.supporting, fontWeight: "700", color: text.primary, textDecorationLine: "underline" },
  card: { marginTop: space.xl, padding: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  period: { ...type.caption, fontWeight: "700", color: text.secondary },
  cardTitle: { ...type.cardTitle, fontSize: 18, fontWeight: "800", color: text.primary, marginTop: space.md },
  cardLine: { ...type.supporting, color: text.secondary, marginTop: 4 },
  facts: { flexDirection: "row", marginTop: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  fact: { flex: 1 },
  factValue: { fontSize: 17, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  factLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  allTime: { ...type.caption, color: text.secondary, marginTop: space.md },
  boardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.section, marginBottom: space.md },
  section: { ...type.sectionTitle, color: text.primary },
  seeAll: { ...type.supporting, fontWeight: "700", color: accent.band },
  empty: { ...type.supporting, color: text.secondary, marginTop: space.xl },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
