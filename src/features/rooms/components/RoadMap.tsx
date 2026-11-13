import { forwardRef, memo, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Polygon, Polyline, PROVIDER_GOOGLE, type MapPressEvent } from "react-native-maps";

import type { RoadStatus } from "@/features/rooms/regionAdmin";
import { ROAD_STYLE, SELECTED_ROAD } from "@/features/rooms/components/RoadStyle";
import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import { bg, text } from "@/constants/design";

type LatLng = { latitude: number; longitude: number };
export type MapRoad = { id: string; status: RoadStatus; coords: readonly (readonly [number, number])[] };
export type RoadMapHandle = { focus: (id: string) => void; fitAll: () => void };

const toPath = (coords: MapRoad["coords"]): LatLng[] => coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));

/** Every few points of every road: enough to frame the area without handing the map thousands of coordinates. */
const framePoints = (roads: readonly { path: LatLng[] }[]) => {
  const all = roads.flatMap((r) => [r.path[0], r.path[r.path.length - 1]]).filter(Boolean);
  const step = Math.max(1, Math.floor(all.length / 400));
  return all.filter((_, i) => i % step === 0);
};

/**
 * Roads on the same Google map as every PAWS walk, styled by review state. Taps go to `onPressMap` with the map
 * coordinate; the screen decides which road was meant, because thin lines are hard to hit with a finger.
 */
export const RoadMap = memo(
  forwardRef<RoadMapHandle, { roads: readonly MapRoad[]; selectedId?: string | null; outline?: readonly (readonly [number, number])[]; onPressMap?: (p: LatLng) => void; style?: StyleProp<ViewStyle>; padding?: { top: number; bottom: number; left: number; right: number }; interactive?: boolean }>(
    ({ roads, selectedId, outline, onPressMap, style, padding = { top: 40, bottom: 40, left: 40, right: 40 }, interactive = true }, ref) => {
      const map = useRef<MapView | null>(null);
      const lines = useMemo(() => roads.map((r) => ({ ...r, path: toPath(r.coords) })), [roads]);
      const selected = lines.find((l) => l.id === selectedId) ?? null;
      const ring = useMemo(() => (outline && outline.length > 3 ? toPath(outline) : null), [outline]);

      const fitAll = useCallback(() => {
        const points = framePoints(lines);
        if (points.length) map.current?.fitToCoordinates(points, { edgePadding: padding, animated: true });
      }, [lines, padding]);

      useImperativeHandle(ref, () => ({
        focus: (id: string) => {
          const l = lines.find((x) => x.id === id);
          if (!l) return;
          // A 100 m road alone would zoom to building level; keep about 250 m of street around it.
          const lat = l.path.reduce((a, p) => a + p.latitude, 0) / l.path.length;
          const lng = l.path.reduce((a, p) => a + p.longitude, 0) / l.path.length;
          const pad = [{ latitude: lat + 0.0011, longitude: lng + 0.0014 }, { latitude: lat - 0.0011, longitude: lng - 0.0014 }];
          map.current?.fitToCoordinates([...l.path, ...pad], { edgePadding: padding, animated: true });
        },
        fitAll,
      }));

      const first = lines[0]?.path[0];
      if (!first) return <View style={[styles.root, style]} />;

      return (
        <View style={[styles.root, style]}>
          <MapView
            ref={map}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={{ ...first, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
            onMapReady={() => {
              const points = framePoints(lines);
              if (points.length) map.current?.fitToCoordinates(points, { edgePadding: padding, animated: false });
            }}
            onPress={(e: MapPressEvent) => onPressMap?.(e.nativeEvent.coordinate)}
            customMapStyle={QUIET_MAP}
            showsPointsOfInterests={false}
            showsCompass={false}
            toolbarEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            scrollEnabled={interactive}
            zoomEnabled={interactive}
          >
            {ring ? <Polygon coordinates={ring} strokeColor={`${text.primary}66`} strokeWidth={2} lineDashPattern={[6, 6]} fillColor={`${text.primary}0A`} /> : null}
            {selected ? <Polyline coordinates={selected.path} strokeColor={SELECTED_ROAD.color} strokeWidth={SELECTED_ROAD.width} lineCap="round" lineJoin="round" zIndex={1} /> : null}
            {lines.map((l) => {
              const s = ROAD_STYLE[l.status];
              return <Polyline key={`${l.id}-${l.status}`} coordinates={l.path} strokeColor={s.color} strokeWidth={s.width} lineDashPattern={s.dash} lineCap="round" lineJoin="round" zIndex={2} />;
            })}
          </MapView>
        </View>
      );
    },
  ),
);
RoadMap.displayName = "RoadMap";

const styles = StyleSheet.create({
  root: { backgroundColor: bg.stage, overflow: "hidden" },
});
