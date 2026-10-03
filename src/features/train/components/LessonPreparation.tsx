import { StyleSheet, Text, View } from "react-native";
import { accent, radius, space, text, type } from "@/constants/design";
import sources from "@/features/train/media/trainingVideoSources.json";

type Props = {
  skillCode?: string;
  purpose: string;
  materials: readonly { label: string; detail: string }[];
};

/** Shared introduction for curriculum lessons and lessons awaiting video. */
export function LessonPreparation({ skillCode, purpose, materials }: Props) {
  const credits = (sources as Record<string, { creator: string; url: string }[]>)[skillCode ?? ""] ?? [];
  const creators = [...new Set(credits.map(source => source.creator))];

  return (
    <View>
      <View style={styles.source}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>{creators[0]?.slice(0, 1) ?? "–"}</Text>
        </View>
        <View style={styles.sourceCopy}>
          <Text style={styles.sourceName}>{creators.join(" · ") || "Video coming soon"}</Text>
          <Text style={styles.sourceLabel}>{creators.length ? "Certified dog trainer" : "Source to be added"}</Text>
        </View>
      </View>
      <Text style={styles.purpose}>{purpose}</Text>
      <Text style={styles.heading}>Before you start</Text>
      <View style={styles.materials}>
        {materials.map(material => (
          <View key={material.label} style={styles.material}>
            <View style={styles.bullet} />
            <Text style={styles.materialCopy}>
              <Text style={styles.materialLabel}>{material.label}</Text>
              {material.detail ? ` — ${material.detail}` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  source: { flexDirection: "row", alignItems: "center", gap: space.md },
  avatar: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  initial: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  sourceCopy: { flex: 1 },
  sourceName: { ...type.supporting, fontWeight: "600", color: text.primary },
  sourceLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  purpose: { ...type.body, color: text.secondary, marginTop: space.lg },
  heading: { ...type.sectionTitle, color: text.primary, marginTop: space.xl },
  materials: { gap: space.sm, marginTop: space.md },
  material: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: accent.deep, marginTop: 8 },
  materialCopy: { ...type.supporting, color: text.secondary, flex: 1 },
  materialLabel: { fontWeight: "600", color: text.primary },
});
