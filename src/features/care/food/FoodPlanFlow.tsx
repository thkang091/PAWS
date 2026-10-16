import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon, CaretRightIcon, XIcon } from "phosphor-react-native";

import { SetupShell, setupText } from "@/features/care/components/SetupShell";
import { Chip } from "@/features/onboarding/components/SelectChipRow";
import { Card, Checks, FactLines, FitChip, MarkIcon, NumberField, OptionList, ProductThumb, Stepper, partsStyles } from "@/features/care/food/FoodPlanParts";
import { ProductPicker } from "@/features/care/food/ProductPicker";
import { ACTIVITY, BODY, GOAL, STAGE, UNIT_LABEL, labelOf } from "@/features/care/food/options";
import { useCommitPlan } from "@/features/care/food/usePlan";
import { STALE_WEIGHT_DAYS, useDogBasis } from "@/features/care/food/useDogBasis";
import { mealTimesIn, planResult } from "@/features/care/food/planResult";
import { useCareOnboarding } from "@/features/care/state/careOnboarding";
import { takePendingPicks } from "@/features/care/state/pendingPicks";
import { alternativesQuery, defaultUnit, formatAmount, goalFrom, unitsFor, type Facts, type Unit } from "@/features/care/food/foodPlanMath";
import { saveFeedingProfile, useFoodPlan, type FeedingProfile, type PlanItem } from "@/features/care/state/foodPlan";
import { findAlternatives, identifyProduct, keyOf, type Lookup, type Product } from "@/services/productLookup";
import { useCareProfile } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useSavedTreats } from "@/hooks/useFood";
import { useSaveWeightLog } from "@/hooks/useWeightLogs";
import { showWeight } from "@/lib/units";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

type Screen = "about" | "food" | "treats" | "summary";
type AboutKey = "stage" | "weight" | "body" | "activity" | "neutered" | "goal";

const ageText = (months: number | null) =>
  months == null ? null : months < 12 ? `${months} months` : `${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? "year" : "years"}`;
