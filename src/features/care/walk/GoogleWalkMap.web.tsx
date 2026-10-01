import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polyline } from "react-native-svg";
import { bg, accent, text, type } from "@/constants/design";
import type { LatLng, WalkRoute } from "./walkRoutes";

export type MapMode = "plan" | "walking" | "done";

// react-native-maps cannot be imported on web: Expo Router also loads routes
// other than the current screen. Show an explicitly labelled route overview.
export function GoogleWalkMap({ routes, selectedId, position, trail }: {
  routes: readonly WalkRoute[];
  selectedId: string;
  mode: MapMode;
  progress: number;
  position: LatLng;
  trail?: readonly LatLng[];
}) {
  const selected = routes.find((route) => route.id === selectedId) ?? routes[0];
  const points = trail && trail.length > 1 ? trail : selected?.path ?? [];
  const bounds = [...points, position];
  const minLat = Math.min(...bounds.map((p) => p.latitude));
  const maxLat = Math.max(...bounds.map((p) => p.latitude));
  const minLng = Math.min(...bounds.map((p) => p.longitude));
  const maxLng = Math.max(...bounds.map((p) => p.longitude));
  const project = (p: LatLng) => ({
    x: 35 + (p.longitude - minLng) / Math.max(maxLng - minLng, 0.001) * 330,
    y: 290 - (p.latitude - minLat) / Math.max(maxLat - minLat, 0.001) * 240,
  });
  const current = project(position);
  return <View style={styles.root}>
    <Text style={styles.label}>Route overview · Open the mobile app for the map</Text>
    <Svg width="100%" height="70%" viewBox="0 0 400 400" accessibilityLabel="Schematic walking route">
      <Polyline points={points.map((p) => { const point = project(p); return `${point.x},${point.y}`; }).join(" ")} fill="none" stroke={accent.band} strokeWidth={5} strokeLinejoin="round" />
      <Circle cx={current.x} cy={current.y} r={7} fill={text.primary} />
    </Svg>
  </View>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: bg.stage, justifyContent: "center" },
  label: { ...type.caption, color: text.secondary, textAlign: "center", padding: 16 },
});
