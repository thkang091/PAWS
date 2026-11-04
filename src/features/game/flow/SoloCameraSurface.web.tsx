import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraIcon } from "phosphor-react-native";
import { scene, space, text } from "@/constants/design";

export type SoloCameraSurfaceProps = {
  active: boolean;
  onReadyChange: (ready: boolean) => void;
  facing: "back" | "front";
  showHint?: boolean;
};

export default function SoloCameraSurface({ active, onReadyChange, showHint = true }: SoloCameraSurfaceProps) {
  const callback = useRef(onReadyChange);
  callback.current = onReadyChange;
  useEffect(() => {
    callback.current(active);
    return () => callback.current(false);
  }, [active]);

  return <LinearGradient colors={[scene.sageDeep, "#414C43", "#252D29"]} locations={[0, 0.5, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.surface} pointerEvents="none">
    {showHint ? <View style={styles.label}>
      <CameraIcon size={28} color={text.inverse} weight="light" />
      <Text style={styles.title}>Camera preview</Text>
      <Text style={styles.description}>Live camera opens on your phone.</Text>
    </View> : null}
  </LinearGradient>;
}

const styles = StyleSheet.create({
  surface: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  label: { alignItems: "center", gap: space.sm, padding: space.xxl },
  title: { color: text.inverse, fontSize: 17, lineHeight: 22, fontWeight: "600" },
  description: { color: "#D8E0D5", fontSize: 13, lineHeight: 19, textAlign: "center" },
});