import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CaretRightIcon, FilmSlateIcon, TrophyIcon, VideoCameraIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ReelPlayer } from "@/features/dogReels/components/ReelPlayer";
import { CLIP_SECONDS, REEL_ENTRY_TEXT, REEL_HELD_TEXT, reelError } from "@/features/dogReels/copy";
import { featuredOf, timingLine } from "@/features/photoPose/flow";
import { countLabel } from "@/features/photoPose/copy";
import { FriendCode } from "@/features/rooms/components/OnlineHub";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { poseKeys, useOwnPhotoUrl, useReelChallenges } from "@/hooks/usePhotoPose";
import { joinChallenge, type MediaChallenge } from "@/services/mediaService";
import { accent, bg, layout, motion, radius, space, text, type } from "@/constants/design";

/** What the bottom button does for this week, from the phase and your clip. */
const actionOf = (c: MediaChallenge) => {
  if (c.phase === "entries") {
    const e = c.myEntry;
    if (!e || e.status === "rejected") return { label: "Film your clip", sub: `Up to ${CLIP_SECONDS} seconds`, kind: "film" as const, tone: "yellow" as const };
    return { label: e.status === "held" ? "Film it again" : "Change your clip", kind: "film" as const, tone: e.status === "held" ? ("yellow" as const) : ("white" as const) };
  }
  // Nothing to watch: no button that leads to an empty screen.
  if (c.phase === "voting") return c.entries > 0 ? { label: c.myVote ? "Change your vote" : "Watch and vote", kind: "vote" as const, tone: "yellow" as const } : null;
  if (c.phase === "completed") return { label: "See the winners", kind: "results" as const, tone: "white" as const };
  return null;
};

/**
 * Dog Reels Battle: this week's theme, your clip, and the weeks before. A friend battle opens here by its challenge id
 * and shows its code to share.
 */
