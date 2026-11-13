import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { CaretRightIcon, MinusIcon, PencilSimpleIcon, PlusIcon, SparkleIcon, WarningIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { Chip, PoseImage, Segments } from "@/features/photoPose/components/PoseParts";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, THEME_LABEL, countLabel, minutesLabel, poseError } from "@/features/photoPose/copy";
import { OrganizerGate } from "@/features/rooms/components/OrganizerGate";
import { poseKeys, useConcepts, useReferenceUrl } from "@/hooks/usePhotoPose";
import { DogPhotoPoseDiscoveryService, type PoseConceptRow, type ReviewStatus } from "@/services/mediaService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";
import { BATCH_LIMITS, POSE_THEMES, type BatchDifficulty, type PoseTheme, type Rejection } from "../../../supabase/functions/media/poses";

const TABS = [
  ["suggested", "Ideas"],
  ["approved", "Approved"],
  ["published", "Live"],
  ["rejected", "Rejected"],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * Pose studio, for organizers. Ask Gemini for a batch of ideas, then review each one. Gemini only suggests: nothing
 * reaches players until an organizer approves the idea and its reference image and publishes it.
 */
export default function PoseStudioScreen() {
  return (
    <OrganizerGate explain={poseError} body="Pose ideas are written, checked and published by PAWS organizers.">
      <Studio />
    </OrganizerGate>
  );
}

const Studio = () => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const concepts = useConcepts();
  const [theme, setTheme] = useState<PoseTheme>("mixed");
  const [difficulty, setDifficulty] = useState<BatchDifficulty>("easy");
  const [count, setCount] = useState(6);
  const [tab, setTab] = useState<Tab>("suggested");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ added: number; cached: boolean; rejected: Rejection[] } | null>(null);

  const all = concepts.data ?? [];
  const shown = all.filter((c) => (tab === "published" ? c.review_status === "published" || c.review_status === "retired" : c.review_status === tab));
  const countOf = (t: Tab) => all.filter((c) => (t === "published" ? c.review_status === "published" : c.review_status === t)).length;

  const generate = async () => {
    setBusy(true);
    setError(null);
    setLast(null);
    try {
      const r = await DogPhotoPoseDiscoveryService.brainstorm({ theme, difficulty, count });
      setLast({ added: r.conceptIds.length, cached: r.cached, rejected: r.rejected });
      setTab("suggested");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: poseKeys.concepts });
    } catch (e) {
      setError(poseError((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailShell title="Pose studio" glyph={<SparkleIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament/photo-pose">
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>New ideas</Text>
        <View style={styles.chips}>
          {POSE_THEMES.map((t) => (
            <Chip key={t} label={THEME_LABEL[t]} on={theme === t} onPress={() => setTheme(t)} />
          ))}
        </View>
        <View style={styles.rowGap}>
          <Segments value={difficulty} options={[["easy", "Easy"], ["medium", "Medium"], ["mixed", "Mixed"]] as const} onChange={setDifficulty} />
        </View>
        <View style={styles.stepper}>
          <Text style={styles.stepperLabel}>How many</Text>
          <PressScale accessibilityRole="button" accessibilityLabel="Fewer" style={styles.stepButton} disabled={count <= BATCH_LIMITS.min} onPress={() => setCount((n) => Math.max(BATCH_LIMITS.min, n - 1))}>
            <MinusIcon size={16} color={count <= BATCH_LIMITS.min ? text.disabled : text.primary} weight="bold" />
          </PressScale>
          <Text style={styles.stepValue} accessibilityLiveRegion="polite">
            {count}
          </Text>
          <PressScale accessibilityRole="button" accessibilityLabel="More" style={styles.stepButton} disabled={count >= BATCH_LIMITS.max} onPress={() => setCount((n) => Math.min(BATCH_LIMITS.max, n + 1))}>
            <PlusIcon size={16} color={count >= BATCH_LIMITS.max ? text.disabled : text.primary} weight="bold" />
          </PressScale>
        </View>
        <RaisedButton label="Generate ideas" sub={busy ? "Gemini is thinking" : "Suggestions only. You review each one."} busy={busy} onPress={() => void generate()} style={styles.go} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {last ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.summary}>
            <Text style={styles.summaryText}>
              {last.cached ? "Same request as a few minutes ago, so here are those ideas again." : `${countLabel(last.added, "new idea", "new ideas")}.`}
              {last.rejected.length ? ` ${countLabel(last.rejected.length, "was", "were")} dropped: ${summarise(last.rejected)}.` : ""}
            </Text>
          </Animated.View>
        ) : null}
      </View>

      <PressScale accessibilityRole="button" style={styles.write} onPress={() => router.push({ pathname: "/game/tournament/pose-concept", params: { id: "new" } })}>
        <PencilSimpleIcon size={18} color={text.primary} weight="bold" />
        <Text style={styles.writeText}>Write one yourself</Text>
        <CaretRightIcon size={16} color={text.tertiary} weight="bold" />
      </PressScale>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabScroll}>
        {TABS.map(([key, label]) => (
          <Chip key={key} label={countOf(key) ? `${label} ${countOf(key)}` : label} on={tab === key} onPress={() => setTab(key)} />
        ))}
      </ScrollView>

      {concepts.isPending ? (
        <View style={styles.loading}>
          <ActivityIndicator color={text.secondary} />
        </View>
      ) : concepts.isError ? (
        <Text style={styles.empty}>{poseError((concepts.error as { code?: string }).code)}</Text>
      ) : shown.length === 0 ? (
        <Text style={styles.empty}>{EMPTY[tab]}</Text>
      ) : (
        <View style={styles.list}>
          {shown.map((c) => (
            <ConceptRow key={c.id} c={c} />
          ))}
        </View>
      )}
      <View style={{ height: insets.bottom }} />
    </DetailShell>
  );
};

