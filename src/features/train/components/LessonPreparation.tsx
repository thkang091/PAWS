import { StyleSheet, Text, View } from "react-native";
import { PlayIcon } from "phosphor-react-native";

import { bg, border, scene, space, text, type } from "@/constants/design";
import sources from "@/features/train/media/trainingVideoSources.json";

type Props = {
  skillCode?: string;
  purpose: string;
  materials: readonly { label: string; detail: string }[];
};

/**
 * Shared introduction for curriculum lessons and lessons awaiting video: who made the video as a quiet credit line, the
 * lesson's goal as the lead sentence, then what to have ready as a short numbered list.
 */
export function LessonPreparation({ skillCode, purpose, materials }: Props) {
  const credits = (sources as Record<string, { creator: string; url: string }[]>)[skillCode ?? ""] ?? [];
  const creators = [...new Set(credits.map(source => source.creator))];

  return (
    <View>
      {creators.length ? (
        <View style={styles.credit} accessible accessibilityLabel={`Video by ${creators.join(" and ")}`}>
          <View style={styles.play}>
            <PlayIcon size={9} color="#FFFFFF" weight="fill" />
          </View>
          <Text style={styles.creditText} numberOfLines={1}>
            Video by <Text style={styles.creditName}>{creators.join(" · ")}</Text>
          </Text>
        </View>
      ) : null}

      <Text style={styles.purpose}>{purpose}</Text>

      {materials.length ? (
        <>
          <Text style={styles.eyebrow}>BEFORE YOU START</Text>
          <View style={styles.list}>
            {materials.map((material, i) => (
              <View key={material.label} style={[styles.row, i > 0 && styles.rowRule]}>
                <Text style={styles.number}>{i + 1}</Text>
                <View style={styles.rowCopy}>
                  <Text style={styles.label}>{material.label}</Text>
                  {material.detail ? <Text style={styles.detail}>{material.detail}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  credit: { flexDirection: "row", alignItems: "center", gap: space.sm },
  play: { width: 18, height: 18, borderRadius: 9, backgroundColor: scene.sageDeep, alignItems: "center", justifyContent: "center", paddingLeft: 1 },
  creditText: { ...type.supporting, color: text.secondary, flexShrink: 1 },
  creditName: { fontWeight: "700", color: text.primary },

  purpose: { fontSize: 20, lineHeight: 28, fontWeight: "600", letterSpacing: -0.3, color: text.primary, marginTop: space.md },

  eyebrow: { ...type.caption, fontWeight: "800", letterSpacing: 0.7, color: text.tertiary, marginTop: space.xxl, marginBottom: space.sm },
  list: { borderRadius: 18, backgroundColor: bg.subtle, paddingHorizontal: space.lg },
  row: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingVertical: space.md },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  number: { width: 22, height: 22, borderRadius: 11, overflow: "hidden", backgroundColor: bg.canvas, textAlign: "center", lineHeight: 22, fontSize: 12, fontWeight: "800", color: text.secondary, fontVariant: ["tabular-nums"] },
  rowCopy: { flex: 1, gap: 2 },
  label: { ...type.supporting, fontWeight: "600", color: text.primary, lineHeight: 22 },
  detail: { ...type.supporting, color: text.secondary },
});
