import { memo, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";

import {
  HOME,
  pathUpTo,
  regionFor,
  type LatLng,
  type WalkRoute,
} from "@/features/care/walk/walkRoutes";
import { accent, bg, radius, text } from "@/constants/design";

export type MapMode = "plan" | "walking" | "done";

export const GoogleWalkMap = memo(
  ({
    routes,
    selectedId,
    mode,
    progress,
    position,
    trail,
  }: {
    routes: readonly WalkRoute[];
    selectedId: string;
    mode: MapMode;
    progress: number;
    position: LatLng;
    /** The dog's real GPS trail this walk, in order. Falls back to the planned route split by progress. */
    trail?: readonly LatLng[];
  }) => {
    const mapRef = useRef<MapView | null>(null);
    const selected = routes.find((route) => route.id === selectedId) ?? routes[0];
    const planning = mode === "plan";
    const walkedPath =
      trail && trail.length > 1 ? trail : pathUpTo(selected.path, progress);

    useEffect(() => {
      mapRef.current?.animateToRegion(regionFor(selected.path), planning ? 400 : 0);
    }, [selected.path, selected.id, planning]);

    useEffect(() => {
      if (mode !== "walking") return;
      mapRef.current?.animateCamera({ center: position }, { duration: 500 });
    }, [mode, position]);

    return (
      <View style={styles.root} pointerEvents={planning ? "auto" : "none"}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={regionFor(selected.path)}
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

          {!planning && walkedPath.length > 1 ? (
            <Polyline
              coordinates={[...walkedPath]}
              strokeColor={text.primary}
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          ) : null}

          <Marker coordinate={HOME} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <HomePin />
          </Marker>

          {!planning ? (
            <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }}>
              <DogPuck pulsing={mode === "walking"} />
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

const DogPuck = ({ pulsing }: { pulsing: boolean }) => {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || !pulsing) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse, pulsing, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 1.8 }],
  }));

  return (
    <View style={styles.puckWrap}>
      <Animated.View style={[styles.puckRing, ring]} />
      <View style={styles.puckDot} />
    </View>
  );
};

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
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  puckRing: {
    position: "absolute",
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  puckDot: {
    width: PUCK_SIZE,
    height: PUCK_SIZE,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    borderWidth: 4,
    borderColor: bg.canvas,
  },
});
