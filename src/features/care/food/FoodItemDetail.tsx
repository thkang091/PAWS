import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useDerivedValue, useReducedMotion, withTiming } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowsClockwiseIcon, BowlFoodIcon, CookieIcon, ToothIcon, TrashIcon } from "phosphor-react-native";

import { DetailEmpty, DetailShell, goBack } from "@/features/care/components/DetailShell";
import { enter } from "@/features/care/food/enter";
import { Checks, FitChip, Stepper, partsStyles } from "@/features/care/food/FoodPlanParts";
import { ROLE_LABEL, UNIT_LABEL, roleOf, type TreatRole } from "@/features/care/food/options";
import { useCommitPlan, useLivePlan } from "@/features/care/food/usePlan";
import type { PlanResult } from "@/features/care/food/planResult";
import { contains, formatAmount, unitsFor, type Facts, type Unit } from "@/features/care/food/foodPlanMath";
import { readLabel, withLabel } from "@/services/labelReader";
import type { PlanItem } from "@/features/care/state/foodPlan";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, scene, space, text, type } from "@/constants/design";

/** Main Food, Treat and Dental Chew details: what it is, whether it fits and why, and how much of it. */
export const FoodItemDetail = () => {
  const params = useLocalSearchParams<{ id?: string; role?: string }>();
  const live = useLivePlan();
  const commit = useCommitPlan();
  const { plan, result, basis } = live;
  const name = basis.name;
  const isMain = params.id === "main";

  // After a switch the id changes; fall back to the treat in the same role so the page follows the new product.
  const treat = !isMain && plan
    ? (plan.treats.find((t) => t.product.id === params.id) ?? plan.treats.find((t) => roleOf(t) === (params.role as TreatRole)) ?? null)
    : null;
  const item = isMain ? (plan?.food ?? null) : treat;

  // Products saved before PAWS read labels with Gemini get their label read once, here, and the fit is checked again.
  const reduceMotion = useReducedMotion();
  const [reading, setReading] = useState(false);
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!plan || !item || item.facts.labelRead || asked.current === item.product.id) return;
    asked.current = item.product.id;
    setReading(true);
    void readLabel({ name: item.product.name, brand: item.product.brand, kind: isMain ? "food" : "treat" })
      .then((label) => {
        if (label === null) return;
        const facts = label === "missing" ? { ...item.facts, labelRead: true } : withLabel(item.facts, label, item.product.name);
        const updated = { ...item, facts };
        commit({
          food: isMain ? updated : plan.food,
          unit: plan.unit,
          treats: isMain ? plan.treats : plan.treats.map((t) => (t.product.id === item.product.id ? updated : t)),
          basis,
          prefs: live.prefs,
        });
      })
      .finally(() => setReading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.product.id, item?.facts.labelRead]);

  if (!plan || !result || !item) {
    return (
      <DetailShell title="Food Plan" glyph={<BowlFoodIcon size={iconSize.standard} color={accent.band} weight="fill" />} back="/(tabs)/care">
        <DetailEmpty glyph={<BowlFoodIcon size={24} color={text.primary} />} title="Not in the plan" body="This product is no longer part of the Food Plan." />
      </DetailShell>
    );
  }

  const role = isMain ? null : roleOf(item);
  const title = isMain ? "Main Food" : ROLE_LABEL[role!];
  const Glyph = isMain ? BowlFoodIcon : role === "dental" ? ToothIcon : CookieIcon;
  const verdict = isMain ? result.food : (result.treats.find((t) => t.item.product.id === item.product.id)?.verdict ?? null);
  const mark = verdict?.mark ?? "good";
  const change = isMain ? "Change food" : role === "dental" ? "Change dental chew" : "Change treat";

  const save = (next: { food?: PlanItem; unit?: Unit; treats?: readonly PlanItem[] }) =>
    commit({ food: next.food ?? plan.food, unit: next.unit ?? plan.unit, treats: next.treats ?? plan.treats, basis, prefs: live.prefs });

  const patchTreat = (patch: Partial<Facts>) =>
    save({ treats: plan.treats.map((t) => (t.product.id === item.product.id ? { ...t, facts: { ...t.facts, ...patch } } : t)) });

  return (
    <DetailShell
      title={title}
      glyph={<Glyph size={iconSize.standard} color={accent.band} weight="fill" />}
      back="/(tabs)/care"
      action={{
        label: change,
        icon: <ArrowsClockwiseIcon size={iconSize.button} color={text.primary} weight="bold" />,
        onPress: () => {
          void Haptics.selectionAsync();
          router.push(`/care/food-change?slot=${isMain ? "main" : encodeURIComponent(item.product.id)}&role=${role ?? "main"}` as never);
        },
      }}
    >
      <Animated.View entering={enter({ y: -12 })} style={styles.hero}>
        {item.product.imageUrl ? (
          <Image source={{ uri: item.product.imageUrl }} style={styles.heroImage} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.heroEmpty}>
            <Glyph size={44} color={text.primary} weight="fill" />
          </View>
        )}
        <View style={styles.plinth} />
      </Animated.View>
      <Text style={styles.name}>{item.product.name}</Text>
      {item.product.store ? <Text style={styles.store}>{item.product.store}</Text> : null}

      <View style={styles.verdict}>
        <FitChip mark={mark} />
        <Text style={styles.verdictText}>
          {mark === "good" ? `Good fit for ${name}` : mark === "note" ? `Works for ${name}, with a note` : `Not a good fit for ${name}`}
        </Text>
      </View>
      {reading ? (
        <Animated.View entering={FadeIn.duration(motion.duration.select)} style={styles.reading}>
          <ActivityIndicator size="small" color={text.secondary} />
          <Text style={styles.readingText}>Reading the label</Text>
        </Animated.View>
      ) : null}
      {verdict?.checks.length ? (
        <Animated.View key={verdict.checks.map((c) => c.text).join("|")} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}>
          <Text style={partsStyles.section}>Why</Text>
          <Checks checks={verdict.checks} />
        </Animated.View>
      ) : null}

      {item.facts.ingredientList?.length ? (
        <Ingredients list={item.facts.ingredientList} flagged={basis.allergies} avoid={live.prefs.avoid} source={item.facts.labelSource ?? null} />
      ) : null}

      {isMain ? (
        <>
          <Text style={partsStyles.section}>Calories</Text>
          <View style={styles.facts}>
            {item.facts.kcalPerCup ? <Fact label="Per cup" value={`${item.facts.kcalPerCup} kcal`} /> : null}
            {item.facts.kcalPerCan ? <Fact label="Per can" value={`${item.facts.kcalPerCan} kcal`} /> : null}
            {item.facts.kcalPerKg ? <Fact label="Per kg" value={`${item.facts.kcalPerKg.toLocaleString()} kcal`} /> : null}
          </View>

          {result.energy && result.amount != null ? (
            <View style={styles.serving}>
              <Text style={styles.servingLabel}>{`Recommended for ${name}`}</Text>
              <Animated.Text key={`${result.amount}-${plan.unit}`} entering={FadeIn.duration(motion.duration.select)} style={styles.servingValue}>
                {formatAmount(result.amount, plan.unit)}
                <Text style={styles.servingUnit}> a day</Text>
              </Animated.Text>
              {result.perMeal != null ? <Text style={styles.servingSub}>{`${formatAmount(result.perMeal, plan.unit)} at each of ${live.mealsPerDay} meals`}</Text> : null}
              {unitsFor(item.facts).length > 1 ? (
                <View style={styles.units}>
                  {unitsFor(item.facts).map((u) => (
                    <Chip key={u} label={UNIT_LABEL[u]} selected={plan.unit === u} onPress={() => save({ unit: u })} />
                  ))}
                </View>
              ) : null}
              <View style={styles.split}>
                <Line label="Daily energy target" value={`${result.energy.kcal} kcal`} />
                <Line label="Main food (90%)" value={`${result.energy.mainKcal} kcal`} />
                <Line label="Treats (10%)" value={`${result.energy.treatKcal} kcal`} />
              </View>
            </View>
          ) : null}
        </>
      ) : (
        <TreatAllowance
          item={item}
          rows={result.treats}
          allowance={result.energy?.treatKcal ?? null}
          onKcal={(kcal) => patchTreat({ kcalPerPiece: kcal || null })}
          onRemove={() => {
            void Haptics.selectionAsync();
            save({ treats: plan.treats.filter((t) => t.product.id !== item.product.id) });
            goBack("/(tabs)/care");
          }}
        />
      )}
    </DetailShell>
  );
};

