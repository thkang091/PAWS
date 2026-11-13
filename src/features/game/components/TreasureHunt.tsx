import { memo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { accent, bg, border, radius, space, text, type } from "@/constants/design";

/** Thirty days as a little map: a few days already "found" (colour, shape, thing) and an X where it ends. */
const FOUND: Record<number, { color: string; shape: "dot" | "square" | "diamond" }> = {
  0: { color: "#FCD46F", shape: "dot" },
  1: { color: "#F3A27C", shape: "square" },
  3: { color: "#9ED3C2", shape: "diamond" },
  4: { color: "#FFFFFF", shape: "dot" },
  7: { color: "#F7C6D9", shape: "square" },
  8: { color: "#FCD46F", shape: "diamond" },
  12: { color: "#FFFFFF", shape: "square" },
  13: { color: "#9ED3C2", shape: "dot" },
};

export const TreasureArt = memo(({ width, tone = "card" }: { width: number; tone?: "card" | "sheet" }) => {
  const cols = 6;
  const gap = Math.max(4, Math.round(width * 0.02));
  const cell = Math.floor((width - gap * (cols - 1)) / cols);
  const empty = tone === "card" ? "rgba(255,255,255,0.18)" : "#E6F0F4";
  return (
    <View style={[styles.map, { width, gap }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 30 }, (_, i) => {
        const f = FOUND[i];
        const last = i === 29;
        return (
          <View key={i} style={[styles.cell, { width: cell, height: cell, borderRadius: cell * 0.3, backgroundColor: last ? accent.deep : empty }]}>
            {f ? (
              <View
                style={{
                  width: cell * 0.42,
                  height: cell * 0.42,
                  backgroundColor: tone === "sheet" && f.color === "#FFFFFF" ? "#7FB8CF" : f.color,
                  borderRadius: f.shape === "dot" ? cell : cell * 0.08,
                  transform: f.shape === "diamond" ? [{ rotate: "45deg" }] : undefined,
                }}
              />
            ) : last ? (
              <View style={styles.x}>
                <View style={[styles.bar, { width: cell * 0.5, transform: [{ rotate: "45deg" }] }]} />
                <View style={[styles.bar, { width: cell * 0.5, transform: [{ rotate: "-45deg" }] }]} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});
TreasureArt.displayName = "TreasureArt";

/** The monthly challenge in one look. It isn't playable yet, and says so. */
export const TreasureSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.soon}>
            <Text style={styles.soonText}>Starts soon</Text>
          </View>
          <Text style={styles.title}>30-Day Treasure Hunt</Text>
          <Text style={styles.line}>A new colour, shape or thing to find on every walk. Thirty finds fill the map.</Text>
          <View style={styles.art}>
            <TreasureArt width={280} tone="sheet" />
          </View>
          <Pressable accessibilityRole="button" style={styles.ok} onPress={onClose}>
            <Text style={styles.okText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  map: { flexDirection: "row", flexWrap: "wrap" },
  cell: { alignItems: "center", justifyContent: "center" },
  x: { alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", height: 3, borderRadius: 2, backgroundColor: text.primary },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28,27,26,0.32)" },
  sheet: { paddingHorizontal: space.xxl, paddingTop: space.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: border.default, marginBottom: space.lg },
  soon: { alignSelf: "flex-start", height: 28, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: "#E2F0F6", justifyContent: "center" },
  soonText: { fontSize: 13, fontWeight: "800", color: "#235F78" },
  title: { fontSize: 28, lineHeight: 32, fontWeight: "800", letterSpacing: -0.8, color: text.primary, marginTop: space.md },
  line: { ...type.body, color: text.secondary, marginTop: space.sm },
  art: { alignItems: "center", marginTop: space.xl },
  ok: { marginTop: space.xl, height: 54, borderRadius: radius.pill, backgroundColor: text.primary, alignItems: "center", justifyContent: "center" },
  okText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
});