const EMPTY: Record<Tab, string> = {
  suggested: "No ideas waiting. Generate a batch or write one.",
  approved: "Nothing approved yet.",
  published: "No poses are live yet.",
  rejected: "Nothing rejected.",
};

/** "jumping, repeat of an existing idea (2)" */
const summarise = (rejected: Rejection[]) => {
  const counts = new Map<string, number>();
  rejected.forEach((r) => {
    const why = (r.reasons[0] ?? "invalid").replace(/^unsafe: /, "");
    counts.set(why, (counts.get(why) ?? 0) + 1);
  });
  return [...counts].map(([why, n]) => (n > 1 ? `${why} (${n})` : why)).join(", ");
};

const REF_LABEL: Record<PoseConceptRow["reference_status"], string> = { none: "No image yet", pending: "Image to review", approved: "Image approved", rejected: "Image rejected" };
const STATUS_LABEL: Record<ReviewStatus, string> = { suggested: "", approved: "", rejected: "", published: "Live", retired: "Retired" };

const ConceptRow = ({ c }: { c: PoseConceptRow }) => {
  const ref = useReferenceUrl(c.reference_media_path);
  const flags = c.safety_flags?.length ?? 0;
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`${c.title}. Open`} style={styles.item} onPress={() => router.push({ pathname: "/game/tournament/pose-concept", params: { id: c.id } })}>
      <PoseImage url={ref.data} loading={ref.isPending && !!c.reference_media_path} aspect={4 / 5} rounded={12} style={styles.thumb} />
      <View style={styles.flex}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {c.title}
        </Text>
        <Text style={styles.itemLine} numberOfLines={1}>
          {[CATEGORY_LABEL[c.category], DIFFICULTY_LABEL[c.difficulty], minutesLabel(c.setup_minutes), STATUS_LABEL[c.review_status]].filter(Boolean).join("  ·  ")}
        </Text>
        <View style={styles.itemTags}>
          <Text style={[styles.refTag, c.reference_status === "pending" && styles.refTagPending]}>{REF_LABEL[c.reference_status]}</Text>
          {flags ? (
            <View style={styles.flag}>
              <WarningIcon size={12} color="#9A5B10" weight="fill" />
              <Text style={styles.flagText}>{countLabel(flags, "safety note", "safety notes")}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <CaretRightIcon size={16} color={text.tertiary} weight="bold" />
    </PressScale>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { marginTop: space.sm, padding: space.lg, borderRadius: 24, backgroundColor: bg.stage, gap: space.md },
  panelTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  rowGap: { marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepperLabel: { ...type.supporting, fontWeight: "700", color: text.secondary, flex: 1 },
  stepButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  stepValue: { ...type.sectionTitle, fontWeight: "800", color: text.primary, minWidth: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
  go: { marginTop: space.xs },
  error: { ...type.supporting, color: "#B4432F" },
  summary: { padding: space.md, borderRadius: radius.control, backgroundColor: bg.surface },
  summaryText: { ...type.supporting, color: text.primary },
  write: { flexDirection: "row", alignItems: "center", gap: space.md, height: 52, marginTop: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  writeText: { ...type.cardTitle, fontWeight: "700", color: text.primary, flex: 1 },
  tabScroll: { marginTop: space.section, marginHorizontal: -24 },
  tabs: { gap: space.sm, paddingHorizontal: 24 },
  loading: { height: 200, alignItems: "center", justifyContent: "center" },
  empty: { ...type.supporting, color: text.secondary, marginTop: space.xl, textAlign: "center" },
  list: { marginTop: space.lg, gap: space.sm },
  item: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, paddingRight: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  thumb: { width: 56 },
  itemTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  itemLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  itemTags: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 6 },
  refTag: { fontSize: 11, fontWeight: "700", color: text.tertiary },
  refTagPending: { color: text.primary },
  flag: { flexDirection: "row", alignItems: "center", gap: 3, height: 20, paddingHorizontal: 7, borderRadius: radius.pill, backgroundColor: "#FDF0D8" },
  flagText: { fontSize: 11, fontWeight: "700", color: "#9A5B10" },
});
