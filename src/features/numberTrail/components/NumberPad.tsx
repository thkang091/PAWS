import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as Haptics from "expo-haptics";
import { BackspaceIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { numberEntry } from "@/features/numberTrail/practiceFlow";
import { NT } from "@/features/numberTrail/theme";
import { bg, border, layout, space, text, type } from "@/constants/design";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

/**
 * Typing a number from 1 to 99: the number drawn as it will be walked, one line saying what's wrong (never corrected
 * for the player), and a large keypad. Keys don't animate beyond the press: they're pressed many times in a row.
 */
export const NumberPad = ({ typed, onKey, glyphH }: { typed: string; onKey: (k: string) => void; glyphH: number }) => {
  const entry = numberEntry(typed);
  // Three keys a row at any width and text size: sized from the screen, not from percentages.
  const { width } = useWindowDimensions();
  const keyW = Math.floor((width - layout.gutter * 2 - space.sm * 2) / 3);
  return (
    <View>
      <View style={[styles.preview, { height: glyphH + 48 }]} accessible accessibilityLabel={typed ? `Typed ${typed}` : "Nothing typed yet"} accessibilityLiveRegion="polite">
        {entry.ok ? (
          <NumberGlyph value={entry.number} height={glyphH} stroke={0.28} />
        ) : (
          // Drawn at the preview's own size (the label above carries it for screen readers and larger text).
          <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={[styles.typed, { fontSize: glyphH * 0.5 }]}>
            {typed || "1 to 99"}
          </Text>
        )}
      </View>
      <Text style={[styles.line, !entry.ok && typed ? styles.bad : null]} accessibilityLiveRegion="polite">
        {entry.line ?? " "}
      </Text>
      <View style={styles.keypad}>
        {KEYS.map((k) => (
          <PressScale
            key={k}
            accessibilityRole="button"
            accessibilityLabel={k === "back" ? "Delete" : k === "clear" ? "Clear" : k}
            scaleTo={0.95}
            style={[styles.key, { width: keyW }, k === "clear" || k === "back" ? styles.quiet : null]}
            onPress={() => {
              void Haptics.selectionAsync();
              onKey(k);
            }}
          >
            {k === "back" ? <BackspaceIcon size={24} color={text.primary} weight="bold" /> : <Text style={k === "clear" ? styles.clear : styles.keyText} maxFontSizeMultiplier={1.4}>{k === "clear" ? "Clear" : k}</Text>}
          </PressScale>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  preview: { marginHorizontal: layout.gutter, marginTop: space.lg, borderRadius: 28, backgroundColor: NT.block, alignItems: "center", justifyContent: "center" },
  typed: { fontWeight: "800", color: text.tertiary, letterSpacing: -1, fontVariant: ["tabular-nums"] },
  line: { ...type.supporting, fontWeight: "700", color: text.secondary, textAlign: "center", marginTop: space.sm },
  bad: { color: "#B4442C" },
  keypad: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: layout.gutter, marginTop: space.md, rowGap: space.sm, columnGap: space.sm },
  key: { height: 56, borderRadius: 18, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  quiet: { backgroundColor: bg.subtle, borderColor: "transparent" },
  keyText: { fontSize: 26, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  clear: { fontSize: 15, fontWeight: "800", color: text.secondary },
});
