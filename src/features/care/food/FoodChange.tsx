import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { Redirect, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon, ArrowsLeftRightIcon, BowlFoodIcon, PlusIcon } from "phosphor-react-native";

import { DetailShell, goBack } from "@/features/care/components/DetailShell";
import { Checks, FitChip, NumberField, ProductThumb, Stepper, partsStyles } from "@/features/care/food/FoodPlanParts";
import { Stand } from "@/features/care/food/FoodPlanHome";
import { ProductPicker } from "@/features/care/food/ProductPicker";
import { ROLE_LABEL, roleOf, type TreatRole } from "@/features/care/food/options";
import { planResult, type PlanResult } from "@/features/care/food/planResult";
import { useCommitPlan, useLivePlan } from "@/features/care/food/usePlan";
import { alternativesQuery, defaultUnit, formatAmount, unitsFor, type Facts, type Mark } from "@/features/care/food/foodPlanMath";
import type { PlanItem } from "@/features/care/state/foodPlan";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { findAlternatives, identifyProduct, type Lookup, type Product } from "@/services/productLookup";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const ROLES: readonly TreatRole[] = ["training", "dental", "topper", "snack"];

const QUERY: Record<TreatRole, string> = {
  training: "low calorie training treats",
  dental: "dental chews",
  topper: "food topper",
  snack: "healthy dog treats",
};

