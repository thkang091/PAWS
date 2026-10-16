import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Redirect, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon } from "phosphor-react-native";

import { SetupShell, setupText } from "@/features/care/components/SetupShell";
import { Alternatives } from "@/features/care/food/FoodPlanFlow";
import { Card, Checks, FitChip, partsStyles } from "@/features/care/food/FoodPlanParts";
import { useDogBasis } from "@/features/care/food/useDogBasis";
import { useCommitPlan } from "@/features/care/food/usePlan";
import { mealTimesIn, planResult } from "@/features/care/food/planResult";
import { useCareOnboarding } from "@/features/care/state/careOnboarding";
import { alternativesQuery, basisChanges, formatAmount, type BasisChange } from "@/features/care/food/foodPlanMath";
import { dismissPlanReview, useFoodPlan } from "@/features/care/state/foodPlan";
import { findAlternatives, type Lookup, type Product } from "@/services/productLookup";
import { useCareProfile } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { PressScale } from "@/components/ui/PressScale";
import { accent, border, motion, space, text, type } from "@/constants/design";

/** Has anything feeding depends on moved since the plan was saved? Drives "{name}'s needs have changed". */
export const useFoodPlanReview = () => {
  const store = useFoodPlan();
  const { basis } = useDogBasis();
  return useMemo(() => {
    if (!store.plan) return { due: false, changes: [] as BasisChange[], signature: "" };
    const changes = basisChanges(store.plan.basis, basis);
    if (JSON.stringify(store.plan.prefs) !== JSON.stringify(store.prefs)) changes.push({ key: "prefs", text: "Food preferences changed" });
    const signature = changes.map((c) => c.text).join("|");
    return { due: changes.length > 0 && signature !== store.dismissed, changes, signature };
  }, [store.plan, store.prefs, store.dismissed, basis]);
};

