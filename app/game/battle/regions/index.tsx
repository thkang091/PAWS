import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { CaretRightIcon, PathIcon, PlusIcon } from "phosphor-react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ROUTES } from "@/features/rooms/lobbyRules";
import { STAGES, regionStage, type RegionStage } from "@/features/rooms/regionAdmin";
import { STAGE_LABEL, updatedAgo } from "@/features/rooms/regionCopy";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { OrganizerGate } from "@/features/rooms/components/OrganizerGate";
import { ROAD_STYLE, StageBadge } from "@/features/rooms/components/RoadStyle";
import { useOrganizerRegions, useRefreshRegions } from "@/hooks/useRegions";
import { disableRegion, reopenRegion, type RegionSummary } from "@/services/roomService";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type Filter = "all" | RegionStage;

/** Road areas: every region an organizer has started, how far its review has got, and what can be done next. */
export default function RegionListScreen() {
  return (
    <OrganizerGate>
      <RegionList />
    </OrganizerGate>
  );
}

const stageOf = (r: RegionSummary) => regionStage(r.status, { reviewed: r.roads.total - r.roads.pending });

const RegionList = () => {
  const regions = useOrganizerRegions(true);
  const refresh = useRefreshRegions();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const list = useMemo(() => regions.data ?? [], [regions.data]);
  const counts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, list.filter((r) => stageOf(r) === s).length])) as Record<RegionStage, number>, [list]);
  const shown = filter === "all" ? list : list.filter((r) => stageOf(r) === filter);
  // Coming back from a review shows the new counts.
  useFocusEffect(
    useCallback(() => {
      void regions.refetch();
    }, []), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("That didn't work", roomErrorText((e as { code?: string }).code));
    } finally {
      setBusy(null);
      void refresh(id);
    }
  };

  const disable = (r: RegionSummary) =>
    Alert.alert(`Disable ${r.name}?`, "Players can't pick it for new rooms, and open rooms that picked it lose the pick. You can reopen it as a draft later.", [
      { text: "Keep it", style: "cancel" },
      { text: "Disable", style: "destructive", onPress: () => void act(r.id, () => disableRegion(r.id)) },
    ]);

  return (
    <DetailShell
      title="Road areas"
      glyph={<PathIcon size={20} color={accent.band} weight="bold" />}
      back={ROUTES.detail("steal_road")}
      action={{ label: "New road area", icon: <PlusIcon size={20} color={text.primary} weight="bold" />, onPress: () => router.push(ROUTES.newRegion as never) }}
    >
      {regions.isPending ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.card, styles.skeleton]} />
          ))}
        </View>
      ) : regions.error ? (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Couldn't load road areas</Text>
          <Text style={styles.stateBody}>{roomErrorText((regions.error as { code?: string }).code)}</Text>
          <RaisedButton tone="white" label="Try again" height={50} onPress={() => void regions.refetch()} style={styles.stateButton} />
        </View>
      ) : list.length === 0 ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.state}>
          <RoadsGlyph />
          <Text style={styles.stateTitle}>No road areas yet</Text>
          <Text style={styles.stateBody}>Import roads from a GeoJSON file, check every one by hand, then publish the area for Steal Your Road.</Text>
          <RaisedButton label="Create a road area" height={54} onPress={() => router.push(ROUTES.newRegion as never)} style={styles.stateButton} />
        </Animated.View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} style={styles.filterRow}>
            {(["all", ...STAGES] as Filter[]).map((f) => {
              const on = filter === f;
              const n = f === "all" ? list.length : counts[f];
              return (
                <PressScale key={f} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${f === "all" ? "All" : STAGE_LABEL[f]}, ${n}`} style={[styles.filter, on && styles.filterOn]} onPress={() => setFilter(f)}>
                  <Text style={[styles.filterText, on && styles.filterTextOn]}>{f === "all" ? "All" : STAGE_LABEL[f]}</Text>
                  <Text style={[styles.filterCount, on && styles.filterTextOn]}>{n}</Text>
                </PressScale>
              );
            })}
          </ScrollView>

          {shown.length === 0 ? <Text style={styles.none}>{`No ${STAGE_LABEL[filter as RegionStage].toLowerCase()} areas.`}</Text> : null}
          <View style={styles.list}>
            {shown.map((r, i) => (
              <Animated.View key={r.id} entering={reduceMotion ? undefined : FadeIn.delay(Math.min(i, 6) * 40).duration(motion.duration.enter)}>
                <RegionRow
                  region={r}
                  busy={busy === r.id}
                  onReview={() => router.push(ROUTES.region(r.id) as never)}
                  onPublish={() => router.push(`${ROUTES.region(r.id)}?publish=1` as never)}
                  onDisable={() => disable(r)}
                  onReopen={() => void act(r.id, () => reopenRegion(r.id))}
                />
              </Animated.View>
            ))}
          </View>
        </>
      )}
    </DetailShell>
  );
};

const RegionRow = ({ region: r, busy, onReview, onPublish, onDisable, onReopen }: { region: RegionSummary; busy: boolean; onReview: () => void; onPublish: () => void; onDisable: () => void; onReopen: () => void }) => {
  const stage = stageOf(r);
  const reviewed = r.roads.total - r.roads.pending;
  const ready = r.status === "draft" && r.roads.total > 0 && r.roads.pending === 0 && r.roads.verified >= 3 && Boolean(r.source.trim() && r.license.trim());
  const source = [r.source, r.license].filter((s) => s.trim()).join(", ");
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={`${r.name}. ${STAGE_LABEL[stage]}. ${reviewed} of ${r.roads.total} roads reviewed. Open review`} scaleTo={0.985} style={styles.card} onPress={onReview}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {r.name}
        </Text>
        <StageBadge stage={stage} />
        <CaretRightIcon size={16} color={text.tertiary} weight="bold" />
      </View>

      <View style={styles.meter} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {r.roads.total > 0
          ? (["verified", "unsafe", "disabled"] as const).map((s) => (r.roads[s] > 0 ? <View key={s} style={{ flex: r.roads[s], backgroundColor: ROAD_STYLE[s].color }} /> : null))
          : null}
        {r.roads.pending > 0 || r.roads.total === 0 ? <View style={{ flex: r.roads.pending || 1, backgroundColor: border.soft }} /> : null}
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{r.roads.total === 0 ? "No roads imported" : `${reviewed}/${r.roads.total} reviewed`}</Text>
        {reviewed > 0 ? <Text style={styles.metaSoft}>{`${r.roads.verified} verified, ${r.roads.unsafe} unsafe, ${r.roads.disabled} off`}</Text> : null}
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.metaSoft, !source && styles.missing]} numberOfLines={1}>
          {source || "No source or licence yet"}
        </Text>
        <Text style={styles.metaSoft}>{updatedAgo(r.updatedAt)}</Text>
      </View>

      {ready || r.status !== "draft" ? (
        <View style={styles.actions}>
          {ready ? <SmallButton label="Publish" tone="yellow" disabled={busy} onPress={onPublish} /> : null}
          {r.status === "published" ? <SmallButton label="Disable" tone="danger" disabled={busy} onPress={onDisable} /> : null}
          {r.status === "disabled" ? <SmallButton label="Reopen as draft" disabled={busy} onPress={onReopen} /> : null}
        </View>
      ) : null}
    </PressScale>
  );
};

const SmallButton = ({ label, tone = "plain", disabled, onPress }: { label: string; tone?: "plain" | "yellow" | "danger"; disabled?: boolean; onPress: () => void }) => (
  <PressScale accessibilityRole="button" accessibilityLabel={label} disabled={disabled} hitSlop={6} style={[styles.small, tone === "yellow" && styles.smallYellow, disabled && styles.smallOff]} onPress={onPress}>
    <Text style={[styles.smallText, tone === "danger" && styles.smallDanger]}>{label}</Text>
  </PressScale>
);

/** Three roads meeting at a junction, the empty state's picture. */
const RoadsGlyph = () => (
  <View style={styles.glyph}>
    <Svg width={72} height={72} viewBox="0 0 72 72">
      <Path d="M8 58 C22 50 28 42 36 36" stroke={ROAD_STYLE.verified.color} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M36 36 C44 30 52 18 64 12" stroke={ROAD_STYLE.pending.color} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 6" fill="none" />
      <Path d="M36 36 L62 54" stroke={ROAD_STYLE.unsafe.color} strokeWidth={5} strokeLinecap="round" strokeDasharray="10 6" fill="none" />
      <Circle cx={36} cy={36} r={6} fill={bg.surface} stroke={text.primary} strokeWidth={3} />
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  filterRow: { marginHorizontal: -24, marginTop: space.md },
  filters: { gap: space.sm, paddingHorizontal: 24 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.soft, backgroundColor: bg.surface },
  filterOn: { backgroundColor: text.primary, borderColor: text.primary },
  filterText: { fontSize: 13, fontWeight: "700", color: text.primary },
  filterCount: { fontSize: 13, fontWeight: "700", color: text.tertiary, fontVariant: ["tabular-nums"] },
  filterTextOn: { color: text.inverse },
  none: { ...type.supporting, color: text.secondary, marginTop: space.xl },
  list: { gap: space.md, marginTop: space.lg },
  card: { padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  skeleton: { height: 150, backgroundColor: bg.subtle, borderColor: bg.subtle },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  name: { ...type.cardTitle, fontSize: 17, fontWeight: "800", color: text.primary, flex: 1 },
  meter: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", gap: 2, marginTop: space.md, backgroundColor: bg.surface },
  metaRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md, marginTop: space.sm },
  meta: { ...type.supporting, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  metaSoft: { ...type.caption, color: text.secondary, fontVariant: ["tabular-nums"], flexShrink: 1 },
  missing: { color: "#8A5A10", fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  small: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  smallYellow: { backgroundColor: accent.deep },
  smallOff: { opacity: 0.5 },
  smallText: { fontSize: 13, fontWeight: "800", color: text.primary },
  smallDanger: { color: "#B4442C" },
  state: { alignItems: "center", paddingTop: space.block, gap: space.sm },
  stateTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary, textAlign: "center", marginTop: space.md },
  stateBody: { ...type.supporting, color: text.secondary, textAlign: "center", maxWidth: 300 },
  stateButton: { alignSelf: "stretch", marginTop: space.lg },
  glyph: { width: 112, height: 112, borderRadius: 56, backgroundColor: bg.stage, alignItems: "center", justifyContent: "center" },
});
