import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, Polygon, Polyline } from "react-native-maps";

import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import { GPS_RULES } from "../../../../supabase/functions/tournament/geo";
import { accent, bg, radius, text } from "@/constants/design";

export type LatLng = { latitude: number; longitude: number };

export type TerritoryMapHandle = { snapshot: () => Promise<string | null> };

/** A numbered checkpoint. `done` once your walk has reached it. */
export type MapPin = { id: string; number: number; latitude: number; longitude: number; done?: boolean };

/** Halo around the live dot, about a phone's usual GPS uncertainty on a street. */
const HALO_M = 18;
const FOLLOW_EVERY_MS = 2_500;

/**
 * The territory on the same Google map the walks use. While walking it follows you, draws each stretch of the walk
 * separately (never a line across a pause), rings the start with the 25 m finish circle and fills the shape once it
 * closes. On the result screen it frames the finished territory.
 */
export const TerritoryMap = memo(
  forwardRef<
    TerritoryMapHandle,
    {
      segments: readonly (readonly LatLng[])[];
      start: LatLng | null;
      position?: LatLng | null;
      outline?: readonly LatLng[] | null;
      showFinishRing?: boolean;
      follow?: boolean;
      bottomInset?: number;
      topInset?: number;
      pins?: readonly MapPin[];
      /** Follow the Shape: the picked walking route, drawn under the walk. */
      route?: readonly LatLng[] | null;
      /** The closest point of the route, shown when the walker has left it. Never joined to them by a line. */
      returnPoint?: LatLng | null;
    }
  >(({ segments, start, position, outline, showFinishRing = false, follow = false, bottomInset = 120, topInset = 120, pins, route, returnPoint }, ref) => {
    const map = useRef<MapView | null>(null);
    const lastFollow = useRef(0);
    // The puck is drawn once, then left still, so Google Maps on iOS never re-snapshots it into a blink.
    const [settling, setSettling] = useState(true);
    useEffect(() => {
      const id = setTimeout(() => setSettling(false), 600);
      return () => clearTimeout(id);
    }, []);

    useImperativeHandle(ref, () => ({
      snapshot: async () => {
        try {
          return (await map.current?.takeSnapshot({ format: "jpg", quality: 0.85, result: "file" })) ?? null;
        } catch {
          return null;
        }
      },
    }));

    useEffect(() => {
      if (!follow || !position || Date.now() - lastFollow.current < FOLLOW_EVERY_MS) return;
      lastFollow.current = Date.now();
      map.current?.animateCamera({ center: position, zoom: 17 }, { duration: 600 });
    }, [follow, position]);

    useEffect(() => {
      if (!outline || outline.length < 3) return;
      const id = setTimeout(() => {
        map.current?.fitToCoordinates([...outline], { edgePadding: { top: topInset, right: 48, bottom: bottomInset, left: 48 }, animated: true });
      }, 250);
      return () => clearTimeout(id);
    }, [outline, bottomInset, topInset]);

    // Frame the whole route once, before the walk starts following you.
    const framed = useRef(false);
    useEffect(() => {
      if (!route || route.length < 2 || framed.current) return;
      framed.current = true;
      const id = setTimeout(() => {
        map.current?.fitToCoordinates([...route], { edgePadding: { top: topInset, right: 48, bottom: bottomInset, left: 48 }, animated: false });
      }, 250);
      return () => clearTimeout(id);
    }, [route, bottomInset, topInset]);

    const center = position ?? start ?? outline?.[0] ?? route?.[0] ?? null;
    if (!center) return <View style={styles.root} />;

    return (
      <View style={styles.root} pointerEvents={follow ? "none" : "auto"}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_GOOGLE}
          initialRegion={{ ...center, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
          showsUserLocation={false}
          showsCompass={false}
          showsMyLocationButton={false}
          showsPointsOfInterests={false}
          customMapStyle={QUIET_MAP}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {outline && outline.length >= 3 ? (
            <Polygon coordinates={[...outline]} fillColor={`${accent.deep}73`} strokeColor={accent.band} strokeWidth={4} lineJoin="round" />
          ) : null}
          {route && route.length > 1 ? (
            <>
              <Polyline coordinates={[...route]} strokeColor={`${accent.band}59`} strokeWidth={14} lineCap="round" lineJoin="round" zIndex={0} />
              <Polyline coordinates={[...route]} strokeColor={accent.band} strokeWidth={3} lineDashPattern={[8, 6]} lineJoin="round" zIndex={0} />
            </>
          ) : null}
          {returnPoint ? (
            <Marker coordinate={returnPoint} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false} zIndex={3}>
              <View style={styles.back}>
                <View style={styles.backDot} />
              </View>
            </Marker>
          ) : null}
          {segments.map((seg, i) =>
            seg.length > 1 ? <Polyline key={i} coordinates={[...seg]} strokeColor={text.primary} strokeWidth={5} lineCap="round" lineJoin="round" /> : null,
          )}
          {start && showFinishRing ? (
            <Circle center={start} radius={GPS_RULES.closureM} fillColor={`${accent.deep}26`} strokeColor={`${text.primary}66`} strokeWidth={2} lineDashPattern={[6, 6]} />
          ) : null}
          {start ? (
            <Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={3}>
              <View style={styles.startPin}>
                <View style={styles.startDot} />
              </View>
            </Marker>
          ) : null}
          {pins?.map((p) => (
            <Marker key={`${p.id}-${p.done ? 1 : 0}`} coordinate={p} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} zIndex={2}>
              <View style={[styles.pin, p.done && styles.pinDone]}>
                <Text style={styles.pinText}>{p.number}</Text>
              </View>
            </Marker>
          ))}
          {position ? <Circle center={position} radius={HALO_M} fillColor={`${accent.band}2E`} strokeColor={`${accent.band}55`} strokeWidth={1} zIndex={1} /> : null}
          {position ? (
            <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={settling} zIndex={4}>
              <View style={styles.puckWrap}>
                <View style={styles.puck} />
              </View>
            </Marker>
          ) : null}
        </MapView>
      </View>
    );
  }),
);
TerritoryMap.displayName = "TerritoryMap";

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: bg.stage },
  startPin: { width: 26, height: 26, borderRadius: radius.pill, backgroundColor: text.primary, borderWidth: 3, borderColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  startDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: bg.canvas },
  pin: { width: 30, height: 30, borderRadius: 15, backgroundColor: bg.canvas, borderWidth: 3, borderColor: text.primary, alignItems: "center", justifyContent: "center" },
  pinDone: { backgroundColor: accent.deep, borderColor: accent.band },
  pinText: { fontSize: 13, fontWeight: "800", color: text.primary },
  back: { width: 22, height: 22, borderRadius: 11, backgroundColor: accent.band, borderWidth: 3, borderColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  backDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: bg.canvas },
  puckWrap: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  puck: {
    width: 20,
    height: 20,
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
