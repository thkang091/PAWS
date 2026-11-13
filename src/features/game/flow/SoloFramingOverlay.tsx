import { StyleSheet, Text, View } from "react-native";
import { CheckIcon, MinusIcon } from "phosphor-react-native";
import { type as typography } from "@/constants/design";
import type { SoloFramingSnapshot, SoloFramingStatus } from "./soloFramingGuide";

export function SoloFramingReticle({ snapshot, width, height }: {
  snapshot: SoloFramingSnapshot; width: number; height: number;
}) {
  const tracking = snapshot.phase === "tracking" && snapshot.box !== undefined;
  const box = tracking ? snapshot.box! : { x: 0.16, y: 0.34, width: 0.68, height: 0.32 };
  const confident = tracking && snapshot.visibility === "good";
  return <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
    <View style={[styles.reticle, { left: box.x * width, top: box.y * height, width: box.width * width, height: box.height * height }]}>
      {tracking ? <View style={[styles.trackedBox, confident ? styles.found : styles.uncertain]} /> : <>
        <View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} />
        <View style={styles.centerDot} />
      </>}
    </View>
  </View>;
}

export function SoloFramingStatusRow({ snapshot }: { snapshot: SoloFramingSnapshot }) {
  return <View style={styles.statusRow}>
    <FramingStatus label="Distance" status={snapshot.distance} />
    <FramingStatus label="Visibility" status={snapshot.visibility} />
    <FramingStatus label="Position" status={snapshot.position} />
  </View>;
}

function FramingStatus({ label, status }: { label: string; status: SoloFramingStatus }) {
  const color = status === "good" ? "#D9EDB9" : status === "adjust" ? "#F1D993" : "#B7C1B9";
  const summary = status === "good" ? "Looks good" : status === "adjust" ? "Adjustment suggested" : "Not checked";
  return <View style={styles.status} accessible accessibilityLabel={`${label}: ${summary}`}>
    {status === "good" ? <CheckIcon size={13} weight="bold" color={color} /> : <MinusIcon size={13} color={color} />}
    <Text style={[styles.statusText, { color }]}>{label}</Text>
  </View>;
}

const styles = StyleSheet.create({
  reticle: { position: "absolute" },
  trackedBox: { ...StyleSheet.absoluteFill, borderWidth: 1.5, borderRadius: 12 },
  found: { borderColor: "rgba(217,237,185,0.88)" },
  uncertain: { borderColor: "rgba(255,255,255,0.4)", borderStyle: "dashed" },
  corner: { position: "absolute", width: 26, height: 26, borderColor: "rgba(255,255,255,0.65)" },
  topLeft: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 12 },
  centerDot: { position: "absolute", left: "50%", top: "50%", width: 4, height: 4, marginLeft: -2, marginTop: -2, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" },
  status: { flexDirection: "row", gap: 4, alignItems: "center" },
  statusText: { ...typography.caption, fontSize: 11, lineHeight: 16 },
});