/** Where this treat sits in the day's treat allowance, with the other treats beside it. */
const TreatAllowance = ({
  item,
  rows,
  allowance,
  onKcal,
  onRemove,
}: {
  item: PlanItem;
  rows: PlanResult["treats"];
  allowance: number | null;
  onKcal: (kcal: number) => void;
  onRemove: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const mine = rows.find((r) => r.item.product.id === item.product.id)?.share ?? null;
  const kcal = item.facts.kcalPerPiece;
  const used = rows.reduce((sum, r) => sum + (r.share ? r.share.count * r.share.kcal : 0), 0);
  const scale = Math.max(allowance ?? 1, used, 1);
  return (
    <>
      <Text style={partsStyles.section}>Calories</Text>
      <View style={styles.kcalRow}>
        <View style={styles.flex}>
          <Text style={styles.kcalValue}>{kcal ? `${kcal} kcal` : "Not known"}</Text>
          <Text style={styles.kcalLabel}>{/dental/i.test(ROLE_LABEL[roleOf(item)]) ? "per chew" : "per treat"}</Text>
        </View>
        <Stepper value={kcal ?? 0} step={(kcal ?? 0) >= 20 ? 5 : 1} label="calories per treat" onChange={onKcal} />
      </View>

      {allowance != null ? (
        <View style={styles.serving}>
          <Text style={styles.servingLabel}>Daily treat allowance</Text>
          <Text style={styles.servingValue}>
            {`${allowance}`}
            <Text style={styles.servingUnit}> kcal a day</Text>
          </Text>
          <View style={styles.track}>
            {rows.map((r, i) =>
              r.share ? (
                <Segment
                  key={r.item.product.id}
                  start={rows.slice(0, i).reduce((s, x) => s + (x.share ? x.share.count * x.share.kcal : 0), 0) / scale}
                  width={(r.share.count * r.share.kcal) / scale}
                  on={r.item.product.id === item.product.id}
                  reduceMotion={reduceMotion}
                />
              ) : null,
            )}
          </View>
          <Text style={styles.servingSub}>
            {mine && mine.solo === 0
              ? `One is more than the whole day's treat allowance. Give it every other day, or trim the main food on chew days.`
              : mine
              ? rows.length > 1
                ? `${mine.count} a day here, sharing the allowance with ${rows.length - 1} other ${rows.length === 2 ? "treat" : "treats"}. Up to ${mine.solo} if it is the only one.`
                : `Up to ${mine.solo} a day if it is the only treat.`
              : "Add the calories per treat to see how many fit."}
          </Text>
        </View>
      ) : null}

      <PressScale accessibilityRole="button" accessibilityLabel="Remove from the plan" scaleTo={0.96} style={styles.remove} onPress={onRemove}>
        <TrashIcon size={14} color={text.secondary} weight="bold" />
        <Text style={styles.removeText}>Remove from the plan</Text>
      </PressScale>
    </>
  );
};

const Segment = ({ start, width, on, reduceMotion }: { start: number; width: number; on: boolean; reduceMotion: boolean }) => {
  const grow = useDerivedValue(() => (reduceMotion ? 1 : withTiming(1, { duration: 520, easing: motion.easing.out })), []);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: grow.value }] }));
  return <Animated.View style={[styles.segment, { left: `${start * 100}%`, width: `${width * 100}%` }, on ? styles.segmentOn : null, style]} />;
};

