import { memo, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from "react-native-maps";
import { MapPinIcon, TreeIcon } from "phosphor-react-native";

import type { PlannedRoute, Spot } from "@/features/care/walk/routePlanner";
import type { LatLng } from "@/features/care/walk/walkRoutes";
import { accent, bg, radius, text, type } from "@/constants/design";

export const PlannerMap = memo(
  ({
    start,
    spots,
    routes,
    selectedId,
    pin,
    bottomInset,
    onSelectRoute,
    onSelectSpot,
    onDropPin,
  }: {
    start: LatLng;
    spots: readonly Spot[];
    routes: readonly PlannedRoute[];
    selectedId: string | null;
    pin: LatLng | null;
    bottomInset: number;
    onSelectRoute: (id: string) => void;
    onSelectSpot: (spot: Spot) => void;
    onDropPin: (point: LatLng) => void;
  }) => {
    const mapRef = useRef<MapView | null>(null);
    const selected = routes.find((route) => route.id === selectedId) ?? null;

    useEffect(() => {
      const points = selected ? [...selected.path] : [start];
      if (points.length < 2) {
        mapRef.current?.animateToRegion({ ...start, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 350);
        return;
      }
      mapRef.current?.fitToCoordinates(points, {
        edgePadding: { top: 140, right: 48, bottom: bottomInset + 32, left: 48 },
        animated: true,
      });
    }, [selected, start, bottomInset]);

    return (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{ ...start, latitudeDelta: 0.014, longitudeDelta: 0.014 }}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onLongPress={(event) => onDropPin(event.nativeEvent.coordinate)}
      >
        {routes
          .filter((route) => route.id !== selectedId)
          .map((route) => (
            <Polyline
              key={route.id}
              coordinates={[...route.path]}
              strokeColor="rgba(28,27,26,0.35)"
              strokeWidth={4}
              lineDashPattern={[2, 8]}
              lineCap="round"
              lineJoin="round"
              tappable
              onPress={() => onSelectRoute(route.id)}
            />
          ))}

        {selected ? (
          <>
            <Polyline key={`${selected.id}-edge`} coordinates={[...selected.path]} strokeColor={text.primary} strokeWidth={9} lineCap="round" lineJoin="round" />
            <Polyline key={`${selected.id}-line`} coordinates={[...selected.path]} strokeColor={accent.deep} strokeWidth={5} lineCap="round" lineJoin="round" />
          </>
        ) : null}

        {spots.map((spot) => {
          const on = selected?.via?.latitude === spot.latitude && selected?.via?.longitude === spot.longitude;
          return (
            <Marker
              key={spot.id}
              coordinate={spot}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
              onPress={(event) => {
                event.stopPropagation();
                onSelectSpot(spot);
              }}
            >
              <View style={styles.spot}>
                <View style={[styles.spotChip, on && styles.spotChipOn]}>
                  <TreeIcon size={12} color={on ? text.inverse : text.primary} weight="fill" />
                  <Text style={[styles.spotText, on && styles.spotTextOn]} numberOfLines={1}>
                    {spot.name}
                  </Text>
                </View>
                <View style={[styles.spotTail, on && styles.spotTailOn]} />
              </View>
            </Marker>
          );
        })}

        {pin ? (
          <Marker coordinate={pin} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
            <MapPinIcon size={36} color={text.primary} weight="fill" />
          </Marker>
        ) : null}

        <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.home}>
            <View style={styles.homeDot} />
          </View>
        </Marker>
      </MapView>
    );
  },
);

PlannerMap.displayName = "PlannerMap";

const styles = StyleSheet.create({
  spot: { alignItems: "center", maxWidth: 150 },
  spotChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  spotChipOn: { backgroundColor: text.primary },
  spotText: { ...type.caption, fontWeight: "700", color: text.primary, flexShrink: 1 },
  spotTextOn: { color: text.inverse },
  spotTail: { width: 8, height: 8, marginTop: -4, transform: [{ rotate: "45deg" }], backgroundColor: bg.canvas },
  spotTailOn: { backgroundColor: text.primary },
  home: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: text.primary,
    borderWidth: 3,
    borderColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  homeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: bg.canvas },
});
