import { memo, useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";

import {
  regionFor,
  type LatLng,
  type WalkRoute,
} from "@/features/care/walk/walkRoutes";
import { distanceKm } from "@/features/care/walk/routePlanner";
import { accent, bg, radius, text } from "@/constants/design";

/** How close the phone must be to the planned route before the map follows it. */
const NEAR_ROUTE_KM = 1.5;
/** How far apart you and a planned start can be and still share one map while PAWS asks what to do. */
const AWAY_FRAME_KM = 50;

export type MapMode = "plan" | "walking" | "done";

export const GoogleWalkMap = memo(
  ({
    routes,
    selectedId,
    mode,
    progress,
    position,
    trail,
    away = false,
    approach,
  }: {
    routes: readonly WalkRoute[];
    selectedId: string;
    mode: MapMode;
    progress: number;
    position: LatLng | null;
    /** While the phone is away from the chosen start, frame both so the way there is clear. */
    away?: boolean;
    /** The walking way from the phone to a start set somewhere else, drawn dotted. */
    approach?: readonly LatLng[];
    /** The dog's real GPS trail this walk, in order. Empty until the first GPS fix. */
    trail?: readonly LatLng[];
  }) => {
    const mapRef = useRef<MapView | null>(null);
    // Let the marker capture its drawn view once, then stop re-capturing so it never flickers.
    const [puckSettling, setPuckSettling] = useState(true);
    useEffect(() => {
      const id = setTimeout(() => setPuckSettling(false), 600);
      return () => clearTimeout(id);
    }, []);
    const selected = routes.find((route) => route.id === selectedId) ?? routes[0];
    const planning = mode === "plan";
    const walkedPath = trail ?? [];
    // The map is about the route you planned. Your own dot only joins it once you are close enough to be on it;
    // a phone miles away must never drag the camera out to a whole continent.
    // A free walk has no route to stay near: the map simply follows you.
    // While asking whether you are somewhere else, show you and the planned start together, as long as both fit a city view.
    const near =
      Boolean(position) &&
      (selected.path.length < 2 ||
        Boolean(approach?.length) ||
        selected.path.some((point) => distanceKm(point, position!) <= NEAR_ROUTE_KM) ||
        (away && Boolean(selected.path[0]) && distanceKm(selected.path[0], position!) <= AWAY_FRAME_KM));

    const frame = useCallback(
      (animated: boolean) => {
        if (selected.path.length < 2) {
          mapRef.current?.animateToRegion(regionFor(selected.path), animated ? 400 : 0);
          return;
        }
        mapRef.current?.fitToCoordinates([...selected.path], {
          edgePadding: { top: 130, right: 56, bottom: planning ? 500 : 420, left: 56 },
          animated,
        });
      },
      [selected.path, planning],
    );

    useEffect(() => {
      frame(planning);
    }, [frame, selected.id, planning]);

    useEffect(() => {
      if (mode !== "walking" || !position || !near) return;
      if (away) {
        mapRef.current?.fitToCoordinates([position, ...(approach ?? []), ...selected.path], {
          edgePadding: { top: 130, right: 56, bottom: 420, left: 56 },
          animated: true,
        });
        return;
      }
      // No route to frame (a free walk): follow the dog at street level.
      mapRef.current?.animateCamera(selected.path.length < 2 ? { center: position, zoom: 16.5 } : { center: position }, { duration: 500 });
    }, [mode, position, near, away, selected.path, approach]);

    return (
      <View style={styles.root} pointerEvents={planning ? "auto" : "none"}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={regionFor(selected.path)}
          onMapReady={() => frame(false)}
          showsUserLocation={false}
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {planning
            ? routes
                .filter((route) => route.id !== selected.id)
                .map((route) => (
                  <Polyline
                    key={route.id}
                    coordinates={[...route.path]}
                    strokeColor={`${text.primary}38`}
                    strokeWidth={3}
                    lineDashPattern={[1, 8]}
                    lineCap="round"
                    lineJoin="round"
                  />
                ))
            : null}

          <Polyline
            key={`${selected.id}-planned`}
            coordinates={[...selected.path]}
            strokeColor={accent.deep}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />

          {approach && approach.length > 1 ? (
            <Polyline
              key="approach"
              coordinates={[...approach]}
              strokeColor={text.primary}
              strokeWidth={4}
              lineDashPattern={[2, 7]}
              lineCap="round"
              lineJoin="round"
            />
          ) : null}

          {!planning && walkedPath.length > 1 ? (
            <Polyline
              coordinates={[...walkedPath]}
              strokeColor={text.primary}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          ) : null}

          {selected.path[0] ? (
            <Marker coordinate={selected.path[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <HomePin />
            </Marker>
          ) : null}

          {/* The live dot is drawn by the map itself: a soft halo circle plus a still marker. An animated custom
              marker is re-snapshotted on every frame by Google Maps on iOS, which is what made it blink. */}
          {!planning && position && near ? (
            <Circle center={position} radius={HALO_M} fillColor={`${accent.band}2E`} strokeColor={`${accent.band}55`} strokeWidth={1} zIndex={1} />
          ) : null}
          {!planning && position && near ? (
            <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={puckSettling} zIndex={2}>
              <DogPuck />
            </Marker>
          ) : null}
        </MapView>
      </View>
    );
  },
);

GoogleWalkMap.displayName = "GoogleWalkMap";

const HomePin = () => (
  <View style={styles.homePin}>
    <View style={styles.homeDot} />
  </View>
);

/** Where you are: a still butter dot with a white rim, sitting on the halo the map draws underneath. */
const DogPuck = () => (
  <View style={styles.puckWrap}>
    <View style={styles.puckDot} />
  </View>
);

/** Halo radius in metres, about the size of a phone's usual GPS uncertainty on a street. */
const HALO_M = 22;

const HOME_SIZE = 26;
const PUCK_SIZE = 20;

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: bg.stage },
  homePin: {
    width: HOME_SIZE,
    height: HOME_SIZE,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    borderWidth: 3,
    borderColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  homeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: bg.canvas },
  puckWrap: {
    width: PUCK_SIZE + 8,
    height: PUCK_SIZE + 8,
    alignItems: "center",
    justifyContent: "center",
  },
  puckDot: {
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    borderRadius: radius.pill,
    backgroundColor: accent.band,
    borderWidth: 4,
    borderColor: bg.canvas,
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
