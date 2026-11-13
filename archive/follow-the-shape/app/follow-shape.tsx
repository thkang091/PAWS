import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CompassIcon, PathIcon, ShieldCheckIcon, StarIcon, TargetIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { FOLLOW_SHAPE } from "@/features/tournament/catalog";
import { ShapeGlyph } from "@/features/tournament/components/ShapeGlyph";
import { TournamentLeaderboard } from "@/features/tournament/components/TournamentLeaderboard";
import { TournamentStatusBadge, type BadgeKind } from "@/features/tournament/components/TournamentStatusBadge";
import { PHASE_LABEL, errorText, formatCountdown, formatDistance, formatPeriod, formatPoints, formatWhen } from "@/features/tournament/format";
import { tournamentKeys, useTournamentBoard, useTournamentOverview } from "@/hooks/useTournaments";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { joinTournament, type ShapeTier, type TournamentSummary } from "@/services/tournamentService";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

const PRIORITY = { active: 0, registration: 1, upcoming: 2, completed: 3, cancelled: 4 } as const;
const BADGE: Record<TournamentSummary["phase"], BadgeKind> = { active: "live", registration: "open", upcoming: "upcoming", completed: "finished", cancelled: "cancelled" };
const DIFFICULTY = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;
const BAR = 104;

