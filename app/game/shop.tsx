import { useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  useReducedMotion,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArmchairIcon,
  BowlFoodIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  TShirtIcon,
  TennisBallIcon,
} from "phosphor-react-native";

import { ProductCard } from "@/components/shop/ProductCard";
import { Coin } from "@/components/shop/ProductArt";
import { CATEGORIES, type CategoryKey, type ProductKey } from "@/components/shop/shopData";
import { CountUp } from "@/features/profile/components/CountUp";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { usePurchaseShopBasket, useShopItems } from "@/hooks/useShopItems";
import { useWallet } from "@/hooks/useWallet";
import type { ShopItem } from "@/services/shopService";
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

const CATEGORY_GLYPH = {
  food: BowlFoodIcon,
  toys: TennisBallIcon,
  furniture: ArmchairIcon,
  clothes: TShirtIcon,
} as const;

const COLUMNS = 3;
const CARD_GAP = space.sm;
const BAR_CLEARANCE = 108;

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id;

  const shopItems = useShopItems();
  const wallet = useWallet(dogId);
  const purchase = usePurchaseShopBasket(dogId ?? "");

  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [basket, setBasket] = useState<Readonly<Record<string, number>>>({});
  const [bought, setBought] = useState(false);

  const cardWidth = Math.floor(
    (width - layout.gutter * 2 - CARD_GAP * (COLUMNS - 1)) / COLUMNS,
  );

  const products = shopItems.data ?? [];

  const items = useMemo(
    () => Object.values(basket).reduce((sum, n) => sum + n, 0),
    [basket],
  );
  const total = useMemo(
    () => products.reduce((sum, product) => sum + (basket[product.key] ?? 0) * product.price, 0),
    [basket, products],
  );

  const balance = wallet.data?.goldBalance ?? 0;
  const affordable = total <= balance;

  const add = (key: ProductKey) =>
    setBasket((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }));

  const buy = () => {
    if (!affordable || items === 0 || !dogId || purchase.isPending) return;
    const lines = Object.entries(basket)
      .filter(([, quantity]) => quantity > 0)
      .map(([key, quantity]) => {
        const item = products.find((product) => product.key === key);
        return item ? { itemId: item.id, quantity } : null;
      })
      .filter((line): line is { itemId: string; quantity: number } => line !== null);
    if (lines.length === 0) return;

    purchase.mutate(lines, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBought(true);
        setBasket({});
      },
      onError: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    });
  };

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter);
  const enter = (order: number) =>
    reduceMotion
      ? undefined
      : FadeIn.duration(motion.duration.enter).delay(order * motion.stagger);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.roundButton}
          onPress={() => router.back()}
        >
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>

        <Balance value={balance} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: BAR_CLEARANCE + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={enter(0)}>
          <Shelf title="Pet Shop" />

          <View style={styles.categories}>
            {CATEGORIES.map((item) => {
              const Glyph = CATEGORY_GLYPH[item.key];
              const on = category === item.key;
              return (
                <PressScale
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${item.label}${on ? ", showing" : ""}`}
                  scaleTo={0.94}
                  style={styles.categoryWrap}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setCategory(on ? null : item.key);
                  }}
                >
                  <View style={[styles.category, on && styles.categoryOn]}>
                    <View style={[styles.categoryDisc, on && styles.categoryDiscOn]}>
                      <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
                    </View>
                    <Text style={[styles.categoryLabel, on && styles.categoryLabelOn]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                </PressScale>
              );
            })}
          </View>
        </Animated.View>

        {shopItems.isLoading || wallet.isLoading ? (
          <LoadingState message="Loading the shop…" />
        ) : shopItems.error || wallet.error ? (
          <ErrorState
            message="The shop could not load."
            onRetry={() => {
              void shopItems.refetch();
              void wallet.refetch();
            }}
          />
        ) : (
          <>
            <Animated.View layout={settle}>
              <Grid
                products={products}
                shelf="shop"
                category={category}
                cardWidth={cardWidth}
                basket={basket}
                onAdd={add}
              />
            </Animated.View>

            <Animated.View entering={enter(1)} layout={settle}>
              <Shelf title="Pet Pharmacy" />
              <Grid
                products={products}
                shelf="pharmacy"
                category={category}
                cardWidth={cardWidth}
                basket={basket}
                onAdd={add}
              />
            </Animated.View>
          </>
        )}
      </Animated.ScrollView>

      {items > 0 || bought ? (
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.duration(motion.duration.enter)}
          exiting={reduceMotion ? undefined : SlideOutDown.duration(motion.duration.exit)}
          style={[styles.bar, { paddingBottom: insets.bottom + space.lg }]}
        >
          {bought ? (
            <Animated.View
              key="bought"
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
              style={styles.barRow}
            >
              <CheckCircleIcon size={iconSize.feature} color={accent.deep} weight="fill" />
              <Text style={styles.barDone}>Bought. It is on its way.</Text>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Keep shopping"
                scaleTo={0.97}
                style={styles.quietPill}
                onPress={() => setBought(false)}
              >
                <Text style={styles.quietPillText}>Done</Text>
              </PressScale>
            </Animated.View>
          ) : (
            <Animated.View key="basket" style={styles.barColumn} layout={settle}>
              {purchase.error ? (
                <Text style={styles.barError} numberOfLines={2}>
                  {purchase.error.message}
                </Text>
              ) : null}
              <View style={styles.barRow}>
                <View style={styles.barTotal}>
                  <View style={styles.priceRow}>
                    <Coin size={16} />
                    <CountUp value={total} grouped style={styles.barCoins} />
                  </View>
                  <Text style={styles.barItems}>
                    {items} {items === 1 ? "item" : "items"}
                    {affordable ? "" : ` · ${(total - balance).toLocaleString()} short`}
                  </Text>
                </View>

                <PressScale
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !affordable || purchase.isPending }}
                  accessibilityLabel={
                    affordable
                      ? `Buy ${items} items for ${total} coins`
                      : `Not enough coins. ${total - balance} more needed.`
                  }
                  disabled={!affordable || purchase.isPending}
                  scaleTo={0.97}
                  style={[styles.buy, (!affordable || purchase.isPending) && styles.buyOff]}
                  onPress={buy}
                >
                  <Text style={[styles.buyText, (!affordable || purchase.isPending) && styles.buyTextOff]}>
                    {purchase.isPending ? "Buying…" : affordable ? "Buy" : "Not enough"}
                  </Text>
                </PressScale>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

const Shelf = ({ title }: { title: string }) => (
  <View style={styles.shelfHead}>
    <Text style={styles.shelfTitle}>{title}</Text>
    <PressScale accessibilityRole="button" accessibilityLabel={`See all ${title}`} onPress={() => {}}>
      <View style={styles.seeAll}>
        <Text style={styles.seeAllText}>See all</Text>
        <CaretRightIcon size={iconSize.inline} color={text.secondary} weight="bold" />
      </View>
    </PressScale>
  </View>
);

const Grid = ({
  products,
  shelf,
  category,
  cardWidth,
  basket,
  onAdd,
}: {
  products: readonly ShopItem[];
  shelf: "shop" | "pharmacy";
  category: CategoryKey | null;
  cardWidth: number;
  basket: Readonly<Record<string, number>>;
  onAdd: (key: ProductKey) => void;
}) => {
  const shelved = products.filter(
    (product) => product.shelf === shelf && (category === null || product.category === category),
  );

  if (shelved.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Nothing in this category yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {shelved.map((product, index) => (
        <ProductCard
          key={product.key}
          product={product}
          width={cardWidth}
          count={basket[product.key] ?? 0}
          order={index}
          onAdd={() => onAdd(product.key)}
        />
      ))}
    </View>
  );
};

const Balance = ({ value }: { value: number }) => {
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.balance} accessibilityLabel={`${value} gold coins`}>
      <Coin size={18} />
      <CountUp
        value={value}
        grouped
        style={styles.balanceValue}
        delay={reduceMotion ? 0 : motion.duration.select}
      />
      <Text style={styles.balanceLabel}>coins</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
    paddingBottom: space.sm,
  },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  balance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  balanceValue: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  balanceLabel: { ...type.caption, color: text.secondary },

  content: { paddingHorizontal: layout.gutter },

  shelfHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
  },
  shelfTitle: { ...type.pageTitle, color: text.primary },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { ...type.supporting, fontWeight: "500", color: text.secondary },

  categories: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  categoryWrap: { flex: 1 },
  category: {
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
  },
  categoryOn: { backgroundColor: accent.primary },
  categoryDisc: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryDiscOn: { backgroundColor: bg.canvas },
  categoryLabel: { ...type.caption, fontSize: 11, color: text.secondary, marginTop: 6 },
  categoryLabelOn: { color: text.primary, fontWeight: "600" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP, marginTop: space.lg },

  empty: {
    marginTop: space.lg,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  emptyText: { ...type.supporting, color: text.tertiary },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: space.lg,
    paddingHorizontal: layout.gutter,
    backgroundColor: bg.canvas,
    borderTopWidth: 1,
    borderTopColor: border.soft,
  },
  barColumn: { gap: space.sm },
  barRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  barError: { ...type.caption, color: "#C94B4B" },
  barTotal: { flex: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  barCoins: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  barItems: { ...type.caption, color: text.tertiary, marginTop: 2 },
  barDone: { flex: 1, ...type.cardTitle, fontWeight: "600", color: text.primary },

  buy: {
    minWidth: 118,
    height: layout.controlHeight,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  buyOff: { backgroundColor: bg.subtle },
  buyText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  buyTextOff: { color: text.disabled },

  quietPill: {
    height: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  quietPillText: { ...type.supporting, fontWeight: "500", color: text.secondary },
});
