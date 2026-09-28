import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { DropIcon, FireIcon, PawPrintIcon, PersonSimpleWalkIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const TYPICAL_DRY_KCAL = 360;

export const dailyNeeds = (weightKg: number, ageYears: number | null) => {
  const rer = 70 * Math.pow(weightKg, 0.75);
  const factor =
    ageYears == null ? 1.6 : ageYears < 0.34 ? 3 : ageYears < 1 ? 2 : ageYears >= 7 ? 1.4 : 1.6;
  const kcal = Math.round((rer * factor) / 10) * 10;
  return {
    kcal,
    waterMl: Math.round((weightKg * 55) / 50) * 50,
    treatKcal: Math.round(kcal * 0.1),
  };
};

const litres = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${ml} ml`);

export const DogNeeds = memo(
  ({
    dogName,
    weightKg,
    ageYears,
    planGrams,
    kcalPer100g: knownKcal,
    hasFood,
    exerciseMinutes,
    active,
    onLogWeight,
    onPickFood,
  }: {
    dogName: string;
    weightKg: number | null;
    ageYears: number | null;
    planGrams: number;
    kcalPer100g: number | null;
    hasFood: boolean;
    exerciseMinutes: number;
    active: boolean;
    onLogWeight: () => void;
    onPickFood: () => void;
  }) => {
    const needs = weightKg ? dailyNeeds(weightKg, ageYears) : null;
    const estimated = knownKcal == null && hasFood;
    const kcalPer100g = knownKcal ?? (hasFood ? TYPICAL_DRY_KCAL : null);
    const planKcal = kcalPer100g ? Math.round((planGrams * kcalPer100g) / 100) : null;
    const delta = needs && planKcal != null ? planKcal - needs.kcal : null;
    const close = delta != null && Math.abs(delta) <= needs!.kcal * 0.1;
    const gramsFix =
      delta != null && kcalPer100g ? Math.round(Math.abs(delta) / kcalPer100g * 100 / 5) * 5 : null;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Is {planGrams} g enough?</Text>
        <Text style={styles.lede}>
          Grams only tell half of it. What {dogName} needs is energy, water, a few treats and time to move.
        </Text>

        {!needs ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Log ${dogName}'s weight`}
            scaleTo={0.98}
            style={styles.missing}
            onPress={onLogWeight}
          >
            <Text style={styles.missingTitle}>Log {dogName}&rsquo;s weight</Text>
            <Text style={styles.missingText}>Weight is what sets the daily energy, water and treat amounts.</Text>
          </PressScale>
        ) : (
          <View style={styles.rows}>
            <View style={styles.row}>
              <Glyph icon={FireIcon} />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>Energy</Text>
                <Text style={styles.rowValue}>About {needs.kcal.toLocaleString()} kcal a day</Text>
                {planKcal != null ? (
                  <>
                    <Gauge value={planKcal} target={needs.kcal} active={active} />
                    <Text style={[styles.verdict, !close && styles.verdictStrong]}>
                      {estimated ? "With typical dry food. " : ""}
                      {close
                        ? `The plan gives ${planKcal.toLocaleString()} kcal. That is about right.`
                        : delta! < 0
                          ? `The plan gives ${planKcal.toLocaleString()} kcal, about ${Math.abs(delta!)} short. Add roughly ${gramsFix} g a day.`
                          : `The plan gives ${planKcal.toLocaleString()} kcal, about ${delta} over. Take off roughly ${gramsFix} g a day.`}
                    </Text>
                  </>
                ) : (
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Choose the food to compare calories"
                    scaleTo={0.96}
                    style={styles.inlineAction}
                    onPress={onPickFood}
                  >
                    <Text style={styles.inlineActionText}>Choose the food to compare</Text>
                  </PressScale>
                )}
              </View>
            </View>

            <View style={[styles.row, styles.rule]}>
              <Glyph icon={DropIcon} />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>Water</Text>
                <Text style={styles.rowValue}>About {litres(needs.waterMl)} a day</Text>
                <Text style={styles.note}>More on hot days and after walks. Keep the bowl full.</Text>
              </View>
            </View>

            <View style={[styles.row, styles.rule]}>
              <Glyph icon={PawPrintIcon} />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>Treats</Text>
                <Text style={styles.rowValue}>Under {needs.treatKcal} kcal a day</Text>
                <Text style={styles.note}>About a tenth of the day&rsquo;s energy, taken from the meals.</Text>
              </View>
            </View>

            <View style={[styles.row, styles.rule]}>
              <Glyph icon={PersonSimpleWalkIcon} />
              <View style={styles.copy}>
                <Text style={styles.rowTitle}>Movement</Text>
                <Text style={styles.rowValue}>{exerciseMinutes} min a day</Text>
                <Text style={styles.note}>Walks and play. Weigh {dogName} monthly to see the plan working.</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.fine}>
          Estimated from {weightKg ? `${weightKg} kg` : "weight"} and age. Your vet&rsquo;s advice comes first.
        </Text>
      </View>
    );
  },
);

DogNeeds.displayName = "DogNeeds";

const Glyph = ({ icon: Icon }: { icon: typeof FireIcon }) => (
  <View style={styles.glyph}>
    <Icon size={iconSize.standard} color={text.primary} weight="fill" />
  </View>
);

const Gauge = ({ value, target, active }: { value: number; target: number; active: boolean }) => {
  const reduceMotion = useReducedMotion();
  const max = Math.max(value, target) * 1.25;
  const fill = useSharedValue(reduceMotion ? value / max : 0);

  useEffect(() => {
    if (!active) return;
    fill.value = reduceMotion
      ? value / max
      : withDelay(200, withTiming(value / max, { duration: 700, easing: motion.easing.out }));
  }, [active, fill, max, reduceMotion, value]);

  const bar = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View style={styles.gauge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.gaugeFill, bar]} />
      <View style={[styles.marker, { left: `${(target / max) * 100}%` }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { marginTop: space.section, paddingTop: space.xl, borderTopWidth: 1, borderTopColor: border.soft },
  title: { fontSize: 24, lineHeight: 29, letterSpacing: -0.5, fontWeight: "700", color: text.primary },
  lede: { ...type.supporting, color: text.secondary, marginTop: space.xs },

  rows: { marginTop: space.lg },
  row: { flexDirection: "row", gap: space.md, paddingVertical: space.md },
  rule: { borderTopWidth: 1, borderTopColor: border.soft },
  glyph: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  rowTitle: { ...type.caption, fontWeight: "600", color: text.secondary },
  rowValue: { ...type.cardTitle, fontWeight: "700", color: text.primary, marginTop: 1 },
  note: { ...type.caption, color: text.tertiary, marginTop: 3 },
  verdict: { ...type.caption, color: text.secondary, marginTop: space.sm },
  verdictStrong: { color: text.primary, fontWeight: "600" },

  gauge: {
    height: 8,
    marginTop: space.sm,
    borderRadius: 4,
    backgroundColor: bg.subtle,
    overflow: "visible",
  },
  gaugeFill: { height: "100%", borderRadius: 4, backgroundColor: accent.deep },
  marker: {
    position: "absolute",
    top: -4,
    width: 3,
    height: 16,
    marginLeft: -1.5,
    borderRadius: 2,
    backgroundColor: text.primary,
  },

  inlineAction: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    height: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    justifyContent: "center",
  },
  inlineActionText: { ...type.caption, fontWeight: "700", color: text.primary },

  missing: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: accent.primary,
  },
  missingTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  missingText: { ...type.supporting, color: text.secondary, marginTop: 2 },

  fine: { ...type.caption, color: text.tertiary, marginTop: space.lg },
});
