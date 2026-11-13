import { useMemo } from "react";
import { ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ExportIcon, SealCheckIcon, TrophyIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ShapeGlyph } from "@/features/tournament/components/ShapeGlyph";
import { errorText, formatDistance, formatDuration, formatPoints } from "@/features/tournament/format";
import { DIFFICULTY_LABEL, shapeChoices } from "@/features/tournament/shapeFlow";
import { getAssignedRoute, getMyShapeScores, getShapeSubmission } from "@/services/tournamentService";
import { normalize, projectLocal, resample } from "../../../supabase/functions/tournament/shape";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

/** How close a score is, in a word, for the line under it. */
const verdict = (score: number) => (score >= 90 ? "Spot on" : score >= 75 ? "Very close" : score >= 55 ? "Recognisable" : score >= 30 ? "A rough sketch" : "Hard to see");

/** A Follow the Shape result: your walk laid over the target, the score, and where it places you. */
export default function ShapeResultScreen() {
  const params = useLocalSearchParams<{ submissionId?: string; rank?: string; total?: string }>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const result = useQuery({ queryKey: ["shapeSubmission", params.submissionId], queryFn: () => getShapeSubmission(params.submissionId ?? ""), enabled: Boolean(params.submissionId), staleTime: Infinity });
  const mine = useQuery({ queryKey: ["myShapeScores", result.data?.tournament_id], queryFn: () => getMyShapeScores(result.data?.tournament_id ?? ""), enabled: Boolean(result.data) });
  const data = result.data;
  // Personal best within the same difficulty tier, since that's what the board compares.
  const personalBest = Boolean(data && mine.data && mine.data.filter((r) => r.tier === data.tier).every((r) => r.id === data.id || r.score <= data.score));
  const route = useQuery({ queryKey: ["assignedRoute", data?.assignment_id], queryFn: () => getAssignedRoute(data?.assignment_id ?? ""), enabled: Boolean(data?.assignment_id), staleTime: Infinity });
  // The route as a shape only: no map, no coordinates, so nothing on screen shows where you walked.
  const routeShape = useMemo(() => {
    const legs = route.data?.legs ?? [];
    const path = legs.flatMap((l) => l.coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
    return path.length > 1 ? normalize(resample(projectLocal(path), 64)) : null;
  }, [route.data]);
  const shapeName = shapeChoices().find((c) => c.key === data?.shape_key)?.name ?? "shape";
  const share = () =>
    void Share.share({
      message: `My dog and I walked a ${shapeName.toLowerCase()} on PAWS and scored ${formatPoints(data?.score ?? 0)} out of 100.`,
    });
  const rank = params.rank ? Number(params.rank) : null;
  const total = params.total ? Number(params.total) : null;
  const size = Math.min(300, width - layout.gutter * 2 - space.xl * 2);
  const done = () => router.replace("/game/tournament/follow-shape");

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl }]} showsVerticalScrollIndicator={false}>
        <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.close} onPress={done}>
          <XIcon size={20} color={text.primary} weight="bold" />
        </PressScale>

        {data ? (
          <>
            <View style={styles.stage}>
              <ShapeGlyph points={data.target_normalized} closed={false} route={data.route_normalized} size={size} strokeWidth={5} />
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.swatch, styles.swatchTarget]} />
                  <Text style={styles.legendText}>Target</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.swatch, styles.swatchRoute]} />
                  <Text style={styles.legendText}>Your walk</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.badges}>
                {personalBest ? (
                  <Animated.View entering={reduceMotion ? undefined : FadeIn.delay(260).duration(motion.duration.enter)} style={styles.pb}>
                    <TrophyIcon size={15} color={text.primary} weight="fill" />
                    <Text style={styles.pbText}>Personal best</Text>
                  </Animated.View>
                ) : null}
                <View style={styles.checked}>
                  <SealCheckIcon size={15} color="#2F8F4E" weight="fill" />
                  <Text style={styles.checkedText}>Completed and verified</Text>
                </View>
              </View>
              <Animated.Text
                entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.reveal).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.92 }], opacity: 0 })}
                style={styles.score}
              >
                {formatPoints(data.score)}
                <Text style={styles.outOf}> / 100</Text>
              </Animated.Text>
              <Text style={styles.verdict}>{verdict(data.score)}</Text>
              {data.similarity != null ? (
                <View style={styles.parts}>
                  <Part label="Shape match" value={formatPoints(Number(data.similarity))} weight="70%" />
                  <Part label="Route walked" value={`${Math.round(Number(data.route_completion ?? 0) * 100)}%`} weight="30%" />
                </View>
              ) : null}
              <View style={styles.stats}>
                <Stat label="Walked" value={formatDistance(data.distance_m)} />
                <Stat label="Time" value={formatDuration(data.elapsed_seconds * 1000)} />
                <Stat label={data.tier ? `${DIFFICULTY_LABEL[data.tier]} place` : "Place"} value={rank ? `${rank}${total ? ` of ${total}` : ""}` : "-"} />
              </View>
            </View>

            {routeShape ? (
              <View style={styles.trio}>
                <Mini label="Target">
                  <ShapeGlyph points={data.target_normalized} closed={false} size={84} strokeWidth={3} />
                </Mini>
                <Mini label="Your route">
                  <ShapeGlyph points={routeShape} closed={false} size={84} strokeWidth={3} />
                </Mini>
                <Mini label="Your walk">
                  <ShapeGlyph points={data.route_normalized} closed={false} size={84} strokeWidth={3} />
                </Mini>
              </View>
            ) : null}

            <RaisedButton tone="white" height={50} label="Share score" icon={<ExportIcon size={18} color={text.primary} weight="bold" />} onPress={share} />
            <Text style={styles.note}>Sharing sends your score and shape only, never the map of where you walked.</Text>

            <View style={styles.actions}>
              <RaisedButton tone="white" label="Leaderboard" onPress={() => router.push({ pathname: "/game/tournament/leaderboard", params: { id: data.tournament_id } })} style={styles.flex} />
              <RaisedButton label="Done" onPress={done} style={styles.flex} />
            </View>
            <Text style={styles.note}>{`Scored with ${data.scoring_version ?? data.algorithm_version}. Your best walk in each difficulty counts.`}</Text>
          </>
        ) : (
          <Text style={styles.loading}>{result.error ? errorText((result.error as { code?: string }).code) : "Loading your result."}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const Part = ({ label, value, weight }: { label: string; value: string; weight: string }) => (
  <View style={styles.part}>
    <Text style={styles.partValue}>{value}</Text>
    <Text style={styles.partLabel}>{`${label}, ${weight}`}</Text>
  </View>
);

const Mini = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.mini}>
    <View style={styles.miniArt}>{children}</View>
    <Text style={styles.miniLabel}>{label}</Text>
  </View>
);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  flex: { flex: 1 },
  body: { paddingHorizontal: layout.gutter, gap: space.lg },
  close: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  stage: { alignItems: "center", paddingVertical: space.xl, borderRadius: 28, backgroundColor: accent.soft, gap: space.md },
  legend: { flexDirection: "row", gap: space.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 22, height: 0, borderTopWidth: 3 },
  swatchTarget: { borderColor: `${text.primary}55`, borderStyle: "dashed" },
  swatchRoute: { borderColor: accent.band },
  legendText: { ...type.caption, fontWeight: "700", color: text.secondary },
  card: { padding: space.xl, borderRadius: 28, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  pb: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  pbText: { fontSize: 12, fontWeight: "800", color: text.primary },
  checked: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  checkedText: { fontSize: 12, fontWeight: "700", color: text.secondary },
  score: { fontSize: 56, lineHeight: 62, fontWeight: "800", letterSpacing: -1.6, color: text.primary, fontVariant: ["tabular-nums"], marginTop: space.md },
  outOf: { fontSize: 20, fontWeight: "700", color: text.tertiary, letterSpacing: 0 },
  verdict: { ...type.body, color: text.secondary },
  stats: { flexDirection: "row", marginTop: space.lg, paddingTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  stat: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  actions: { flexDirection: "row", gap: space.md },
  parts: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  part: { flex: 1, padding: space.md, borderRadius: 14, backgroundColor: bg.subtle },
  partValue: { fontSize: 20, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  partLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  trio: { flexDirection: "row", gap: space.sm },
  mini: { flex: 1, alignItems: "center", gap: 6 },
  miniArt: { alignSelf: "stretch", aspectRatio: 1, borderRadius: radius.card, backgroundColor: bg.stage, alignItems: "center", justifyContent: "center" },
  miniLabel: { ...type.caption, fontWeight: "700", color: text.secondary },
  note: { ...type.caption, color: text.tertiary, textAlign: "center" },
  loading: { ...type.supporting, color: text.secondary, marginTop: space.xl },
});