/** The label's ingredients in order. Anything on the allergy or avoid list is marked, so the reason is visible. */
const Ingredients = ({ list, flagged, avoid, source }: { list: readonly string[]; flagged: readonly string[]; avoid: readonly string[]; source: string | null }) => {
  const [all, setAll] = useState(false);
  const hitOf = (ingredient: string) =>
    flagged.some((a) => contains({ ingredients: ingredient }, a)) ? "allergy" : avoid.some((a) => contains({ ingredients: ingredient }, a)) ? "avoid" : null;
  const firstHit = list.findIndex((i) => hitOf(i));
  const shown = all ? list : list.slice(0, Math.max(8, firstHit + 1));
  return (
    <>
      <Text style={partsStyles.section}>Ingredients</Text>
      <View style={styles.ingredients}>
        {shown.map((ingredient, i) => {
          const hit = hitOf(ingredient);
          return (
            <View
              key={`${ingredient}-${i}`}
              style={[styles.ingredient, hit === "allergy" && styles.ingredientAllergy, hit === "avoid" && styles.ingredientAvoid]}
              accessibilityLabel={hit ? `${ingredient}, ${hit === "allergy" ? "allergy" : "on your avoid list"}` : ingredient}
            >
              <Text style={[styles.ingredientText, hit === "allergy" && styles.ingredientTextOn]}>{ingredient}</Text>
            </View>
          );
        })}
        {list.length > shown.length || all ? (
          <PressScale accessibilityRole="button" accessibilityLabel={all ? "Show fewer ingredients" : `Show all ${list.length} ingredients`} scaleTo={0.95} style={styles.more} onPress={() => setAll((v) => !v)}>
            <Text style={styles.moreText}>{all ? "Fewer" : `All ${list.length}`}</Text>
          </PressScale>
        ) : null}
      </View>
      {source ? <Text style={styles.source}>{`From the label on ${source}`}</Text> : null}
    </>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.fact}>
    <Text style={styles.factValue}>{value}</Text>
    <Text style={styles.factLabel}>{label}</Text>
  </View>
);

