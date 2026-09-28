import { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ArrowUpRightIcon,
  BandaidsIcon,
  BugIcon,
  DropIcon,
  PillIcon,
  PrescriptionIcon,
  StorefrontIcon,
} from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { PanelHead } from "@/components/ui/panels";
import { PressScale } from "@/components/ui/PressScale";
import { useMedications } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { openLink } from "@/lib/openLink";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const SUPPLIES = [
  { key: "flea-tick", label: "Flea & tick prevention", glyph: BugIcon },
  { key: "wound-care", label: "Wound care & bandages", glyph: BandaidsIcon },
  { key: "supplements", label: "Supplements & joint care", glyph: DropIcon },
] as const;

export default function PharmacyScreen() {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const medications = useMedications(dogId);

  const active = useMemo(() => medications.data ?? [], [medications.data]);

  const enter = (order: number) =>
    reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

  const requestRefill = (name: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void openLink(`mailto:?subject=${encodeURIComponent(`Refill request: ${name}`)}`);
  };

  return (
    <DetailShell
      title="Pet pharmacy"
      glyph={<PrescriptionIcon size={iconSize.standard} color={text.primary} weight="regular" />}
    >
      <Animated.View entering={enter(0)}>
        <PanelHead title="Current prescriptions" />
        {active.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No active medications on record.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {active.map((med, index) => (
              <View key={med.id} style={[styles.row, index > 0 && styles.ruled]}>
                <View style={styles.rowDisc}>
                  <PillIcon size={iconSize.standard} color={text.primary} weight="regular" />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {med.medicationName}
                  </Text>
                  <Text style={styles.rowDetail} numberOfLines={1}>
                    {[med.dosage, med.frequency].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Request a refill for ${med.medicationName}`}
                  scaleTo={0.95}
                  style={styles.refillButton}
                  onPress={() => requestRefill(med.medicationName)}
                >
                  <Text style={styles.refillText}>Refill</Text>
                </PressScale>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <PanelHead title="Order supplies" />
        <View style={styles.list}>
          {SUPPLIES.map((item, index) => (
            <PressScale
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={`Order ${item.label}`}
              scaleTo={0.985}
              style={[styles.row, index > 0 && styles.ruled]}
              onPress={() => void Haptics.selectionAsync()}
            >
              <View style={styles.rowDisc}>
                <item.glyph size={iconSize.standard} color={text.primary} weight="regular" />
              </View>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <ArrowUpRightIcon size={iconSize.inline} color={border.strong} weight="bold" />
            </PressScale>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={enter(2)}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Find a nearby pharmacy"
          scaleTo={0.985}
          style={[styles.finder, styles.sectionSpacing]}
          onPress={() => void Linking.openURL("https://maps.apple.com/?q=pet+pharmacy")}
        >
          <View style={styles.finderDisc}>
            <StorefrontIcon size={iconSize.standard} color={text.primary} weight="regular" />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>Find a nearby pharmacy</Text>
            <Text style={styles.rowDetail}>Compare prices and pick up in person</Text>
          </View>
          <ArrowUpRightIcon size={iconSize.inline} color={text.primary} weight="bold" />
        </PressScale>
      </Animated.View>
    </DetailShell>
  );
}

const styles = StyleSheet.create({
  sectionSpacing: { marginTop: space.section },
  empty: { marginTop: space.lg, alignItems: "flex-start" },
  emptyText: { ...type.supporting, color: text.tertiary },

  list: {
    marginTop: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    backgroundColor: bg.canvas,
  },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  rowDisc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary, flex: 1 },
  rowDetail: { ...type.caption, color: text.tertiary, marginTop: 2 },

  refillButton: {
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  refillText: { ...type.caption, fontWeight: "700", color: text.primary },

  finder: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: accent.soft,
  },
  finderDisc: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
});