const daysText = (days: number) => (days < 1 ? "today" : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`);

/**
 * Food Plan setup on the Care setup frame. No intro screen: the Feed card already says what this is. PAWS asks only
 * what it cannot read from the profile (usually nothing, or body shape), then the main food with its verdict and
 * amount on the same screen, then treats, then the plan. `edit` reopens one part: "profile", "food" or "treats".
 */
export const FoodPlanFlow = ({ edit }: { edit?: string }) => {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const store = useFoodPlan();
  const careProfile = useCareProfile(dogId);
  const { choice } = useCareOnboarding();
  const savedTreats = useSavedTreats(dogId);
  const saveWeight = useSaveWeightLog(dogId);

  const [profile, setProfile] = useState<FeedingProfile>(store.profile);
  const prefs = store.prefs;
  /** A new weight, in the owner's unit, when they typed one. */
  const [weightEntry, setWeightEntry] = useState<number | null>(null);
  const [weightConfirmed, setWeightConfirmed] = useState(false);

  const dogBasis = useDogBasis(profile);
  const { name } = dogBasis.basis;
  const { weightUnit } = dogBasis;
  const weightDraft = weightEntry == null ? null : weightUnit === "lb" ? Math.round(weightEntry * 0.4536 * 10) / 10 : weightEntry;
  const basis = useMemo(
    () => ({
      ...dogBasis.basis,
      weightKg: weightDraft ?? dogBasis.basis.weightKg,
      goal: profile.goal ?? (profile.bodyCondition ? goalFrom(profile.bodyCondition) : null),
    }),
    [dogBasis.basis, weightDraft, profile.goal, profile.bodyCondition],
  );

  const [food, setFood] = useState<PlanItem | null>(store.plan?.food ?? null);
  const [reading, setReading] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit | null>(store.plan?.unit ?? null);
  const [treats, setTreats] = useState<PlanItem[]>([...(store.plan?.treats ?? [])]);
  /** Treats whose calories the owner is typing in, so the stepper stays while they count up. */
  const [manual, setManual] = useState<readonly string[]>([]);

  const mealsPerDay = mealTimesIn(careProfile.data?.mealTimes, choice?.mealTimes).length;
  const result = useMemo(() => planResult({ basis, prefs, food, unit, treats, mealsPerDay }), [basis, prefs, food, unit, treats, mealsPerDay]);

  // What portions still depend on. Anything the profile already knows is never asked again.
  const weightStale = weightDraft == null && !weightConfirmed && dogBasis.weighedDaysAgo != null && dogBasis.weighedDaysAgo > STALE_WEIGHT_DAYS;
  const needs: Record<AboutKey, boolean> = {
    stage: dogBasis.missing.stage,
    weight: basis.weightKg == null,
    body: profile.bodyCondition == null,
    activity: basis.activity == null,
    neutered: basis.stage !== "puppy" && profile.neutered == null,
    goal: false,
  };

  // Which questions to show is decided once the dog's data has loaded, so an answered one does not vanish mid-step.
  const [asked, setAsked] = useState<readonly AboutKey[] | null>(null);
  const editingAll = (): AboutKey[] => [
    ...(basis.ageMonths == null ? (["stage"] as const) : []),
    "weight",
    "body",
    "activity",
    ...(basis.stage !== "puppy" ? (["neutered", "goal"] as const) : []),
  ];
  const [entry, setEntry] = useState<Screen>("food");
  useEffect(() => {
    if (asked || dogBasis.loading) return;
    const keys = edit === "profile" ? editingAll() : (Object.keys(needs) as AboutKey[]).filter((k) => needs[k] || (k === "weight" && weightStale));
    setAsked(keys);
    setEntry(edit === "food" ? "food" : edit === "treats" ? "treats" : keys.length ? "about" : "food");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked, dogBasis.loading, edit]);

  const screens: Screen[] = [...(asked?.length ? (["about"] as const) : []), "food", "treats", "summary"];
  const [current, setCurrent] = useState<Screen | null>(null);
  const screen: Screen = current ?? entry;
  const step = screens.indexOf(screen);
  const [direction, setDirection] = useState(1);

  const go = (next: Screen) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDirection(screens.indexOf(next) > step ? 1 : -1);
    setCurrent(next);
  };

  const identify = (product: Product, onDone: (item: PlanItem) => void) => {
    setReading(product.id);
    void identifyProduct(product)
      .catch(() => null)
      .then((facts) => {
        setReading((now) => (now === product.id ? null : now));
        onDone({ product, facts: facts ?? ({ ...product.seed } as Facts) });
      });
  };

  const chooseFood = (product: Product) => {
    setFood({ product, facts: { ...(product.seed as Facts) } as Facts });
    identify(product, (item) => {
      setFood(item);
      setUnit((now) => (now && unitsFor(item.facts).includes(now) ? now : defaultUnit(item.facts)));
    });
  };

  const addTreat = (product: Product) => {
    if (treats.some((t) => keyOf(t.product.name) === keyOf(product.name))) return;
    setTreats((now) => [...now, { product, facts: { ...(product.seed as Facts) } as Facts }]);
    identify(product, (found) => setTreats((now) => now.map((t) => (t.product.id === product.id ? found : t))));
  };

  const patchFacts = (id: string, patch: Partial<Facts>) => {
    if (food?.product.id === id) {
      const next = { ...food, facts: { ...food.facts, ...patch } };
      setFood(next);
      if (!unit) setUnit(defaultUnit(next.facts));
      return;
    }
    setTreats((now) => now.map((t) => (t.product.id === id ? { ...t, facts: { ...t.facts, ...patch } } : t)));
  };

  // Picks chosen on the browse screen arrive already in place; each still gets its full fit check here.
  useEffect(() => {
    const picks = takePendingPicks();
    if (!picks) return;
    if (picks.food) chooseFood(picks.food);
    picks.treats.forEach(({ product, role }) => {
      setTreats((now) => (now.some((t) => keyOf(t.product.name) === keyOf(product.name)) ? now : [...now, { product, facts: { ...(product.seed as Facts) } as Facts, role }]));
      identify(product, (found) => setTreats((now) => now.map((t) => (t.product.id === product.id ? { ...found, role } : t))));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Foods that fit, only when the current one does not.
  const [alternatives, setAlternatives] = useState<Lookup<Product[]> | "loading" | null>(null);
  const altQuery = alternativesQuery(basis, prefs, "food");
  useEffect(() => {
    if (screen !== "food" || result.food?.mark !== "bad" || !food) {
      setAlternatives(null);
      return;
    }
    let live = true;
    setAlternatives("loading");
    void findAlternatives(altQuery, "food", food.product.name).then((found) => live && setAlternatives(found));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, result.food?.mark, food?.product.id, altQuery]);

  const hasKcal = (facts: Facts | undefined) => Boolean(facts && (facts.kcalPerCup || facts.kcalPerKg || facts.kcalPerCan));

  const ready =
    screen === "about"
      ? !Object.values(needs).some(Boolean)
      : screen === "food"
        ? Boolean(food) && !reading && hasKcal(food?.facts) && Boolean(unit)
        : screen === "treats"
          ? !reading
          : true;

  const commit = useCommitPlan();
  const save = () => {
    if (!food || !unit || !result.energy) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveFeedingProfile(profile);
    if (weightEntry != null) {
      saveWeight.mutate({ dogId, weightValue: weightEntry, weightUnit, recordedAt: new Date().toISOString(), note: null });
    }
    commit({ food, unit, treats, basis, prefs });
    router.back();
  };

  if (!asked) return <View style={styles.blank} />;

  const last = screen === "summary";
  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);
  const show = (key: AboutKey) => asked.includes(key);
  const verdict = result.food?.mark;
  const issues = (result.food?.checks ?? []).filter((c) => c.mark !== "good");
  const basisLine = [
    ageText(basis.ageMonths),
    basis.weightKg != null ? showWeight(basis.weightKg, weightUnit) : null,
    labelOf(ACTIVITY, basis.activity)?.toLowerCase(),
    labelOf(BODY, profile.bodyCondition)?.toLowerCase(),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <SetupShell
      step={step}
      total={screens.length}
      direction={direction}
      closing={screen === entry}
      onBack={() => (screen === entry ? router.back() : step === 0 ? go("summary") : go(screens[step - 1]))}
      primary={{
        label: last ? "Save Food Plan" : screen === "treats" && treats.length === 0 ? "No regular treats" : "Next",
        done: last,
        disabled: !ready,
        busy: Boolean(reading) && (screen === "food" || screen === "treats"),
        onPress: () => (last ? save() : go(screens[step + 1])),
      }}
    >
      {screen === "about" ? (
        <>
          <Text style={setupText.title}>{edit === "profile" ? `About ${name}` : `First, a little about ${name}`}</Text>
          <Text style={setupText.note}>Portions are worked out from this.</Text>

          {show("stage") ? (
            <Ask label="Life stage">
              <OptionList options={STAGE} value={profile.stage} onChange={(stage) => setProfile((p) => ({ ...p, stage }))} />
            </Ask>
          ) : null}

          {show("weight") ? (
            <Ask label="Weight">
              <View style={styles.weightRow}>
                <View style={styles.flex}>
                  <NumberField
                    label={
                      weightStale && dogBasis.weighedDaysAgo != null && dogBasis.basis.weightKg != null
                        ? `${showWeight(dogBasis.basis.weightKg, weightUnit)}, weighed ${daysText(dogBasis.weighedDaysAgo)}`
                        : basis.weightKg != null && weightEntry == null
                          ? `Now ${showWeight(basis.weightKg, weightUnit)}`
                          : "A guess is fine"
                    }
                    value={weightEntry}
                    suffix={weightUnit}
                    onChange={setWeightEntry}
                  />
                </View>
                {weightStale ? (
                  <PressScale accessibilityRole="button" accessibilityLabel="Still right" scaleTo={0.95} style={styles.still} onPress={() => setWeightConfirmed(true)}>
                    <Text style={styles.stillText}>Still right</Text>
                  </PressScale>
                ) : null}
              </View>
            </Ask>
          ) : null}

          {show("body") ? (
            <Ask label="Body shape">
              <OptionList options={BODY} value={profile.bodyCondition} onChange={(bodyCondition) => setProfile((p) => ({ ...p, bodyCondition }))} />
            </Ask>
          ) : null}

          {show("activity") ? (
            <Ask label="Activity">
              <OptionList options={ACTIVITY} value={basis.activity} onChange={(activity) => setProfile((p) => ({ ...p, activity }))} />
            </Ask>
          ) : null}

          {show("neutered") && basis.stage !== "puppy" ? (
            <Ask label="Spayed or neutered">
              <View style={styles.chips}>
                <Chip label="Yes" selected={profile.neutered === true} onPress={() => setProfile((p) => ({ ...p, neutered: true }))} />
                <Chip label="No" selected={profile.neutered === false} onPress={() => setProfile((p) => ({ ...p, neutered: false }))} />
              </View>
            </Ask>
          ) : null}

          {show("goal") && basis.stage !== "puppy" ? (
            <Ask label="Weight goal">
              <OptionList options={GOAL} value={basis.goal} suggested={profile.bodyCondition ? goalFrom(profile.bodyCondition) : null} onChange={(goal) => setProfile((p) => ({ ...p, goal }))} />
            </Ask>
          ) : null}

          {edit === "profile" ? (
            <PressScale accessibilityRole="link" accessibilityLabel="Open the medical record" scaleTo={0.98} style={styles.record} onPress={() => router.push("/profile/health" as never)}>
              <View style={styles.flex}>
                <Text style={styles.recordTitle}>Medical record</Text>
                <Text style={styles.recordSub} numberOfLines={1}>
                  {[...basis.conditions, ...basis.allergies.map((a) => `${a} allergy`), ...basis.meds].join(", ") || "Allergies, conditions and medicines"}
                </Text>
              </View>
              <CaretRightIcon size={16} color={text.tertiary} weight="bold" />
            </PressScale>
          ) : null}
        </>
      ) : null}

      {screen === "food" ? (
        <>
          <Text style={setupText.title}>{`What is ${name}'s main food?`}</Text>
          {food ? (
            <Animated.View layout={settle}>
              <Card>
                <View style={styles.productHead}>
                  <ProductThumb product={food.product} size={64} />
                  <View style={styles.flex}>
                    <Text style={styles.productName} numberOfLines={3}>
                      {food.product.name}
                    </Text>
                    {reading !== food.product.id && verdict && hasKcal(food.facts) ? (
                      <View style={styles.fitRow}>
                        <FitChip mark={verdict} />
                      </View>
                    ) : null}
                  </View>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel="Choose a different food"
                    hitSlop={8}
                    scaleTo={0.9}
                    onPress={() => {
                      setFood(null);
                      setUnit(null);
                      setReading(null);
                    }}
                  >
                    <XIcon size={18} color={text.secondary} weight="bold" />
                  </PressScale>
                </View>
                {reading === food.product.id ? <FactLines facts={null} loading /> : null}
              </Card>

              {reading !== food.product.id && !hasKcal(food.facts) ? (
                <Animated.View entering={FadeIn.duration(motion.duration.select)}>
                  <Text style={partsStyles.section}>Calories from the bag</Text>
                  <View style={styles.kcalRow}>
                    <View style={styles.flex}>
                      <NumberField label="Per cup" value={food.facts.kcalPerCup} suffix="kcal" onChange={(v) => patchFacts(food.product.id, { kcalPerCup: v })} />
                    </View>
                    <View style={styles.flex}>
                      <NumberField label="Or per can" value={food.facts.kcalPerCan} suffix="kcal" onChange={(v) => patchFacts(food.product.id, { kcalPerCan: v })} />
                    </View>
                  </View>
                  <Text style={partsStyles.caption}>Printed as &ldquo;Calorie content&rdquo; on the bag.</Text>
                </Animated.View>
              ) : null}

              {reading !== food.product.id && result.energy && result.amount != null && unit ? (
                <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.amountCard}>
                  <Card tone="butter">
                    <Text style={styles.cardLabel}>{`${name} needs`}</Text>
                    <Animated.Text key={`${result.amount}-${unit}`} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.amount}>
                      {formatAmount(result.amount, unit)}
                      <Text style={styles.amountUnit}> a day</Text>
                    </Animated.Text>
                    {result.perMeal != null && mealsPerDay > 1 ? <Text style={styles.perMeal}>{`${formatAmount(result.perMeal, unit)} per meal`}</Text> : null}
                    {unitsFor(food.facts).length > 1 ? (
                      <View style={[styles.chips, styles.unitChips]}>
                        {unitsFor(food.facts).map((u) => (
                          <Chip key={u} label={UNIT_LABEL[u]} selected={unit === u} onPress={() => setUnit(u)} />
                        ))}
                      </View>
                    ) : null}
                  </Card>
                </Animated.View>
              ) : null}

              {reading !== food.product.id && issues.length ? (
                <View style={styles.issues}>
                  <Checks checks={issues} />
                </View>
              ) : null}

              {verdict === "bad" ? (
                <Alternatives
                  name={name}
                  state={alternatives}
                  onUse={(product) => {
                    chooseFood(product);
                  }}
                />
              ) : null}
            </Animated.View>
          ) : (
            <ProductPicker kind="food" placeholder="Brand or product name" onPick={chooseFood} />
          )}
        </>
      ) : null}

      {screen === "treats" ? (
        <>
          <Text style={setupText.title}>{`Any treats ${name} gets most days?`}</Text>

          {treats.length ? (
            <Animated.View layout={settle} style={styles.treatList}>
              {treats.map((t) => {
                const row = result.treats.find((r) => r.item.product.id === t.product.id);
                const busy = reading === t.product.id;
                const kcal = t.facts.kcalPerPiece;
                return (
                  <Animated.View key={t.product.id} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} layout={settle} style={styles.treat}>
                    <ProductThumb product={t.product} size={48} />
                    <View style={styles.flex}>
                      <Text style={styles.treatName} numberOfLines={2}>
                        {t.product.name}
                      </Text>
                      {busy ? (
                        <Text style={styles.treatMeta}>Reading the pack</Text>
                      ) : kcal ? (
                        <Text style={styles.treatMeta}>{row?.share ? `${kcal} kcal each, ${row.share.count} a day` : `${kcal} kcal each`}</Text>
                      ) : null}
                    </View>
                    {busy ? null : kcal && !manual.includes(t.product.id) ? (
                      row ? <FitChip mark={row.verdict.mark} /> : null
                    ) : (
                      <View style={styles.kcalEach}>
                        <Stepper
                          value={kcal ?? 0}
                          step={(kcal ?? 0) >= 20 ? 5 : 1}
                          label={`calories per ${t.product.name}`}
                          onChange={(v) => {
                            setManual((now) => (now.includes(t.product.id) ? now : [...now, t.product.id]));
                            patchFacts(t.product.id, { kcalPerPiece: v || null });
                          }}
                        />
                        <Text style={styles.kcalEachLabel}>kcal each</Text>
                      </View>
                    )}
                    <PressScale
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${t.product.name}`}
                      hitSlop={8}
                      scaleTo={0.85}
                      onPress={() => setTreats((now) => now.filter((x) => x.product.id !== t.product.id))}
                    >
                      <XIcon size={14} color={text.tertiary} weight="bold" />
                    </PressScale>
                  </Animated.View>
                );
              })}
            </Animated.View>
          ) : null}

          {(savedTreats.data ?? []).filter((s) => !treats.some((t) => keyOf(t.product.name) === keyOf(s.name))).length ? (
            <View style={[styles.chips, styles.quick]}>
              {(savedTreats.data ?? [])
                .filter((s) => !treats.some((t) => keyOf(t.product.name) === keyOf(s.name)))
                .slice(0, 6)
                .map((s) => (
                  <Chip
                    key={s.id}
                    label={`+ ${s.name}`}
                    selected={false}
                    onPress={() => addTreat({ id: `saved-${s.id}`, kind: "treat", name: s.name, brand: null, imageUrl: s.imageUrl, store: null, price: null, origin: "database" })}
                  />
                ))}
            </View>
          ) : null}

          <ProductPicker kind="treat" placeholder="Search treats" chosen={treats.map((t) => t.product.name)} onPick={addTreat} />

          {result.energy && treats.length ? (
            <Text style={styles.allowance}>
              {"Treats can add up to "}
              <Text style={styles.strong}>{`${result.energy.treatKcal} kcal`}</Text>
              {" a day."}
            </Text>
          ) : null}
        </>
      ) : null}

      {screen === "summary" && food && unit ? (
        <>
          <Text style={setupText.title}>{`${name}'s food plan`}</Text>
          <View style={[styles.overall, result.overall === "bad" ? styles.overallBad : result.overall === "note" ? styles.overallNote : styles.overallGood]}>
            <MarkIcon mark={result.overall} size={18} />
            <Text style={[styles.overallText, result.overall === "bad" && styles.overallTextBad]}>
              {result.overall === "good"
                ? `Fits ${name}.`
                : result.overall === "note"
                  ? `Works, with ${result.issues.length === 1 ? "one thing" : `${result.issues.length} things`} to watch.`
                  : `Needs a change before it fits ${name}.`}
            </Text>
          </View>

          <Card>
            <View style={styles.productHead}>
              <ProductThumb product={food.product} size={48} />
              <View style={styles.flex}>
                <Text style={styles.treatName} numberOfLines={2}>
                  {food.product.name}
                </Text>
                {result.amount != null ? <Text style={styles.summaryAmount}>{`${formatAmount(result.amount, unit)} a day`}</Text> : null}
              </View>
              <FitChip mark={result.food?.mark ?? "good"} />
            </View>
            {result.treats.map(({ item, verdict: v, share }) => (
              <View key={item.product.id} style={[styles.productHead, styles.summaryTreat]}>
                <ProductThumb product={item.product} size={48} />
                <View style={styles.flex}>
                  <Text style={styles.treatName} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.treatMeta}>{share ? `${share.count} a day` : "Calories unknown"}</Text>
                </View>
                <FitChip mark={v.mark} />
              </View>
            ))}
          </Card>

          {result.issues.length ? (
            <View style={styles.issues}>
              <Checks checks={result.issues} />
            </View>
          ) : null}

          {result.food?.mark === "bad" ? (
            <PressScale accessibilityRole="button" accessibilityLabel="See foods that fit" scaleTo={0.97} style={styles.fixLink} onPress={() => go("food")}>
              <Text style={styles.fixText}>See foods that fit</Text>
              <ArrowRightIcon size={14} color={text.primary} weight="bold" />
            </PressScale>
          ) : null}

          {basisLine ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Based on ${basisLine}. Change`}
              scaleTo={0.98}
              style={styles.basis}
              onPress={() => {
                setAsked(editingAll());
                setDirection(-1);
                setCurrent("about");
              }}
            >
              <Text style={styles.basisText}>
                {`Based on ${basisLine}. `}
                <Text style={styles.basisLink}>Change</Text>
              </Text>
            </PressScale>
          ) : null}
        </>
      ) : null}
    </SetupShell>
  );
};

/** One question on the about step: a small label over its answers. */
const Ask = ({ label, children }: { label: string; children: ReactNode }) => (
  <View style={styles.ask}>
    <Text style={partsStyles.section}>{label}</Text>
    {children}
  </View>
);

/** Foods that match the dog's profile and the owner's preferences, found with SerpApi. */
export const Alternatives = ({
  name,
  state,
  onUse,
}: {
  name: string;
  state: Lookup<Product[]> | "loading" | null;
  onUse: (product: Product) => void;
}) => (
  <View>
    <Text style={partsStyles.section}>{`Foods that suit ${name}`}</Text>
    {state === "loading" || state == null ? (
      <Text style={styles.treatMeta}>Looking for foods that match</Text>
    ) : state.state === "ready" ? (
      <View style={styles.altList}>
        {state.items.map((product, index) => (
          <Animated.View key={product.id} entering={FadeIn.duration(motion.duration.enter).delay(index * motion.stagger)} style={styles.alt}>
            <ProductThumb product={product} size={52} />
            <View style={styles.flex}>
              <Text style={styles.treatName} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.treatMeta}>{[product.store, product.price].filter(Boolean).join(" · ")}</Text>
            </View>
            <PressScale accessibilityRole="button" accessibilityLabel={`Check ${product.name}`} scaleTo={0.94} style={styles.use} onPress={() => onUse(product)}>
              <Text style={styles.useText}>Check</Text>
            </PressScale>
          </Animated.View>
        ))}
        <Text style={partsStyles.caption}>Switch over 7 to 10 days, mixing in a little more of the new food each day. Ask your vet first if there is a health condition.</Text>
      </View>
    ) : (
      <Text style={styles.treatMeta}>{state.state === "offline" ? "The product search is not answering right now. Try again in a moment." : "No matching foods came back."}</Text>
    )}
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  blank: { flex: 1, backgroundColor: bg.canvas },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  strong: { fontWeight: "700", color: text.primary },

  ask: { marginTop: space.sm },
  weightRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  still: { height: 48, paddingHorizontal: space.lg, borderRadius: radius.control, backgroundColor: accent.primary, justifyContent: "center" },
  stillText: { ...type.supporting, fontWeight: "700", color: text.primary },
  record: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  recordTitle: { ...type.supporting, fontWeight: "700", color: text.primary },
  recordSub: { ...type.caption, color: text.secondary, marginTop: 2 },

  productHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  productName: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  fitRow: { flexDirection: "row", marginTop: 6 },
  kcalRow: { flexDirection: "row", gap: space.sm },
  amountCard: { marginTop: space.md },
  cardLabel: { ...type.supporting, fontWeight: "600", color: text.secondary },
  amount: { fontSize: 34, lineHeight: 40, fontWeight: "700", letterSpacing: -0.8, color: text.primary, marginTop: 2, fontVariant: ["tabular-nums"] },
  amountUnit: { ...type.body, fontWeight: "500", color: text.secondary, letterSpacing: 0 },
  perMeal: { ...type.supporting, color: text.secondary },
  unitChips: { marginTop: space.md },
  issues: { marginTop: space.xl },

  treatList: { marginTop: space.xl, gap: space.sm },
  treat: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  treatName: { ...type.supporting, fontWeight: "700", color: text.primary },
  treatMeta: { ...type.caption, color: text.secondary, marginTop: 2 },
  kcalEach: { alignItems: "center", gap: 2 },
  kcalEachLabel: { ...type.caption, fontSize: 10, color: text.tertiary },
  quick: { marginTop: space.lg },
  allowance: { ...type.supporting, color: text.secondary, marginTop: space.lg },

  overall: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, marginBottom: space.md, padding: space.lg, borderRadius: radius.card },
  overallGood: { backgroundColor: accent.soft },
  overallNote: { backgroundColor: accent.primary },
  overallBad: { backgroundColor: text.primary },
  overallText: { ...type.body, fontWeight: "600", color: text.primary, flex: 1 },
  overallTextBad: { color: text.inverse },
  summaryAmount: { ...type.caption, fontWeight: "600", color: text.secondary, marginTop: 2, fontVariant: ["tabular-nums"] },
  summaryTreat: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: border.soft },
  fixLink: { flexDirection: "row", alignItems: "center", gap: space.sm, alignSelf: "flex-start", marginTop: space.xl, paddingHorizontal: space.lg, height: 40, borderRadius: radius.pill, backgroundColor: accent.primary },
  fixText: { ...type.supporting, fontWeight: "700", color: text.primary },
  basis: { marginTop: space.xl },
  basisText: { ...type.caption, color: text.tertiary },
  basisLink: { fontWeight: "700", color: text.primary, textDecorationLine: "underline" },

  altList: { gap: space.sm },
  alt: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  use: { paddingHorizontal: space.md, height: 32, borderRadius: radius.pill, backgroundColor: accent.deep, justifyContent: "center" },
  useText: { ...type.caption, fontWeight: "700", color: text.primary },
});
