import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraIcon, CaretLeftIcon, CaretRightIcon, ShieldCheckIcon, SparkleIcon, TrophyIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { goBack } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { Chip, PoseFacts, PoseImage, SectionTitle } from "@/features/photoPose/components/PoseParts";
import { CATEGORY_LABEL, PHASE_LABEL, countLabel, poseError } from "@/features/photoPose/copy";
import { featuredOf, timingLine } from "@/features/photoPose/flow";
import { DEFAULT_PREFS, recommendPoses, type LibraryPose, type PosePrefs } from "@/features/photoPose/recommend";
import { TournamentStatusBadge, type BadgeKind } from "@/features/tournament/components/TournamentStatusBadge";
import { useModerationQueue, usePoseChallenges, usePoseLibrary, useReferenceUrl } from "@/hooks/usePhotoPose";
import { useOrganizer } from "@/hooks/useRegions";
import type { MediaChallenge, MediaPhase } from "@/services/mediaService";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";
import type { PoseCategory } from "../../../supabase/functions/media/poses";

const BADGE: Record<MediaPhase, BadgeKind> = { entries: "live", voting: "live", registration: "open", upcoming: "upcoming", completed: "finished", cancelled: "cancelled" };
const VIBES: PoseCategory[] = ["funny", "cute", "matching", "creative", "trick"];

/** Photo Pose Challenge: this week's pose, front and centre, then more poses to try and past results. */
export default function PhotoPoseScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const challenges = usePoseChallenges();
  const lib = usePoseLibrary();
  const organizer = useOrganizer();
  const [prefs, setPrefs] = useState<PosePrefs>(DEFAULT_PREFS);

  // Friend battles have their own entry point (the friends button); this screen is the public week.
  const list = (challenges.data ?? []).filter((c) => !c.private);
  const now = list[0] ? Date.parse(list[0].serverNow) : Date.now();
  const featured = featuredOf(list);
  const others = list.filter((c) => c.challengeId !== featured?.challengeId && c.phase !== "completed" && c.phase !== "cancelled");
  const past = list.filter((c) => c.phase === "completed" && c.challengeId !== featured?.challengeId);
  const running = new Set(list.filter((c) => c.phase !== "completed").map((c) => c.instructions?.conceptId).filter(Boolean) as string[]);
  const ideas = useMemo(() => recommendPoses(lib.data ?? [], prefs, now, 6, [...running]), [lib.data, prefs, now, running.size]); // eslint-disable-line react-hooks/exhaustive-deps
  const code = (challenges.error as { code?: string } | null)?.code;

  const toggleVibe = (v: PoseCategory) => setPrefs((p) => ({ ...p, vibes: p.vibes.includes(v) ? p.vibes.filter((x) => x !== v) : [...p.vibes, v] }));

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.section }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={challenges.isRefetching} onRefresh={() => void Promise.all([challenges.refetch(), lib.refetch()])} />}
      >
        <View style={styles.top}>
          <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={() => goBack("/game/tournament")}>
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          </PressScale>
          <Text style={styles.topTitle}>Photo Pose</Text>
          <View style={styles.spacer} />
        </View>

        {challenges.isPending ? (
          <View style={styles.loading}>
            <ActivityIndicator color={text.secondary} />
          </View>
        ) : code ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Couldn't load the challenge</Text>
            <Text style={styles.emptyLine}>{poseError(code)}</Text>
            <RaisedButton tone="white" label="Try again" onPress={() => void challenges.refetch()} style={styles.emptyButton} />
          </View>
        ) : featured ? (
          <Featured challenge={featured} now={now} />
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyDisc}>
              <CameraIcon size={28} color={text.primary} weight="fill" />
            </View>
            <Text style={styles.emptyTitle}>No pose this week</Text>
            <Text style={styles.emptyLine}>The PAWS team picks a pose for each challenge. When the next one opens, it's here.</Text>
          </View>
        )}

        {others.length ? (
          <>
            <SectionTitle>Also running</SectionTitle>
            <View style={{ gap: space.sm }}>
              {others.map((c) => (
                <ChallengeRow key={c.challengeId} challenge={c} now={now} />
              ))}
            </View>
          </>
        ) : null}

        {(lib.data?.length ?? 0) > 0 ? (
          <>
            <SectionTitle>More poses to try</SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
              {VIBES.map((v) => (
                <Chip key={v} label={CATEGORY_LABEL[v]} on={prefs.vibes.includes(v)} onPress={() => toggleVibe(v)} />
              ))}
              <Chip label="No props" on={prefs.noProps} onPress={() => setPrefs((p) => ({ ...p, noProps: !p.noProps }))} />
              <Chip label="Easy only" on={prefs.easyOnly} onPress={() => setPrefs((p) => ({ ...p, easyOnly: !p.easyOnly }))} />
            </ScrollView>
            {ideas.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ideas} style={styles.ideaScroll} decelerationRate="fast" snapToInterval={IDEA_W + space.md}>
                {ideas.map((p, i) => (
                  <Animated.View key={p.id} entering={reduceMotion ? undefined : FadeIn.delay(i * motion.stagger).duration(motion.duration.enter)}>
                    <IdeaCard pose={p} />
                  </Animated.View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.note}>No poses match those filters yet.</Text>
            )}
          </>
        ) : null}

        {past.length ? (
          <>
            <SectionTitle>Past challenges</SectionTitle>
            <View style={{ gap: space.sm }}>
              {past.slice(0, 5).map((c) => (
                <ChallengeRow key={c.challengeId} challenge={c} now={now} />
              ))}
            </View>
          </>
        ) : null}

        {organizer.data === true ? <OrganizerTools /> : null}
      </ScrollView>
    </View>
  );
}