const Line = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.line}>
    <Text style={styles.lineLabel}>{label}</Text>
    <Text style={styles.lineValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { marginTop: space.lg, paddingTop: space.xl, paddingHorizontal: space.xl, borderRadius: radius.card + 10, borderWidth: 1, borderColor: border.soft, alignItems: "center", overflow: "hidden" },
  heroImage: { width: "70%", height: 200 },
  heroEmpty: { width: 140, height: 180, borderRadius: 18, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },
  plinth: { alignSelf: "stretch", height: 28, marginTop: space.md, marginHorizontal: -space.xl, backgroundColor: scene.blobSoft, borderTopWidth: 3, borderTopColor: scene.blob },
  name: { ...type.sectionTitle, fontWeight: "800", color: text.primary, marginTop: space.lg },
  store: { ...type.caption, color: text.tertiary, marginTop: 2 },
  verdict: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  verdictText: { ...type.supporting, fontWeight: "600", color: text.primary },

  facts: { flexDirection: "row", gap: space.sm },
  fact: { flex: 1, padding: space.md, borderRadius: radius.card, backgroundColor: bg.subtle },
  factValue: { ...type.cardTitle, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  factLabel: { ...type.caption, color: text.secondary, marginTop: 2 },

  serving: { marginTop: space.lg, padding: space.lg, borderRadius: radius.card + 4, backgroundColor: accent.soft },
  servingLabel: { ...type.supporting, fontWeight: "600", color: text.secondary },
  servingValue: { fontSize: 34, lineHeight: 40, fontWeight: "800", letterSpacing: -0.8, color: text.primary, marginTop: 2, fontVariant: ["tabular-nums"] },
  servingUnit: { ...type.body, fontWeight: "500", color: text.secondary, letterSpacing: 0 },
  servingSub: { ...type.supporting, color: text.secondary, marginTop: space.sm },
  units: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  split: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: border.soft, gap: 6 },
  line: { flexDirection: "row", justifyContent: "space-between" },
  lineLabel: { ...type.supporting, color: text.secondary },
  lineValue: { ...type.supporting, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },

  kcalRow: { flexDirection: "row", alignItems: "center", padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  kcalValue: { ...type.sectionTitle, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  kcalLabel: { ...type.caption, color: text.secondary },
  track: { height: 12, borderRadius: 6, backgroundColor: bg.canvas, marginTop: space.md, overflow: "hidden" },
  segment: { position: "absolute", top: 0, bottom: 0, backgroundColor: border.strong, transformOrigin: "left", borderRadius: 6 },
  segmentOn: { backgroundColor: accent.deep },
  reading: { flexDirection: "row", alignItems: "center", gap: space.sm, alignSelf: "flex-start", marginTop: space.md, height: 30, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  readingText: { ...type.caption, fontWeight: "600", color: text.secondary },
  ingredients: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ingredient: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: bg.subtle },
  ingredientAllergy: { backgroundColor: text.primary },
  ingredientAvoid: { backgroundColor: accent.deep },
  ingredientText: { ...type.caption, fontSize: 13, color: text.primary },
  ingredientTextOn: { color: text.inverse, fontWeight: "600" },
  more: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft },
  moreText: { ...type.caption, fontSize: 13, fontWeight: "600", color: text.secondary },
  source: { ...type.caption, color: text.tertiary, marginTop: space.sm },
  remove: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: space.section, paddingVertical: space.sm },
  removeText: { ...type.supporting, fontWeight: "600", color: text.secondary },
});
