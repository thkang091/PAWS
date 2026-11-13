import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import Animated, { FadeIn, FadeInDown, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Svg, { Line } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { ArrowsClockwiseIcon, CaretLeftIcon, CheckIcon, MapTrifoldIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import { ShapeGlyph } from "@/features/tournament/components/ShapeGlyph";
import { errorText, formatDistance } from "@/features/tournament/format";
import { ACTION_LABEL, OUTCOME_COPY, ROUTE_LINES, WARNING_LABEL, matchLabel, noveltyLabel, shapeChoices, type OutcomeAction } from "@/features/tournament/shapeFlow";
import { assignShapeRoute, requestShapeRoutes, type ShapeRouteOption } from "@/services/tournamentService";
import { normalize, projectLocal, resample } from "../../../supabase/functions/tournament/shape";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const FLOAT = { shadowColor: "#1C1B1A", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 4 };

/** Route discovery: up to three real, walkable routes for the shape, compared on one map. */
export default function ShapeRoutesScreen() {
  const p = useLocalSearchParams<{ id?: string; shape?: string; minutes?: string; lat?: string; lng?: string; stairs?: string; paths?: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const shape = shapeChoices().find((s) => s.key === p.shape) ?? null;
  const minutes = Number(p.minutes) as 15 | 25 | 40;
  const start = { latitude: Number(p.lat), longitude: Number(p.lng) };
  const routes = useQuery({
    queryKey: ["shapeRoutes", p.shape, p.minutes, p.lat, p.lng, p.stairs, p.paths, p.id],
    queryFn: () => requestShapeRoutes({ shapeKey: p.shape ?? "", minutes, latitude: start.latitude, longitude: start.longitude, tournamentId: p.id || undefined, avoidStairs: p.stairs === "1", preferPaths: p.paths === "1" }),
    enabled: Boolean(shape && Number.isFinite(start.latitude)),
    staleTime: Infinity,
    retry: 0,
  });
  const options = useMemo(() => routes.data?.options ?? [], [routes.data]);
  const [picked, setPicked] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const map = useRef<MapView | null>(null);
  const { height } = useWindowDimensions();

  // Frame every option above the panel once they arrive (the panel covers up to 62% of the screen).
  const fit = () => {
    const all = options.flatMap((o) => o.path);
    if (all.length) map.current?.fitToCoordinates(all, { edgePadding: { top: insets.top + 80, right: 36, bottom: height * 0.6 + 16, left: 36 }, animated: true });
  };
  useEffect(() => {
    const id = setTimeout(fit, 300);
    return () => clearTimeout(id);
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  const walk = async () => {
    const option = options[picked];
    if (!option) return;
    setBusy(true);
    setError(null);
    try {
      const assignmentId = await assignShapeRoute(option.candidateId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/game/tournament/shape-walk", params: { id: p.id ?? "", assignment: assignmentId } });
    } catch (e) {
      setError(errorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  const act = (a: OutcomeAction) => {
    if (a === "change_shape") router.dismissTo({ pathname: "/game/tournament/shapes", params: { id: p.id ?? "" } });
    else if (a === "try_again") void routes.refetch();
    else router.back();
  };

  const outcome = routes.data?.outcome;
  const failed = outcome && outcome !== "ok" ? OUTCOME_COPY[outcome] : null;

  return (
    <View style={styles.screen}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...(Number.isFinite(start.latitude) ? start : { latitude: 0, longitude: 0 }), latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        customMapStyle={QUIET_MAP}
        onMapReady={fit}
        showsPointsOfInterests={false}
        showsCompass={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {options.map((o, i) =>
          i === picked ? null : <Polyline key={o.candidateId} coordinates={o.path} strokeColor={`${ROUTE_LINES[i].color}66`} strokeWidth={4} lineDashPattern={ROUTE_LINES[i].dash} lineJoin="round" tappable onPress={() => setPicked(i)} />,
        )}
        {options[picked] ? (
          <>
            <Polyline coordinates={options[picked].path} strokeColor={`${accent.deep}AA`} strokeWidth={14} lineCap="round" lineJoin="round" zIndex={1} />
            <Polyline coordinates={options[picked].path} strokeColor={ROUTE_LINES[picked].color} strokeWidth={5} lineDashPattern={ROUTE_LINES[picked].dash} lineJoin="round" zIndex={2} />
            <Marker coordinate={options[picked].path[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={3}>
              <View style={styles.startPin}>
                <View style={styles.startDot} />
              </View>
            </Marker>
          </>
        ) : null}
      </MapView>

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => router.back()}>
          <CaretLeftIcon size={20} color={text.primary} weight="bold" />
        </PressScale>
        {shape ? (
          <View style={styles.title}>
            <ShapeGlyph points={shape.points} closed={shape.closed} size={26} strokeWidth={3} />
            <Text style={styles.titleText} numberOfLines={1}>{`${shape.name}, ${minutes} min`}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.panel, { paddingBottom: insets.bottom + space.md }]}>
        {routes.isPending ? (
          <View style={styles.state}>
            <ActivityIndicator color={text.secondary} />
            <Text style={styles.stateTitle}>Finding real walking paths</Text>
            <Text style={styles.stateBody}>Routes follow mapped public streets and paths only. This can take a few seconds.</Text>
          </View>
        ) : routes.error ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>{"No routes right now"}</Text>
            <Text style={styles.stateBody}>{errorText((routes.error as { code?: string }).code)}</Text>
            <RaisedButton tone="white" label="Try again" icon={<ArrowsClockwiseIcon size={18} color={text.primary} weight="bold" />} onPress={() => void routes.refetch()} style={styles.wide} />
          </View>
        ) : failed ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.state}>
            <View style={styles.stateIcon}>
              <MapTrifoldIcon size={26} color={text.primary} weight="fill" />
            </View>
            <Text style={styles.stateTitle}>{failed.title}</Text>
            <Text style={styles.stateBody}>{failed.body}</Text>
            {failed.actions.map((a, i) => (
              <RaisedButton key={a} tone={i === 0 ? "yellow" : "white"} height={50} label={ACTION_LABEL[a]} onPress={() => act(a)} style={styles.wide} />
            ))}
          </Animated.View>
        ) : (
          <>
            <ScrollView style={styles.list} contentContainerStyle={styles.listBody} showsVerticalScrollIndicator={false}>
              {options.map((o, i) => (
                <Animated.View key={o.candidateId} entering={reduceMotion ? undefined : FadeInDown.delay(i * 50).duration(motion.duration.enter).easing(motion.easing.out)}>
                  <RouteCard option={o} index={i} on={i === picked} onPress={() => setPicked(i)} />
                </Animated.View>
              ))}
              {routes.data?.limited ? (
                <Text style={styles.small}>{options.length === 1 ? "Only one route here is different enough to offer." : `Only ${options.length} routes here are different enough to offer.`}</Text>
              ) : null}
              {options[picked]?.warnings.length ? (
                <Text style={styles.note}>{`Route ${ROUTE_LINES[picked].letter}: ${options[picked].warnings.map((w) => WARNING_LABEL[w].toLowerCase()).join(", ")}. Map data can be incomplete, so check the way ahead.`}</Text>
              ) : null}
              {routes.data?.sources.length ? (
                <Text style={styles.small}>{`Map data ${routes.data.sources.map((s) => (s.attribution ? `${s.attribution} (${s.license})` : `${s.source}, ${s.license}`)).join("; ")}`}</Text>
              ) : null}
            </ScrollView>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <RaisedButton label={`Walk route ${ROUTE_LINES[picked]?.letter ?? ""}`} sub="Stay on public paths. Cross only at crossings." busy={busy} onPress={() => void walk()} />
          </>
        )}
      </View>
    </View>
  );
}

const RouteCard = ({ option: o, index, on, onPress }: { option: ShapeRouteOption; index: number; on: boolean; onPress: () => void }) => {
  const line = ROUTE_LINES[index];
  const preview = useMemo(() => normalize(resample(projectLocal(o.path), 48)), [o.path]);
  return (
    <PressScale
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={`Route ${line.letter}. Estimated shape match ${Math.round(o.estimate)}, ${matchLabel(o.estimate).toLowerCase()}. ${formatDistance(o.lengthM)}, about ${o.minutes} minutes walking. ${o.loop ? "Loop." : "Ends elsewhere."} ${noveltyLabel(o.recentOverlap)}.${o.warnings.length ? ` ${o.warnings.map((w) => WARNING_LABEL[w]).join(", ")}.` : ""}`}
      scaleTo={0.98}
      style={[styles.card, on && styles.cardOn]}
      onPress={onPress}
    >
      <View style={styles.preview}>
        <ShapeGlyph points={preview} closed={false} size={64} strokeWidth={3} />
        {on ? (
          <View style={styles.check}>
            <CheckIcon size={12} color={text.primary} weight="bold" />
          </View>
        ) : null}
      </View>
      <View style={styles.flex}>
        <View style={styles.cardTop}>
          <Svg width={26} height={8}>
            <Line x1={2} y1={4} x2={24} y2={4} stroke={line.color} strokeWidth={4} strokeLinecap="round" strokeDasharray={line.dash?.map((d) => d * 0.6)} />
          </Svg>
          <Text style={styles.cardTitle}>{`Route ${line.letter}`}</Text>
          <View style={styles.matchBox}>
            <Text style={styles.match}>{`${Math.round(o.estimate)}`}</Text>
            <Text style={styles.matchUnit}>est. match</Text>
          </View>
        </View>
        <Text style={styles.cardLine}>{`${formatDistance(o.lengthM)}, about ${o.minutes} min`}</Text>
        <View style={styles.tags}>
          <Text style={styles.tag}>{o.loop ? "Loop" : "Ends elsewhere"}</Text>
          <Text style={[styles.tag, o.recentOverlap <= 0.2 && styles.tagNew]}>{noveltyLabel(o.recentOverlap)}</Text>
          {o.warnings.slice(0, 2).map((w) => (
            <Text key={w} style={[styles.tag, styles.tagWarn]}>
              {WARNING_LABEL[w]}
            </Text>
          ))}
          {o.warnings.length > 2 ? <Text style={[styles.tag, styles.tagWarn]}>{`+${o.warnings.length - 2}`}</Text> : null}
        </View>
      </View>
    </PressScale>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.stage },
  flex: { flex: 1 },
  top: { position: "absolute", left: space.lg, right: space.lg, top: 0, flexDirection: "row", alignItems: "center", gap: space.sm },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", ...FLOAT },
  title: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 44, paddingHorizontal: space.md, borderRadius: 22, backgroundColor: bg.surface, ...FLOAT },
  titleText: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  startPin: { width: 24, height: 24, borderRadius: 12, backgroundColor: text.primary, borderWidth: 3, borderColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  startDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: bg.canvas },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "62%", gap: space.md, paddingHorizontal: space.lg, paddingTop: space.lg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface, ...FLOAT },
  list: { flexGrow: 0 },
  listBody: { gap: space.sm },
  card: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, paddingRight: space.md, borderRadius: radius.card, borderWidth: 2, borderColor: border.soft, backgroundColor: bg.surface },
  cardOn: { borderColor: accent.band, backgroundColor: accent.soft },
  preview: { width: 72, height: 72, borderRadius: 14, backgroundColor: bg.stage, alignItems: "center", justifyContent: "center" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cardTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary, flex: 1 },
  matchBox: { alignItems: "flex-end", marginBottom: -14 },
  match: { fontSize: 20, lineHeight: 22, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  matchUnit: { fontSize: 10, lineHeight: 12, fontWeight: "700", color: text.tertiary },
  cardLine: { ...type.caption, color: text.secondary, marginTop: 2, fontVariant: ["tabular-nums"] },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  tag: { fontSize: 11, fontWeight: "800", color: text.secondary, backgroundColor: bg.subtle, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden" },
  tagNew: { backgroundColor: "#E6F2E9", color: "#2F6B40" },
  tagWarn: { backgroundColor: "#FDF0D8", color: "#8A520C" },
  note: { ...type.caption, color: text.secondary, marginTop: space.xs },
  check: { position: "absolute", right: -4, top: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: accent.deep, borderWidth: 2, borderColor: bg.surface, alignItems: "center", justifyContent: "center" },
  small: { ...type.caption, color: text.tertiary, marginTop: space.xs },
  error: { ...type.supporting, color: "#B4442C" },
  state: { alignItems: "center", gap: space.sm, paddingVertical: space.lg },
  stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  stateTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary, textAlign: "center" },
  stateBody: { ...type.supporting, color: text.secondary, textAlign: "center", maxWidth: 320 },
  wide: { alignSelf: "stretch", marginTop: space.xs },
});