/** Follow the Shape: this tournament's target, how it is scored, where you stand, and Start. */
export default function FollowShapeScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const overview = useTournamentOverview();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = overview.data ? Date.parse(overview.data.serverNow) : Date.now();
  const tournament =
    (overview.data?.tournaments ?? [])
      .filter((t) => t.gameType === "follow_shape")
      .sort((a, b) => PRIORITY[a.phase] - PRIORITY[b.phase] || Date.parse(a.startsAt) - Date.parse(b.startsAt))[0] ?? null;
  const shape = tournament?.shape ?? null;
  const [tier, setTier] = useState<ShapeTier>(shape?.difficulty ?? "easy");
  const board = useTournamentBoard(tournament?.id, tier);
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

  const action = (() => {
    if (!tournament || !shape) return null;
    if (tournament.phase === "completed") return { label: "See final results", tone: "white" as const, onPress: () => router.push({ pathname: "/game/tournament/leaderboard", params: { id: tournament.id } }) };
    if (tournament.phase === "cancelled" || tournament.phase === "upcoming") return null;
    if (!tournament.joined) return { label: "Join tournament", sub: "Free to enter", tone: "yellow" as const, onPress: () => void join(), busy: joining };
    if (tournament.phase === "registration") return { label: "You're in", sub: formatCountdown(tournament.startsAt, now, "Starts") ?? undefined, tone: "white" as const, onPress: () => undefined, disabled: true };
    return {
      label: openHere ? "Continue your walk" : "Choose a shape",
      sub: openHere ? undefined : "Then pick a real walking route",
      tone: "yellow" as const,
      onPress: () =>
        openHere
          ? router.push({ pathname: "/game/tournament/shape-walk", params: { id: tournament.id } })
          : router.push({ pathname: "/game/tournament/shapes", params: { id: tournament.id } }),
    };
  })();

  return (
    <View style={styles.flex}>
      <DetailShell title="Follow the Shape" glyph={<StarIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament">
        <View style={styles.hero}>
          {shape ? <ShapeGlyph points={shape.points} closed={shape.closed} size={168} strokeWidth={6} /> : <TargetIcon size={56} color={text.tertiary} weight="duotone" />}
          {shape ? (
            <View style={styles.heroTags}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{shape.name}</Text>
              </View>
              <View style={[styles.tag, styles.tagQuiet]}>
                <Text style={styles.tagText}>{DIFFICULTY[shape.difficulty]}</Text>
              </View>
            </View>
          ) : null}
        </View>
        <Text style={styles.title}>{FOLLOW_SHAPE.title}</Text>
        <Text style={styles.tagline}>Pick a shape, get a real walking route shaped like it, and walk it with your dog.</Text>

        <View style={styles.how}>
          <How icon={<CompassIcon size={20} color={text.primary} weight="fill" />} label="Pick a shape" />
          <How icon={<PathIcon size={20} color={text.primary} weight="bold" />} label="Walk the route" />
          <How icon={<TargetIcon size={20} color={text.primary} weight="fill" />} label="Best match wins" />
        </View>
        <View style={styles.safety}>
          <ShieldCheckIcon size={18} color={text.primary} weight="fill" />
          <Text style={styles.safetyText}>
            Routes follow real public streets and paths from the map, never shortcuts. Maps can be wrong: watch for traffic, cross only at crossings, and keep your dog on a lead near roads.
          </Text>
        </View>

        {setupError ? (
          <Text style={styles.empty}>{errorText(setupError)}</Text>
        ) : !tournament || !shape ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No shape this week</Text>
            <Text style={styles.cardLine}>The PAWS team picks a shape for each tournament. When the next one opens, you'll find it here.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <TournamentStatusBadge kind={BADGE[tournament.phase]} label={PHASE_LABEL[tournament.phase]} />
              <Text style={styles.period}>{formatPeriod(tournament.startsAt, tournament.endsAt)}</Text>
            </View>
            <Text style={styles.cardTitle}>{tournament.name}</Text>
            <View style={styles.facts}>
              <Fact label="Players" value={String(tournament.participants)} />
              <Fact label="Your best" value={tournament.myBest != null ? `${formatPoints(tournament.myBest)}` : "-"} />
              <Fact label={formatWhen(tournament, now).label} value={formatWhen(tournament, now).value} />
            </View>
            <Text style={styles.minimum}>{`Walk at least ${formatDistance(shape.minDistanceM)} for it to count.`}</Text>
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
            <TierTabs value={tier} onChange={setTier} />
            <TournamentLeaderboard rows={board.data.rows} unit="points" limit={5} />
          </>
        ) : tournament && (tournament.phase === "active" || tournament.phase === "completed") ? (
          <>
            <View style={styles.boardHead}>
              <Text style={styles.section}>Leaderboard</Text>
            </View>
            <TierTabs value={tier} onChange={setTier} />
            <Text style={styles.empty}>{`No ${DIFFICULTY[tier].toLowerCase()} shapes handed in yet. The first good one takes the top spot.`}</Text>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: BAR + insets.bottom }} />
      </DetailShell>

      {action ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
          <RaisedButton label={action.label} sub={"sub" in action ? action.sub : undefined} tone={action.tone} busy={"busy" in action ? action.busy : false} disabled={"disabled" in action ? action.disabled : false} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

/** Players choose their shape, so each difficulty has its own board. */
const TierTabs = ({ value, onChange }: { value: ShapeTier; onChange: (t: ShapeTier) => void }) => (
  <View style={styles.tiers} accessibilityRole="tablist">
    {(["easy", "medium", "hard"] as ShapeTier[]).map((t) => (
      <PressScale key={t} accessibilityRole="tab" accessibilityState={{ selected: value === t }} style={[styles.tierTab, value === t && styles.tierOn]} onPress={() => onChange(t)}>
        <Text style={[styles.tierText, value === t && styles.tierTextOn]}>{DIFFICULTY[t]}</Text>
      </PressScale>
    ))}
  </View>
);

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
  hero: { height: 236, borderRadius: 28, marginTop: space.sm, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  heroTags: { position: "absolute", top: space.md, left: space.md, flexDirection: "row", gap: space.sm },
  tag: { height: 26, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  tagQuiet: { backgroundColor: bg.surface },
  tagText: { fontSize: 12, fontWeight: "800", color: text.primary },
  title: { fontSize: 26, lineHeight: 31, fontWeight: "800", letterSpacing: -0.6, color: text.primary, marginTop: space.xl },
  tagline: { ...type.body, color: text.secondary, marginTop: 4 },
  how: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  howItem: { flex: 1, alignItems: "center", gap: space.sm, paddingVertical: space.md, borderRadius: radius.card, backgroundColor: accent.soft },
  howIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  howLabel: { fontSize: 13, fontWeight: "700", color: text.primary },
  safety: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", marginTop: space.lg },
  safetyText: { ...type.caption, color: text.secondary, flex: 1 },
  card: { marginTop: space.xl, padding: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  period: { ...type.caption, fontWeight: "700", color: text.secondary },
  cardTitle: { ...type.cardTitle, fontSize: 18, fontWeight: "800", color: text.primary, marginTop: space.md },
  cardLine: { ...type.supporting, color: text.secondary, marginTop: 4 },
  facts: { flexDirection: "row", marginTop: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  fact: { flex: 1 },
  factValue: { fontSize: 17, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  factLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  minimum: { ...type.caption, color: text.secondary, marginTop: space.md },
  boardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.section, marginBottom: space.md },
  section: { ...type.sectionTitle, color: text.primary },
  tiers: { flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.pill, backgroundColor: bg.subtle, marginBottom: space.md },
  tierTab: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tierOn: { backgroundColor: bg.surface },
  tierText: { fontSize: 13, fontWeight: "700", color: text.secondary },
  tierTextOn: { color: text.primary, fontWeight: "800" },
  seeAll: { ...type.supporting, fontWeight: "700", color: accent.band },
  empty: { ...type.supporting, color: text.secondary, marginTop: space.xl },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