/** Change the main food or a treat: find one, see how it compares, then switch. */
export const FoodChange = () => {
  const params = useLocalSearchParams<{ slot?: string; role?: string }>();
  const reduceMotion = useReducedMotion();
  const live = useLivePlan();
  const commit = useCommitPlan();
  const { plan, result, basis } = live;
  const name = basis.name;

  const isMain = params.slot === "main";
  const adding = params.slot === "new";
  const current = isMain ? (plan?.food ?? null) : adding ? null : (plan?.treats.find((t) => t.product.id === params.slot) ?? null);
  const [role, setRole] = useState<TreatRole>(
    current && !isMain ? roleOf(current) : ROLES.includes(params.role as TreatRole) ? (params.role as TreatRole) : "training",
  );
  const kind = isMain ? "food" : "treat";

  const [candidate, setCandidate] = useState<PlanItem | null>(null);
  const [reading, setReading] = useState(false);

  // Products that suit the dog's profile and the owner's preferences.
  const [recommended, setRecommended] = useState<Lookup<Product[]> | "loading">("loading");
  const query = isMain ? alternativesQuery(basis, live.prefs, "food") : `${alternativesQuery(basis, live.prefs, "treat").replace(/low calorie dog treats$/, "")} ${QUERY[role]}`.trim();
  useEffect(() => {
    let alive = true;
    setRecommended("loading");
    void findAlternatives(query, kind, current?.product.name ?? "").then((found) => alive && setRecommended(found));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pick = (product: Product) => {
    void Haptics.selectionAsync();
    setCandidate({ product, facts: { ...(product.seed as Facts) } as Facts, role: isMain ? undefined : role });
    setReading(true);
    void identifyProduct(product)
      .catch(() => null)
      .then((facts) => {
        setReading(false);
        setCandidate((c) => (c && c.product.id === product.id ? { ...c, facts: facts ?? c.facts } : c));
      });
  };

  const nextPlan = useMemo(() => {
    if (!plan || !candidate) return null;
    const unit = isMain ? (unitsFor(candidate.facts).includes(plan.unit) ? plan.unit : (defaultUnit(candidate.facts) ?? plan.unit)) : plan.unit;
    const food = isMain ? candidate : plan.food;
    const treats = isMain ? plan.treats : adding ? [...plan.treats, candidate] : plan.treats.map((t) => (t.product.id === current?.product.id ? candidate : t));
    return { food, unit, treats };
  }, [plan, candidate, isMain, adding, current?.product.id]);
  const nextResult = useMemo(
    () => (nextPlan ? planResult({ basis, prefs: live.prefs, ...nextPlan, mealsPerDay: live.mealsPerDay }) : null),
    [nextPlan, basis, live.prefs, live.mealsPerDay],
  );

  // Nothing to change yet: changing starts with setting up the plan.
  if (!plan || !result) return <Redirect href={"/care/food-plan" as never} />;

  const title = isMain ? "Change food" : `${adding ? "Add" : "Change"} ${role === "snack" ? "treat" : ROLE_LABEL[role].toLowerCase()}`;
  const hasKcal = candidate ? (isMain ? Boolean(candidate.facts.kcalPerCup || candidate.facts.kcalPerKg || candidate.facts.kcalPerCan) : Boolean(candidate.facts.kcalPerPiece)) : false;

  const patch = (p: Partial<Facts>) => setCandidate((c) => (c ? { ...c, facts: { ...c.facts, ...p } } : c));

  const switchTo = () => {
    if (!nextPlan) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    commit({ ...nextPlan, basis, prefs: live.prefs });
    goBack("/(tabs)/care");
  };

  return (
    <DetailShell
      title={title}
      glyph={<BowlFoodIcon size={iconSize.standard} color={accent.band} weight="fill" />}
      back="/(tabs)/care"
      action={
        candidate
          ? {
              label: reading ? "Reading the label" : !hasKcal ? "Add calories to compare" : adding ? "Add to the plan" : isMain ? "Switch to this food" : "Switch to this treat",
              icon: adding ? <PlusIcon size={iconSize.button} color={text.primary} weight="bold" /> : <ArrowsLeftRightIcon size={iconSize.button} color={text.primary} weight="bold" />,
              disabled: reading || !hasKcal,
              onPress: switchTo,
            }
          : undefined
      }
    >
      {candidate ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}>
          <Text style={styles.heading}>{adding ? `Adding to ${name}'s plan` : "Current vs new"}</Text>

          <View style={styles.pair}>
            {current ? (
              <>
                <View style={styles.side}>
                  <Stand order={0} reduceMotion={reduceMotion} size="side" role="Current" item={current} mark={isMain ? (result.food?.mark ?? null) : markOf(result, current)} />
                </View>
                <View style={styles.vs}>
                  <ArrowRightIcon size={16} color={text.secondary} weight="bold" />
                </View>
              </>
            ) : null}
            <View style={styles.side}>
              <Stand
                order={1}
                reduceMotion={reduceMotion}
                size="side"
                role="New"
                item={candidate}
                mark={reading || !nextResult ? null : isMain ? (nextResult.food?.mark ?? null) : markOf(nextResult, candidate)}
              />
            </View>
          </View>

          {reading ? (
            <View style={styles.reading}>
              <ActivityIndicator color={text.secondary} />
              <Text style={styles.readingText}>Reading the label</Text>
            </View>
          ) : (
            <>
              {!hasKcal ? (
                <View style={styles.kcal}>
                  <Text style={styles.kcalHint}>PAWS could not find the calories. Copy them from the pack.</Text>
                  {isMain ? (
                    <NumberField label="Calories per cup" value={candidate.facts.kcalPerCup} suffix="kcal" onChange={(v) => patch({ kcalPerCup: v })} />
                  ) : (
                    <View style={styles.kcalStep}>
                      <Text style={styles.kcalLabel}>kcal each</Text>
                      <Stepper value={candidate.facts.kcalPerPiece ?? 0} label="calories each" onChange={(v) => patch({ kcalPerPiece: v || null })} />
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.table}>
                <Row label="Fit" from={current ? <FitChip mark={isMain ? (result.food?.mark ?? "good") : (markOf(result, current) ?? "good")} /> : null} to={nextResult ? <FitChip mark={(isMain ? nextResult.food?.mark : markOf(nextResult, candidate)) ?? "good"} /> : null} />
                <Row
                  label="Calories"
                  from={current ? <Value text={kcalText(current, isMain)} /> : null}
                  to={<Value text={kcalText(candidate, isMain)} strong />}
                />
                <Row
                  label={isMain ? "Serving a day" : "A day"}
                  from={current ? <Value text={servingText(result, current, isMain, plan.unit)} /> : null}
                  to={nextResult && nextPlan ? <Value text={servingText(nextResult, candidate, isMain, nextPlan.unit)} strong /> : null}
                />
                {isMain ? (
                  <Row
                    label="Protein, fat"
                    from={current ? <Value text={macro(current.facts)} /> : null}
                    to={<Value text={macro(candidate.facts)} strong />}
                  />
                ) : null}
              </View>

              {(isMain ? nextResult?.food : nextResult?.treats.find((t) => t.item.product.id === candidate.product.id)?.verdict)?.checks.length ? (
                <>
                  <Text style={partsStyles.section}>{`For ${name}`}</Text>
                  <Checks checks={(isMain ? nextResult!.food! : nextResult!.treats.find((t) => t.item.product.id === candidate.product.id)!.verdict).checks} />
                </>
              ) : null}
              {isMain ? <Text style={partsStyles.caption}>Switch over 7 to 10 days, mixing in a little more of the new food each day.</Text> : null}
            </>
          )}

          <PressScale accessibilityRole="button" accessibilityLabel="Choose another" scaleTo={0.96} style={styles.another} onPress={() => setCandidate(null)}>
            <Text style={styles.anotherText}>Choose another</Text>
          </PressScale>
        </Animated.View>
      ) : (
        <>
          <Text style={styles.heading}>{isMain ? `Find a new food for ${name}` : adding ? `What does ${name} get?` : `Find a new ${ROLE_LABEL[role].toLowerCase()}`}</Text>
          {adding ? (
            <View style={styles.roles}>
              {ROLES.map((r) => (
                <Chip key={r} label={ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
              ))}
            </View>
          ) : null}

          <ProductPicker kind={kind} placeholder={isMain ? "Search for a food" : "Search treats"} onPick={pick} />

          <Text style={partsStyles.section}>{`Recommended for ${name}`}</Text>
          {recommended === "loading" ? (
            <View style={styles.reading}>
              <ActivityIndicator color={text.secondary} />
              <Text style={styles.readingText}>Finding options that suit</Text>
            </View>
          ) : recommended.state === "ready" ? (
            <View style={styles.recs}>
              {recommended.items.map((product, index) => (
                <Animated.View key={product.id} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(index * motion.stagger)}>
                  <PressScale accessibilityRole="button" accessibilityLabel={`Compare ${product.name}`} scaleTo={0.98} style={styles.rec} onPress={() => pick(product)}>
                    <ProductThumb product={product} size={52} />
                    <View style={styles.flex}>
                      <Text style={styles.recName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Text style={styles.recMeta}>{[product.store, product.price].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <View style={styles.compare}>
                      <Text style={styles.compareText}>Compare</Text>
                    </View>
                  </PressScale>
                </Animated.View>
              ))}
            </View>
          ) : (
            <Text style={styles.readingText}>{recommended.state === "offline" ? "The product search is not answering right now." : "Nothing matched. Try searching above."}</Text>
          )}
        </>
      )}
    </DetailShell>
  );
};

const markOf = (r: PlanResult, item: PlanItem): Mark | null => r.treats.find((t) => t.item.product.id === item.product.id)?.verdict.mark ?? null;

const kcalText = (item: PlanItem, isMain: boolean) => {
  const f = item.facts;
  if (!isMain) return f.kcalPerPiece ? `${f.kcalPerPiece} kcal each` : "Unknown";
  return f.kcalPerCup ? `${f.kcalPerCup} kcal/cup` : f.kcalPerCan ? `${f.kcalPerCan} kcal/can` : f.kcalPerKg ? `${f.kcalPerKg.toLocaleString()} kcal/kg` : "Unknown";
};

const servingText = (r: PlanResult, item: PlanItem, isMain: boolean, unit: Parameters<typeof formatAmount>[1]) => {
  if (isMain) return r.amount != null ? formatAmount(r.amount, unit) : "Unknown";
  const share = r.treats.find((t) => t.item.product.id === item.product.id)?.share;
  if (!share) return "Unknown";
  return share.count > 0 ? `${share.count} (${share.count * share.kcal} kcal)` : "Over the allowance";
};

const macro = (f: Facts) => (f.protein != null && f.fat != null ? `${f.protein}% · ${f.fat}%` : "Not listed");

const Row = ({ label, from, to }: { label: string; from: React.ReactNode; to: React.ReactNode }) => (
  <View style={styles.tableRow}>
    <Text style={styles.tableLabel}>{label}</Text>
    <View style={styles.tableCells}>
      {from !== null ? <View style={styles.cell}>{from}</View> : null}
      <View style={styles.cell}>{to ?? <Value text="…" />}</View>
    </View>
  </View>
);

const Value = ({ text: t, strong = false }: { text: string; strong?: boolean }) => <Text style={[styles.value, strong && styles.valueStrong]}>{t}</Text>;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  heading: { ...type.pageTitle, fontWeight: "800", color: text.primary, marginTop: space.lg },
  roles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },

  reading: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md },
  readingText: { ...type.supporting, color: text.secondary },
  recs: { gap: space.sm },
  rec: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  recName: { ...type.supporting, fontWeight: "700", color: text.primary },
  recMeta: { ...type.caption, color: text.tertiary, marginTop: 2 },
  compare: { paddingHorizontal: space.md, height: 32, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  compareText: { ...type.caption, fontWeight: "700", color: text.primary },

  pair: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, marginTop: space.lg, padding: space.md, borderRadius: radius.card + 10, borderWidth: 1, borderColor: border.soft },
  side: { flex: 1 },
  vs: { width: 28, height: 28, borderRadius: 14, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center", marginBottom: 70 },

  kcal: { marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft, gap: space.md },
  kcalHint: { ...type.supporting, color: text.primary },
  kcalStep: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kcalLabel: { ...type.supporting, color: text.secondary },

  table: { marginTop: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  tableRow: { paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: border.soft },
  tableLabel: { ...type.caption, fontWeight: "600", color: text.tertiary, marginBottom: 6 },
  tableCells: { flexDirection: "row", gap: space.sm },
  cell: { flex: 1, minHeight: 24, justifyContent: "center" },
  value: { ...type.supporting, color: text.secondary, fontVariant: ["tabular-nums"] },
  valueStrong: { fontWeight: "700", color: text.primary },

  another: { alignSelf: "center", marginTop: space.xl, paddingVertical: space.sm, paddingHorizontal: space.lg },
  anotherText: { ...type.supporting, fontWeight: "700", color: text.secondary, textDecorationLine: "underline" },
});

