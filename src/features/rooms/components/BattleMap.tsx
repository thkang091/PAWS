import { memo, useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Polygon, Polyline } from "react-native-maps";

import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import type { BattleState, RegionRoad, Team } from "@/services/roomService";
import { bg, text } from "@/constants/design";

type LatLng = { latitude: number; longitude: number };

/** Team colours, never used alone: blue is solid, orange is dashed, everywhere. */
export const TEAM_COLOR: Record<Team, string> = { blue: "#2F6FDE", orange: "#E08A1E" };
export const TEAM_DASH: Record<Team, number[] | undefined> = { blue: undefined, orange: [10, 6] };
export const TEAM_NAME: Record<Team, string> = { blue: "Blue", orange: "Orange" };

const ring = (coords: readonly number[][]): LatLng[] => coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

/** GeoJSON Polygon or MultiPolygon as map polygons with holes. */
const toPolygons = (g: NonNullable<BattleState["territory"][Team]>["geojson"]) => {
  if (!g) return [];
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates) as number[][][][];
  return polys.map((rings) => ({ outer: ring(rings[0]), holes: rings.slice(1).map(ring) }));
};

/**
 * The battlefield on the same Google map as every PAWS walk: each team's territory or roads, your own path, and a
 * short highlight on whatever was just captured. Other players' positions are never drawn.
 */
export const BattleMap = memo(
  ({
    state,
    roads,
    path,
    start,
    position,
    flash,
    follow,
    fitContent = false,
  }: {
    state: BattleState;
    roads: readonly RegionRoad[];
    path: readonly LatLng[];
    start: LatLng | null;
    position: LatLng | null;
    flash: { polygon?: LatLng[]; edgeId?: string } | null;
    follow: boolean;
    /** Frame every captured area and road once the map is ready (the result screen). */
    fitContent?: boolean;
  }) => {
    const map = useRef<MapView | null>(null);
    const lastFollow = useRef(0);
    const owner = useMemo(() => new Map(state.roads.map((r) => [r.edgeId, r.team])), [state.roads]);
    const territory = useMemo(
      () => (["blue", "orange"] as Team[]).flatMap((t) => toPolygons(state.territory[t]?.geojson ?? null).map((p, i) => ({ ...p, team: t, key: `${t}-${i}` }))),
      [state.territory],
    );
    const roadLines = useMemo(() => roads.map((r) => ({ ...r, path: ring(r.coords) })), [roads]);

    useEffect(() => {
      if (!follow || !position || Date.now() - lastFollow.current < 3_000) return;
      lastFollow.current = Date.now();
      map.current?.animateCamera({ center: position, zoom: 17 }, { duration: 600 });
    }, [follow, position]);

    const center = position ?? start ?? roadLines[0]?.path[0] ?? territory[0]?.outer[0] ?? null;
    if (!center) return <View style={styles.root} />;

    return (
      <View style={styles.root}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={{ ...center, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
          onMapReady={() => {
            if (!fitContent) return;
            const points = [...territory.flatMap((p) => p.outer), ...roadLines.flatMap((r) => [r.path[0], r.path[r.path.length - 1]])].filter(Boolean);
            if (points.length) map.current?.fitToCoordinates(points, { edgePadding: { top: 36, bottom: 36, left: 36, right: 36 }, animated: false });
          }}
          showsUserLocation={false}
          customMapStyle={QUIET_MAP}
          showsPointsOfInterests={false}
          showsCompass={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {territory.map((p) => (
            <Polygon key={p.key} coordinates={p.outer} holes={p.holes} fillColor={`${TEAM_COLOR[p.team]}40`} strokeColor="transparent" strokeWidth={0} />
          ))}
          {/* Google's iOS map can't dash a polygon border, so each outline is drawn as a line: solid for Blue, dashed
              for Orange, so the teams never differ by colour alone. */}
          {territory.flatMap((p) =>
            [p.outer, ...p.holes].map((ring, i) => (
              <Polyline key={`${p.key}-edge-${i}`} coordinates={ring} strokeColor={TEAM_COLOR[p.team]} strokeWidth={3} lineDashPattern={TEAM_DASH[p.team]} lineJoin="round" />
            )),
          )}
          {roadLines.map((r) => {
            const team = owner.get(r.id);
            return (
              <Polyline
                key={`${r.id}-${team ?? "none"}`}
                coordinates={r.path}
                strokeColor={team ? TEAM_COLOR[team] : `${text.primary}8C`}
                strokeWidth={team ? 7 : 4}
                lineDashPattern={team ? TEAM_DASH[team] : [2, 6]}
                lineCap="round"
              />
            );
          })}
          {flash?.polygon && flash.polygon.length > 2 ? <Polygon coordinates={flash.polygon} fillColor="#FFF3B066" strokeColor="#F5C518" strokeWidth={5} /> : null}
          {flash?.edgeId
            ? roadLines.filter((r) => r.id === flash.edgeId).map((r) => <Polyline key={`flash-${r.id}`} coordinates={r.path} strokeColor="#F5C518" strokeWidth={11} lineCap="round" />)
            : null}
          {path.length > 1 ? <Polyline coordinates={[...path]} strokeColor={text.primary} strokeWidth={4} lineCap="round" lineJoin="round" /> : null}
          {start ? (
            <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.startPin}>
                <View style={styles.startDot} />
              </View>
            </Marker>
          ) : null}
          {position ? <Circle center={position} radius={16} fillColor="#E9A73E2E" strokeColor="#E9A73E55" strokeWidth={1} /> : null}
          {position ? (
            <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.puck} />
            </Marker>
          ) : null}
        </MapView>
      </View>
    );
  },
);
BattleMap.displayName = "BattleMap";

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: bg.stage },
  startPin: { width: 24, height: 24, borderRadius: 12, backgroundColor: text.primary, borderWidth: 3, borderColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  startDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: bg.canvas },
  puck: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E9A73E", borderWidth: 4, borderColor: bg.canvas },
});