const Featured = ({ challenge: c, now }: { challenge: MediaChallenge; now: number }) => {
  const ref = useReferenceUrl(c.referencePath);
  const timing = timingLine(c, now);
  const i = c.instructions ?? {};
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`${c.title}. ${PHASE_LABEL[c.phase]}. Open the challenge`} scaleTo={0.985} onPress={() => router.push({ pathname: "/game/tournament/pose", params: { challengeId: c.challengeId } })}>
      <View style={styles.hero}>
        <PoseImage url={ref.data} loading={ref.isPending && !!c.referencePath} failed={ref.isError} accessibilityLabel={`Reference photo: ${c.title}`} />
        <View style={styles.heroBadge}>
          <TournamentStatusBadge kind={BADGE[c.phase]} label={PHASE_LABEL[c.phase]} />
        </View>
      </View>
      <Text style={styles.heroTitle}>{c.title}</Text>
      {c.brief ? <Text style={styles.heroBrief}>{c.brief}</Text> : null}
      <View style={styles.heroFacts}>
        <PoseFacts difficulty={i.difficulty} minutes={i.setupMinutes} objects={i.requiredObjects ?? []} />
      </View>
      <View style={styles.heroFoot}>
        <Text style={styles.heroTiming}>{[timing, c.entries ? countLabel(c.entries, "photo", "photos") : null].filter(Boolean).join("  ·  ")}</Text>
        <View style={styles.heroGo}>
          <Text style={styles.heroGoText}>Open</Text>
          <CaretRightIcon size={14} color={text.primary} weight="bold" />
        </View>
      </View>
    </PressScale>
  );
};