/** Recalculate the saved plan for the dog as it is now, and show only what changed. */
export const FoodPlanReview = () => {
  const store = useFoodPlan();
  const plan = store.plan;
  const { basis } = useDogBasis();
  const review = useFoodPlanReview();
  const dog = useCurrentDog();
  const careProfile = useCareProfile(dog.data?.id);
  const { choice } = useCareOnboarding();
  const mealsPerDay = mealTimesIn(careProfile.data?.mealTimes, choice?.mealTimes).length;
  const name = basis.name;

  const next = useMemo(
    () => (plan ? planResult({ basis, prefs: store.prefs, food: plan.food, unit: plan.unit, treats: plan.treats, mealsPerDay }) : null),
    [plan, basis, store.prefs, mealsPerDay],
  );

  const [alternatives, setAlternatives] = useState<Lookup<Product[]> | "loading" | null>(null);
  const foodBad = next?.food?.mark === "bad";
  useEffect(() => {
    if (!foodBad || !plan) return;
    let live = true;
    setAlternatives("loading");
    void findAlternatives(alternativesQuery(basis, store.prefs, "food"), "food", plan.food.product.name).then((found) => live && setAlternatives(found));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodBad]);

  // No plan to review (or nothing to recalculate yet): open setup instead of a blank screen.
  if (!plan || !next) return <Redirect href={"/care/food-plan" as never} />;

  const before = plan.result;
  const deltas: { label: string; from: string; to: string }[] = [];
  if (next.energy && next.energy.kcal !== before.kcal) deltas.push({ label: "Daily energy", from: `${before.kcal} kcal`, to: `${next.energy.kcal} kcal` });
  if (next.amount != null && before.amount != null && next.amount !== before.amount) {
    deltas.push({ label: "Main food a day", from: formatAmount(before.amount, plan.unit), to: formatAmount(next.amount, plan.unit) });
  }
  if (next.energy && next.energy.treatKcal !== before.treatKcal) deltas.push({ label: "Treat allowance", from: `${before.treatKcal} kcal`, to: `${next.energy.treatKcal} kcal` });

  const fitChanges = [
    ...(next.food && next.food.mark !== before.foodMark ? [{ name: plan.food.product.name, mark: next.food.mark }] : []),
    ...next.treats.filter((t) => before.treatMarks[t.item.product.id] && t.verdict.mark !== before.treatMarks[t.item.product.id]).map((t) => ({ name: t.item.product.name, mark: t.verdict.mark })),
  ];
  const newIssues = next.issues.filter((i) => i.mark === "bad" || fitChanges.length > 0);

  const commit = useCommitPlan();
  const update = () => {
    if (!next.energy) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    commit({ food: plan.food, unit: plan.unit, treats: plan.treats, basis, prefs: store.prefs });
    router.back();
  };

  return (
    <SetupShell
      step={0}
      total={1}
      direction={1}
      closing
      onBack={() => router.back()}
      primary={{ label: "Update Food Plan", done: true, onPress: update }}
    >
      <Text style={setupText.title}>{`${name}'s needs have changed`}</Text>
      <Text style={setupText.note}>PAWS recalculated the plan. Only what changed is shown.</Text>

      <Text style={partsStyles.section}>What changed</Text>
      <View style={styles.changes}>
        {review.changes.map((change, index) => (
          <Animated.View key={change.key} entering={FadeIn.duration(motion.duration.enter).delay(index * motion.stagger)} style={styles.change}>
            <View style={styles.dot} />
            <Text style={styles.changeText}>{change.text}</Text>
          </Animated.View>
        ))}
      </View>

      {deltas.length ? (
        <Card tone="butter">
          {deltas.map((delta) => (
            <View key={delta.label} style={styles.delta}>
              <Text style={styles.deltaLabel}>{delta.label}</Text>
              <View style={styles.deltaValues}>
                <Text style={styles.from}>{delta.from}</Text>
                <ArrowRightIcon size={13} color={text.secondary} weight="bold" />
                <Text style={styles.to}>{delta.to}</Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Text style={[setupText.note, styles.same]}>Amounts stay the same.</Text>
      )}

      {fitChanges.length ? (
        <>
          <Text style={partsStyles.section}>Fit</Text>
          {fitChanges.map((change) => (
            <View key={change.name} style={styles.fitRow}>
              <Text style={styles.fitName} numberOfLines={2}>
                {change.name}
              </Text>
              <FitChip mark={change.mark} />
            </View>
          ))}
        </>
      ) : null}

      {newIssues.length ? (
        <>
          <Text style={partsStyles.section}>Why</Text>
          <Checks checks={newIssues} />
        </>
      ) : null}

      {foodBad ? <Alternatives name={name} state={alternatives} onUse={() => router.replace("/care/food-plan?edit=food" as never)} /> : null}

      <View style={styles.links}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Not now"
          scaleTo={0.96}
          style={styles.link}
          onPress={() => {
            dismissPlanReview(review.signature);
            router.back();
          }}
        >
          <Text style={styles.linkText}>Not now</Text>
        </PressScale>
        <PressScale accessibilityRole="button" accessibilityLabel="Edit the whole plan" scaleTo={0.96} style={styles.link} onPress={() => router.replace("/care/food-plan?edit=profile" as never)}>
          <Text style={styles.linkText}>Edit the whole plan</Text>
        </PressScale>
      </View>
    </SetupShell>
  );
};

const styles = StyleSheet.create({
  changes: { gap: space.sm },
  change: { flexDirection: "row", alignItems: "center", gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: accent.band },
  changeText: { ...type.body, fontWeight: "600", color: text.primary, flex: 1 },
  delta: { paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: border.soft },
  deltaLabel: { ...type.caption, color: text.secondary },
  deltaValues: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: 2 },
  from: { ...type.body, color: text.tertiary, textDecorationLine: "line-through", fontVariant: ["tabular-nums"] },
  to: { ...type.sectionTitle, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  same: { marginTop: space.lg },
  fitRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  fitName: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },
  links: { flexDirection: "row", gap: space.lg, marginTop: space.section },
  link: { paddingVertical: space.sm },
  linkText: { ...type.supporting, fontWeight: "700", color: text.secondary, textDecorationLine: "underline" },
});

