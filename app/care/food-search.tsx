import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {
  CaretLeftIcon,
  CheckIcon,
  ForkKnifeIcon,
  MagnifyingGlassIcon,
  PawPrintIcon,
  PlusIcon,
  XIcon,
} from "phosphor-react-native";

import { goBack } from "@/features/care/components/DetailShell";
import { TREAT_CATALOG, matchTreats, treatLabel } from "@/features/care/components/treatCatalog";
import { PressScale } from "@/components/ui/PressScale";
import { useCareProfile } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useLogFeeding } from "@/hooks/useFeedingLogs";
import { useInvalidateRecentTreats, useSaveTreat, useSavedTreats, useSetCurrentFood } from "@/hooks/useFood";
import { rememberFoodFacts } from "@/features/care/state/foodFacts";
import { searchPetFoods, type FoodSearch } from "@/services/foodService";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

type Lookup = { state: "idle" } | { state: "looking" } | FoodSearch;

type Item = {
  key: string;
  kind: "food" | "treat";
  label: string;
  brand: string | null;
  title: string;
  meta: string | null;
  imageUrl: string | null;
  kcalPer100g: number | null;
  nutrients?: Omit<import("@/features/care/state/foodFacts").Nutrients, "kcalPer100g">;
};

export default function FoodSearchScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ mode?: string; intent?: string }>();
  const treatMode = params.mode === "treat";
  const logIntent = params.intent === "log";

  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const name = dog.data?.name ?? "your dog";
  const careProfile = useCareProfile(dogId);
  const setFood = useSetCurrentFood(dogId);
  const saveTreat = useSaveTreat(dogId);
  const savedTreats = useSavedTreats(dogId);
  const logFeeding = useLogFeeding(dogId);
  const refreshRecent = useInvalidateRecentTreats(dogId);

  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);

  const current = careProfile.data?.foodBrand ?? null;
  const typed = query.trim();
  const savedNames = useMemo(
    () => new Set((savedTreats.data ?? []).map((treat) => treat.name.toLowerCase())),
    [savedTreats.data],
  );

  useEffect(() => {
    if (typed.length < 2) {
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "looking" });
    let live = true;
    const timer = setTimeout(() => {
      void searchPetFoods(typed).then((result) => {
        if (live) setLookup(result);
      });
    }, 420);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [typed]);

  const catalogItems: Item[] = useMemo(() => {
    const source = typed.length >= 2 ? matchTreats(typed) : treatMode ? TREAT_CATALOG.slice(0, 14) : [];
    return source.map((treat) => ({
      key: `catalog:${treat.key}`,
      kind: "treat",
      label: treatLabel(treat),
      brand: treat.brand,
      title: treat.name,
      meta: treat.brand ? null : "Kitchen snack",
      imageUrl: null,
      kcalPer100g: null,
    }));
  }, [typed, treatMode]);

  const remoteItems: Item[] = useMemo(
    () =>
      lookup.state === "ready"
        ? lookup.items.map((food) => ({
            key: food.code,
            kind: food.kind,
            label: food.brand ? `${food.brand} ${food.name}` : food.name,
            brand: food.brand,
            title: food.name,
            meta: food.kcalPer100g ? `${food.kcalPer100g} kcal per 100 g` : null,
            imageUrl: food.imageUrl,
            kcalPer100g: food.kcalPer100g,
            nutrients: { protein: food.protein, fat: food.fat, fiber: food.fiber, carbs: food.carbs, moisture: food.moisture },
          }))
        : [],
    [lookup],
  );

  const catalogLabels = new Set(catalogItems.map((item) => item.label.toLowerCase()));
  const treats = [
    ...catalogItems,
    ...remoteItems.filter((item) => item.kind === "treat" && !catalogLabels.has(item.label.toLowerCase())),
  ];
  const foods = remoteItems.filter((item) => item.kind === "food");

  const finish = () => setTimeout(() => goBack("/(tabs)/care"), 420);

  const pick = (item: Item) => {
    if (!dogId || busy) return;
    setFailed(false);
    // Keep what the food is made of, so Nutrition can break it down.
    rememberFoodFacts({
      name: item.label,
      imageUrl: item.imageUrl,
      kcalPer100g: item.kcalPer100g,
      protein: item.nutrients?.protein ?? null,
      fat: item.nutrients?.fat ?? null,
      fiber: item.nutrients?.fiber ?? null,
      carbs: item.nutrients?.carbs ?? null,
      moisture: item.nutrients?.moisture ?? null,
    });

    if (item.kind === "food" && !treatMode) {
      setBusy(item.key);
      setFood.mutate(
        { name: item.label, imageUrl: item.imageUrl, kcalPer100g: item.kcalPer100g },
        {
          onSuccess: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setDone(new Set([item.key]));
            finish();
          },
          onError: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setBusy(null);
            setFailed(true);
          },
        },
      );
      return;
    }

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDone((current) => new Set([...current, item.key]));
    if (!savedNames.has(item.label.toLowerCase())) {
      saveTreat.mutate({ name: item.label, imageUrl: item.imageUrl });
    }
    if (logIntent) {
      setBusy(item.key);
      logFeeding.mutate(
        { logType: "treat", mealName: item.label },
        {
          onSuccess: () => {
            refreshRecent();
            finish();
          },
          onError: () => {
            setBusy(null);
            setFailed(true);
          },
        },
      );
    } else if (treatMode) {
      finish();
    }
  };

  const typedItem: Item = {
    key: "typed",
    kind: treatMode ? "treat" : "food",
    label: typed,
    brand: null,
    title: typed,
    meta: null,
    imageUrl: null,
    kcalPer100g: null,
  };

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter);
  const looking = lookup.state === "looking";
  const nothing =
    typed.length >= 2 && !looking && treats.length === 0 && foods.length === 0;

  const treatSection =
    treats.length > 0 ? (
      <Section
        title={typed.length >= 2 ? "Treats" : "Popular treats"}
        items={treats}
        done={done}
        busy={busy}
        saved={savedNames}
        reduceMotion={reduceMotion}
        onPick={pick}
      />
    ) : null;

  const foodSection =
    foods.length > 0 ? (
      <Section
        title={treatMode ? "Other results" : "Food"}
        items={foods}
        done={done}
        busy={busy}
        saved={savedNames}
        reduceMotion={reduceMotion}
        onPick={pick}
      />
    ) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.roundButton}
          onPress={() => goBack("/(tabs)/care")}
        >
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.page }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {treatMode ? (logIntent ? `Which treat did ${name} get?` : `${name}'s treats`) : `What does ${name} eat?`}
        </Text>
        {!treatMode && current ? (
          <View style={styles.current}>
            <CheckIcon size={iconSize.inline} color={text.primary} weight="bold" />
            <Text style={styles.currentText} numberOfLines={1}>
              Now: {current}
            </Text>
          </View>
        ) : (
          <Text style={styles.lede}>
            {treatMode
              ? "Brand treats, chews and kitchen snacks."
              : "Food and treats. Search the brand or the name on the bag."}
          </Text>
        )}

        <View style={styles.search}>
          <MagnifyingGlassIcon size={iconSize.standard} color={text.primary} weight="bold" />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder={treatMode ? "Dentastix, jerky, carrot" : "Royal Canin, Dentastix, Orijen"}
            placeholderTextColor={text.tertiary}
            autoFocus={!treatMode}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
              scaleTo={0.9}
              onPress={() => setQuery("")}
            >
              <XIcon size={iconSize.inline} color={text.secondary} weight="bold" />
            </PressScale>
          ) : null}
        </View>

        {failed ? (
          <Text style={styles.error}>That did not save. Check your connection and try again.</Text>
        ) : null}

        <Animated.View layout={settle}>
          {treatMode ? treatSection : foodSection}
          {treatMode ? foodSection : treatSection}

          {looking ? (
            <View style={styles.section}>
              {[0, 1, 2].map((index) => (
                <View key={index} style={[styles.skeleton, index > 0 && styles.rule]} />
              ))}
            </View>
          ) : null}

          {nothing ? (
            <Text style={styles.message}>
              {lookup.state === "offline"
                ? "Could not reach the food database. You can still add it as written."
                : `Nothing found for “${typed}”.`}
            </Text>
          ) : null}
        </Animated.View>

        {typed.length >= 2 ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Add ${typed} as written`}
            scaleTo={0.98}
            style={styles.own}
            onPress={() => pick(typedItem)}
          >
            <View style={[styles.pick, done.has("typed") && styles.pickOn]}>
              {done.has("typed") ? (
                <CheckIcon size={14} color={text.primary} weight="bold" />
              ) : (
                <PlusIcon size={14} color={text.primary} weight="bold" />
              )}
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.product} numberOfLines={1}>
                Add &ldquo;{typed}&rdquo;{treatMode ? " as a treat" : ""}
              </Text>
              <Text style={styles.meta}>Not in the list. PAWS keeps your spelling.</Text>
            </View>
          </PressScale>
        ) : null}

        <Text style={styles.credit}>Packaged product data from Open Pet Food Facts.</Text>
      </ScrollView>
    </View>
  );
}

const Section = ({
  title,
  items,
  done,
  busy,
  saved,
  reduceMotion,
  onPick,
}: {
  title: string;
  items: readonly Item[];
  done: ReadonlySet<string>;
  busy: string | null;
  saved: ReadonlySet<string>;
  reduceMotion: boolean;
  onPick: (item: Item) => void;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {items.map((item, index) => {
      const ticked = done.has(item.key) || (item.kind === "treat" && saved.has(item.label.toLowerCase()));
      return (
        <Animated.View
          key={item.key}
          entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(Math.min(index, 8) * 25)}
          style={index > 0 ? styles.rule : undefined}
        >
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${item.kind === "treat" ? "Treat" : "Food"}: ${item.label}`}
            scaleTo={0.98}
            style={styles.row}
            disabled={busy !== null && busy !== item.key}
            onPress={() => onPick(item)}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.thumb} contentFit="contain" transition={120} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty, item.kind === "treat" && styles.thumbTreat]}>
                {item.kind === "treat" ? (
                  <PawPrintIcon size={iconSize.standard} color={text.primary} weight="fill" />
                ) : (
                  <ForkKnifeIcon size={iconSize.standard} color={text.tertiary} weight="regular" />
                )}
              </View>
            )}
            <View style={styles.rowCopy}>
              {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
              <Text style={styles.product} numberOfLines={2}>
                {item.title}
              </Text>
              {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
            </View>
            <View style={[styles.pick, ticked && styles.pickOn]}>
              {ticked ? (
                <CheckIcon size={14} color={text.primary} weight="bold" />
              ) : (
                <PlusIcon size={14} color={text.primary} weight="bold" />
              )}
            </View>
          </PressScale>
        </Animated.View>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: { paddingHorizontal: layout.gutter },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.xl },
  title: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.9,
    fontWeight: "700",
    color: text.primary,
  },
  lede: { ...type.body, color: text.secondary, marginTop: space.sm },
  current: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: space.md,
    height: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    maxWidth: "100%",
  },
  currentText: { ...type.supporting, fontWeight: "600", color: text.primary, flexShrink: 1 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.xl,
    height: layout.controlHeight,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: text.primary,
  },
  input: { ...type.body, flex: 1, color: text.primary, paddingVertical: 0 },
  error: { ...type.supporting, color: text.primary, marginTop: space.md },

  section: { marginTop: space.xl },
  sectionTitle: { ...type.supporting, fontWeight: "700", color: text.secondary, marginBottom: space.xs },
  rule: { borderTopWidth: 1, borderTopColor: border.soft },
  skeleton: { height: 76, marginVertical: 1, borderRadius: radius.control, backgroundColor: bg.stage },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: bg.canvas },
  thumbEmpty: { borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  thumbTreat: { backgroundColor: accent.primary, borderColor: accent.primary },
  rowCopy: { flex: 1 },
  brand: { ...type.caption, fontWeight: "600", color: text.secondary },
  product: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  meta: { ...type.caption, color: text.tertiary, marginTop: 2 },
  pick: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  pickOn: { backgroundColor: accent.deep, borderColor: accent.deep },
  message: { ...type.supporting, color: text.secondary, paddingVertical: space.lg },

  own: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: border.strong,
  },
  credit: { ...type.caption, color: text.tertiary, marginTop: space.section },
});