export default function ReelsScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const { challengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const challenges = useReelChallenges();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const all = challenges.data ?? [];
  const publicWeeks = all.filter((c) => !c.private);
  const c = (challengeId ? all.find((x) => x.challengeId === challengeId) : null) ?? featuredOf(publicWeeks);
  const past = publicWeeks.filter((x) => x.phase === "completed" && x.challengeId !== c?.challengeId);
  const now = c ? Date.parse(c.serverNow) : Date.now();
  const action = c ? actionOf(c) : null;
  const mine = c?.myEntry && c.myEntry.status !== "withdrawn" ? c.myEntry : null;
  const poster = useOwnPhotoUrl(mine?.posterPath ?? undefined);
  const clip = useOwnPhotoUrl(mine?.mediaPath ?? undefined);
  const steps = (c?.instructions?.steps ?? []) as string[];
  const loadError = (challenges.error as { code?: string } | null)?.code;

  const onAction = async () => {
    if (!c || !action) return;
    setError(null);
    if (action.kind === "vote") return router.push({ pathname: "/game/tournament/reels-vote", params: { challengeId: c.challengeId } });
    if (action.kind === "results") return router.push({ pathname: "/game/tournament/reels-results", params: { challengeId: c.challengeId } });
    if (!c.joined) {
      setBusy(true);
      try {
        await joinChallenge(c.tournamentId, dog.data?.id ?? null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await queryClient.invalidateQueries({ queryKey: poseKeys.reels });
      } catch (e) {
        setError(reelError((e as { code?: string }).code));
        return;
      } finally {
        setBusy(false);
      }
    }
    router.push({ pathname: "/game/tournament/reels-record", params: { challengeId: c.challengeId } });
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={challenges.isRefetching} onRefresh={() => void challenges.refetch()} />}
      >
        <View style={styles.top}>
          <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => goBack("/game/tournament?mode=online")}>
            <CaretLeftIcon size={22} color={text.primary} weight="bold" />
          </PressScale>
        </View>

        {challenges.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={text.secondary} />
          </View>
        ) : !c ? (
          <View style={styles.empty}>
            <FilmSlateIcon size={40} color={text.tertiary} weight="duotone" />
            <Text style={styles.emptyTitle}>{loadError ? reelError(loadError) : "This week's theme opens soon"}</Text>
          </View>
        ) : (
          <Animated.View entering={reduceMotion ? FadeIn.duration(motion.duration.enter) : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })} style={styles.body}>
            {c.private && c.inviteCode ? <FriendCode code={c.inviteCode} game="Dog Reels" /> : null}
            {/* The theme, cinema dark. */}
            <View style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{c.private ? "With friends" : c.phase === "voting" ? (c.entries === 0 ? "Closed" : "Voting now") : c.phase === "completed" ? "Finished" : "This week"}</Text>
                </View>
                <VideoCameraIcon size={22} color={accent.deep} weight="fill" />
              </View>
              <Text style={styles.theme}>{c.title}</Text>
              <Text style={styles.brief}>{c.brief}</Text>
              <View style={styles.facts}>
                <Text style={styles.fact}>{`${CLIP_SECONDS} s`}</Text>
                <View style={styles.dot} />
                <Text style={styles.fact}>{countLabel(c.entries, "clip", "clips")}</Text>
                {timingLine(c, now) && !(c.phase === "voting" && c.entries === 0) ? (
                  <>
                    <View style={styles.dot} />
                    <Text style={styles.fact}>{timingLine(c, now)}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {steps.length ? (
              <View style={styles.steps}>
                {steps.slice(0, 4).map((s, i) => (
                  <View key={s} style={styles.step}>
                    <Text style={styles.stepNo}>{i + 1}</Text>
                    <Text style={styles.stepText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {c.phase === "voting" && c.entries === 0 ? (
              <View style={styles.quiet}>
                <FilmSlateIcon size={22} color={text.secondary} weight="duotone" />
                <Text style={styles.quietText}>{c.private ? "No clips in this battle." : "No clips this week. A new theme opens Monday."}</Text>
              </View>
            ) : null}

            {mine ? (
              <View style={styles.mine}>
                <ReelPlayer url={clip.data ?? null} poster={poster.data ?? null} style={styles.mineClip} />
                <View style={styles.flex}>
                  <Text style={styles.mineTitle}>{REEL_ENTRY_TEXT[mine.status as Exclude<typeof mine.status, "withdrawn">]?.title ?? "Your clip"}</Text>
                  <Text style={styles.mineLine}>{mine.status === "held" && mine.heldReason ? REEL_HELD_TEXT[mine.heldReason] : REEL_ENTRY_TEXT[mine.status as Exclude<typeof mine.status, "withdrawn">]?.line}</Text>
                </View>
              </View>
            ) : null}

            {past.length ? (
              <>
                <Text style={styles.section}>Past weeks</Text>
                {past.slice(0, 6).map((p) => (
                  <PressScale key={p.challengeId} accessibilityRole="button" accessibilityLabel={`${p.title}. See the winners`} scaleTo={0.98} style={styles.pastRow} onPress={() => router.push({ pathname: "/game/tournament/reels-results", params: { challengeId: p.challengeId } })}>
                    <TrophyIcon size={18} color={accent.band} weight="fill" />
                    <Text style={styles.pastTitle} numberOfLines={1}>
                      {p.title}
                    </Text>
                    <Text style={styles.pastMeta}>{countLabel(p.entries, "clip", "clips")}</Text>
                    <CaretRightIcon size={16} color={text.tertiary} weight="bold" />
                  </PressScale>
                ))}
              </>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </Animated.View>
        )}
      </ScrollView>
      {c && action ? (
        <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
          <RaisedButton label={action.label} sub={"sub" in action ? action.sub : undefined} tone={action.tone} busy={busy} onPress={() => void onAction()} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  flex: { flex: 1 },
  top: { paddingHorizontal: layout.gutter, flexDirection: "row" },
  back: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: "#E8E7E2", alignItems: "center", justifyContent: "center" },
  center: { paddingTop: 120, alignItems: "center" },
  empty: { alignItems: "center", gap: space.md, paddingTop: 120, paddingHorizontal: layout.gutter },
  emptyTitle: { ...type.cardTitle, fontWeight: "800", color: text.secondary, textAlign: "center" },
  body: { paddingHorizontal: layout.gutter, paddingTop: space.lg },
  hero: { borderRadius: 30, backgroundColor: text.primary, padding: space.xl, gap: space.sm },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm },
  badge: { height: 30, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  badgeText: { fontSize: 13, fontWeight: "800", color: text.primary },
  theme: { fontSize: 38, lineHeight: 42, fontWeight: "800", letterSpacing: -1.4, color: "#FFFFFF" },
  brief: { fontSize: 16, lineHeight: 22, fontWeight: "600", color: "#C9C5BC" },
  facts: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: space.sm },
  fact: { fontSize: 13, fontWeight: "800", color: accent.deep },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#6B675F" },
  steps: { marginTop: space.lg, gap: space.sm },
  step: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 18, backgroundColor: bg.subtle },
  stepNo: { width: 28, height: 28, borderRadius: 14, overflow: "hidden", backgroundColor: "#FFFFFF", textAlign: "center", lineHeight: 28, fontSize: 14, fontWeight: "800", color: text.primary },
  stepText: { flex: 1, fontSize: 15, fontWeight: "700", color: text.primary },
  quiet: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: 18, backgroundColor: bg.subtle },
  quietText: { flex: 1, fontSize: 15, fontWeight: "700", color: text.secondary },
  mine: { flexDirection: "row", alignItems: "center", gap: space.lg, marginTop: space.xl, padding: space.md, borderRadius: 22, backgroundColor: accent.soft },
  mineClip: { width: 72, height: 128, borderRadius: 16 },
  mineTitle: { fontSize: 18, fontWeight: "800", color: text.primary },
  mineLine: { ...type.supporting, color: text.secondary, marginTop: 4 },
  section: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: text.primary, marginTop: space.section, marginBottom: space.sm },
  pastRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 56, paddingHorizontal: space.lg, borderRadius: 18, backgroundColor: bg.subtle, marginTop: space.sm },
  pastTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: text.primary },
  pastMeta: { fontSize: 13, fontWeight: "700", color: text.secondary },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas },
});