const ChallengeRow = ({ challenge: c, now }: { challenge: MediaChallenge; now: number }) => {
  const ref = useReferenceUrl(c.referencePath);
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${c.title}. ${PHASE_LABEL[c.phase]}`}
      style={styles.row}
      onPress={() => router.push({ pathname: c.phase === "completed" ? "/game/tournament/pose-results" : "/game/tournament/pose", params: { challengeId: c.challengeId } })}
    >
      <PoseImage url={ref.data} loading={ref.isPending && !!c.referencePath} aspect={1} rounded={14} style={styles.rowThumb} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {c.title}
        </Text>
        <Text style={styles.rowLine} numberOfLines={1}>
          {c.phase === "completed" ? countLabel(c.entries, "photo", "photos") : (timingLine(c, now) ?? PHASE_LABEL[c.phase])}
        </Text>
      </View>
      {c.phase === "completed" ? <TrophyIcon size={18} color={accent.band} weight="fill" /> : <CaretRightIcon size={16} color={text.tertiary} weight="bold" />}
    </PressScale>
  );
};

const IDEA_W = 168;

const IdeaCard = ({ pose }: { pose: LibraryPose }) => {
  const ref = useReferenceUrl(pose.referencePath);
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`${pose.title}. ${CATEGORY_LABEL[pose.category]}`} style={styles.idea} onPress={() => router.push({ pathname: "/game/tournament/pose", params: { conceptId: pose.id } })}>
      <PoseImage url={ref.data} loading={ref.isPending && !!pose.referencePath} rounded={16} />
      <Text style={styles.ideaTitle} numberOfLines={2}>
        {pose.title}
      </Text>
      <Text style={styles.ideaLine}>{`${CATEGORY_LABEL[pose.category]}${pose.entered ? "  ·  Done" : ""}`}</Text>
    </PressScale>
  );
};

const OrganizerTools = () => {
  const queue = useModerationQueue();
  const waiting = queue.data?.length ?? 0;
  return (
    <View style={styles.tools}>
      <Text style={styles.toolsTitle}>Organizer</Text>
      <PressScale accessibilityRole="button" style={styles.tool} onPress={() => router.push("/game/tournament/pose-studio")}>
        <SparkleIcon size={20} color={text.primary} weight="fill" />
        <Text style={styles.toolText}>Pose studio</Text>
        <CaretRightIcon size={16} color={text.tertiary} weight="bold" />
      </PressScale>
      <PressScale accessibilityRole="button" style={styles.tool} onPress={() => router.push("/game/tournament/pose-moderation")}>
        <ShieldCheckIcon size={20} color={text.primary} weight="fill" />
        <Text style={styles.toolText}>Review photos</Text>
        {waiting ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{waiting}</Text>
          </View>
        ) : null}
        <CaretRightIcon size={16} color={text.tertiary} weight="bold" />
      </PressScale>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  content: { paddingHorizontal: layout.gutter },
  flex: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.lg },
  back: { width: layout.iconButton, height: layout.iconButton, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  spacer: { width: layout.iconButton, height: layout.iconButton },
  topTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  loading: { height: 360, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 28, overflow: "hidden" },
  heroBadge: { position: "absolute", top: space.md, left: space.md },
  heroTitle: { ...type.pageTitle, fontWeight: "800", color: text.primary, marginTop: space.lg },
  heroBrief: { ...type.body, color: text.secondary, marginTop: space.xs },
  heroFacts: { marginTop: space.md },
  heroFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.md },
  heroTiming: { ...type.supporting, fontWeight: "600", color: text.secondary, flex: 1 },
  heroGo: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  heroGoText: { fontSize: 13, fontWeight: "800", color: text.primary },
  empty: { alignItems: "center", paddingVertical: space.sectionLg, paddingHorizontal: space.lg, borderRadius: 28, backgroundColor: bg.stage, gap: space.sm },
  emptyDisc: { width: 60, height: 60, borderRadius: 30, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  emptyTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary, textAlign: "center" },
  emptyLine: { ...type.supporting, color: text.secondary, textAlign: "center", maxWidth: 300 },
  emptyButton: { alignSelf: "stretch", marginTop: space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, paddingRight: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  rowThumb: { width: 56 },
  rowTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  rowLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  chipScroll: { marginHorizontal: -layout.gutter },
  chips: { gap: space.sm, paddingHorizontal: layout.gutter },
  ideaScroll: { marginHorizontal: -layout.gutter, marginTop: space.md },
  ideas: { gap: space.md, paddingHorizontal: layout.gutter },
  idea: { width: IDEA_W },
  ideaTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary, marginTop: space.sm },
  ideaLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  note: { ...type.supporting, color: text.secondary, marginTop: space.md },
  tools: { marginTop: space.section, padding: space.sm, borderRadius: radius.card + 4, backgroundColor: bg.subtle, gap: 4 },
  toolsTitle: { ...type.caption, fontWeight: "700", color: text.secondary, marginLeft: space.md, marginTop: space.sm, marginBottom: 4 },
  tool: { flexDirection: "row", alignItems: "center", gap: space.md, height: 52, paddingHorizontal: space.md, borderRadius: radius.card, backgroundColor: bg.surface },
  toolText: { ...type.cardTitle, fontWeight: "700", color: text.primary, flex: 1 },
  count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 12, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
});
