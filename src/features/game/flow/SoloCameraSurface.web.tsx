import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CameraIcon } from "phosphor-react-native";
import { scene, space, text } from "@/constants/design";

export type SoloCameraSurfaceProps = {
  active: boolean;
  onReadyChange: (ready: boolean) => void;
  facing: "back" | "front";
};

export type SoloCameraHandle = {
  record: (options: { maxDuration: number }) => Promise<{ uri: string }>;
  stop: () => void;
};

const SoloCameraSurface = forwardRef<SoloCameraHandle, SoloCameraSurfaceProps>(function SoloCameraSurface({ active, onReadyChange }, ref) {
  const callback = useRef(onReadyChange);
  callback.current = onReadyChange;
  useEffect(() => {
    callback.current(false);
    return () => callback.current(false);
  }, [active]);

  useImperativeHandle(ref, () => ({
    async record() { throw new Error("Recording is available in the PAWS phone app."); },
    stop() {},
  }), []);

  return <LinearGradient colors={[scene.sageDeep, "#414C43", "#252D29"]} locations={[0, 0.5, 1]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.surface} pointerEvents="none">
    {active ? <View style={styles.label}>
      <CameraIcon size={28} color={text.inverse} weight="light" />
      <Text style={styles.title}>Record on your phone</Text>
    </View> : null}
  </LinearGradient>;
});

export default SoloCameraSurface;

const styles = StyleSheet.create({
  surface: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  label: { alignItems: "center", gap: space.sm, padding: space.xxl },
  title: { color: text.inverse, fontSize: 17, lineHeight: 22, fontWeight: "600" },
});
