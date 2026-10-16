import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { ArrowRightIcon, BowlFoodIcon, CheckIcon, CookieIcon, SparkleIcon, ToothIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { enter } from "@/features/care/food/enter";
import { alternativesQuery, dietTags } from "@/features/care/food/foodPlanMath";
import { useDogBasis } from "@/features/care/food/useDogBasis";
import { useFoodPlan } from "@/features/care/state/foodPlan";
import { setPendingPicks } from "@/features/care/state/pendingPicks";
import { findAlternatives, type Lookup, type Product } from "@/services/productLookup";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, scene, space, text, type } from "@/constants/design";

type Shelf = "food" | "training" | "dental";

const SHELVES: readonly { key: Shelf; label: string; Glyph: typeof BowlFoodIcon }[] = [
  { key: "food", label: "Main food", Glyph: BowlFoodIcon },
  { key: "training", label: "Treats", Glyph: CookieIcon },
  { key: "dental", label: "Dental", Glyph: ToothIcon },
];

/**
 * Picks for a dog with nothing on the menu yet: foods and treats found for its life stage, allergies, weight goal and
 * the owner's preferences (the filters show as tags at the top). Choose up to one of each, then start the Food Plan
 * with them already in place, where each one gets its full fit check and portion.
 */
export const FoodBrowse = () => {
  const reduceMotion = useReducedMotion();
  const store = useFoodPlan();
  const { basis } = useDogBasis();
  const prefs = store.prefs;
  const name = basis.name;
  const tags = dietTags(basis, prefs);

  const [shelf, setShelf] = useState<Shelf>("food");
  const [found, setFound] = useState<Partial<Record<Shelf, Lookup<Product[]> | "loading">>>({});
  const [picked, setPicked] = useState<Partial<Record<Shelf, Product>>>({});
  const [attempt, setAttempt] = useState(0);

  // Shop search is loose, so drop anything for the wrong life stage or naming an allergen or something to avoid.
  const avoid = [...basis.allergies, ...prefs.avoid].map((a) => a.toLowerCase());
  const suits = (product: Product) => {
    const n = product.name.toLowerCase();
    if (avoid.some((a) => n.includes(a))) return false;
    if (basis.stage !== "puppy" && /\bpupp(y|ies)\b/.test(n) && !/all life stages/.test(n)) return false;
    if (basis.stage === "puppy" && /\b(senior|adult)\b/.test(n)) return false;
    return true;
  };

  const queryFor = (s: Shelf) =>
    s === "food"
      ? alternativesQuery(basis, prefs, "food")
      : `${alternativesQuery(basis, prefs, "treat").replace(/low calorie dog treats$/, "")} ${s === "dental" ? "dental chews" : "low calorie training treats"}`.trim();
  const query = queryFor(shelf);

  // One search per shelf, kept while the screen is open: the product search has a small monthly allowance.
  useEffect(() => {
    const have = found[shelf];
    if (have && have !== "loading" && have.state === "ready") return;
    let alive = true;
    setFound((f) => ({ ...f, [shelf]: "loading" }));
    void findAlternatives(query, shelf === "food" ? "food" : "treat", "", 10).then((result) => {
      if (!alive) return;
      const items = result.state === "ready" ? result.items.filter(suits).slice(0, 6) : [];
      setFound((f) => ({ ...f, [shelf]: result.state !== "ready" ? result : items.length ? { state: "ready", items } : { state: "empty" } }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelf, query, attempt]);

  const state = found[shelf] ?? "loading";
  const count = Object.keys(picked).length;

  const start = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPendingPicks({
      food: picked.food ?? null,
      treats: [
        ...(picked.training ? [{ product: picked.training, role: "training" as const }] : []),
        ...(picked.dental ? [{ product: picked.dental, role: "dental" as const }] : []),
      ],
    });
    router.replace("/care/food-plan" as never);
  };

  return (
    <DetailShell
      title={`Picks for ${name}`}
      glyph={<SparkleIcon size={iconSize.standard} color={accent.band} weight="fill" />}
      action={
        count
          ? { label: `Start with ${count} ${count === 1 ? "pick" : "picks"}`, icon: <ArrowRightIcon size={iconSize.button} color={text.primary} weight="bold" />, onPress: start }
          : undefined
      }
    >
      <View style={styles.tags} accessibilityLabel={`Matched to ${tags.join(", ")}`}>
        {tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
        <PressScale accessibilityRole="link" accessibilityLabel="Change food preferences" hitSlop={8} scaleTo={0.95} onPress={() => router.push("/care/food-prefs" as never)}>
          <Text style={styles.edit}>Edit</Text>
        </PressScale>
      </View>

      <View style={styles.shelves} accessibilityRole="tablist">
        {SHELVES.map(({ key, label, Glyph }) => {
          const on = key === shelf;
          return (
            <PressScale
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              scaleTo={0.96}
              style={[styles.shelf, on && styles.shelfOn]}
              onPress={() => {
                if (on) return;
                void Haptics.selectionAsync();
                setShelf(key);
              }}
            >
              <Glyph size={16} color={text.primary} weight={on ? "fill" : "regular"} />
              <Text style={[styles.shelfText, on && styles.shelfTextOn]}>{label}</Text>
              {picked[key] ? <View style={styles.shelfDot} /> : null}
            </PressScale>
          );
        })}
      </View>

      {state === "loading" ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.cell}>
              <View style={[styles.photo, styles.skeleton]} />
              <View style={[styles.bar, { width: "85%" }]} />
              <View style={[styles.bar, { width: "50%" }]} />
            </View>
          ))}
        </View>
      ) : state.state === "ready" ? (
        <View style={styles.grid} key={shelf}>
          {state.items.map((product, i) => {
            const on = picked[shelf]?.id === product.id;
            return (
              <Animated.View key={product.id} entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: i * motion.stagger, duration: motion.duration.enter })} style={styles.cell}>
                <PressScale
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${product.name}${product.price ? `, ${product.price}` : ""}`}
                  scaleTo={0.97}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setPicked((p) => {
                      const next = { ...p };
                      if (on) delete next[shelf];
                      else next[shelf] = product;
                      return next;
                    });
                  }}
                >
                  <View style={[styles.photo, on && styles.photoOn]}>
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
                    ) : (
                      <BowlFoodIcon size={30} color={text.tertiary} />
                    )}
                    {on ? (
                      <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.check}>
                        <CheckIcon size={14} color={text.inverse} weight="bold" />
                      </Animated.View>
                    ) : null}
                  </View>
                  <Text style={styles.name} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[product.price, product.store].filter(Boolean).join(" · ")}
                  </Text>
                </PressScale>
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{state.state === "offline" ? "The product search is not answering." : "Nothing matched these filters."}</Text>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Try again"
            scaleTo={0.95}
            style={styles.retry}
            onPress={() => setAttempt((n) => n + 1)}
          >
            <Text style={styles.retryText}>Try again</Text>
          </PressScale>
        </View>
      )}

      <Text style={styles.foot}>{`PAWS checks each pick against ${name}'s needs before it goes on the menu.`}</Text>
    </DetailShell>
  );
};

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: space.md },
  tag: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: scene.blobSoft },
  tagText: { ...type.caption, fontWeight: "600", color: text.primary },
  edit: { ...type.caption, fontWeight: "700", color: text.secondary, textDecorationLine: "underline", marginLeft: 4 },

  shelves: { flexDirection: "row", gap: space.sm, marginTop: space.xl },
  shelf: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft },
  shelfOn: { backgroundColor: accent.primary, borderColor: accent.deep },
  shelfText: { ...type.supporting, color: text.secondary },
  shelfTextOn: { fontWeight: "600", color: text.primary },
  shelfDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: scene.sageDeep },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.xl, marginTop: space.xl },
  cell: { width: "48%" },
  photo: { height: 150, borderRadius: radius.card, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center", padding: space.md, borderWidth: 2, borderColor: "transparent" },
  photoOn: { borderColor: scene.sageDeep, backgroundColor: accent.soft },
  skeleton: { borderWidth: 0 },
  image: { width: "100%", height: "100%" },
  check: { position: "absolute", top: space.sm, right: space.sm, width: 24, height: 24, borderRadius: 12, backgroundColor: scene.sageDeep, alignItems: "center", justifyContent: "center" },
  name: { ...type.supporting, fontWeight: "600", color: text.primary, marginTop: space.sm },
  meta: { ...type.caption, color: text.tertiary, marginTop: 2 },
  bar: { height: 12, borderRadius: 6, backgroundColor: bg.subtle, marginTop: space.sm },

  empty: { alignItems: "flex-start", marginTop: space.xl, gap: space.md },
  emptyText: { ...type.body, color: text.secondary },
  retry: { paddingHorizontal: space.lg, height: 40, borderRadius: radius.pill, backgroundColor: accent.primary, justifyContent: "center" },
  retryText: { ...type.supporting, fontWeight: "600", color: text.primary },

  foot: { ...type.caption, color: text.tertiary, marginTop: space.xxl },
});
