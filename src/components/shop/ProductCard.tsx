import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { PlusIcon } from "phosphor-react-native";

import { Coin, ProductArt } from "@/components/shop/ProductArt";
import { percentOff, type Product } from "@/components/shop/shopData";
import { PressScale } from "@/components/ui/PressScale";
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

export const ProductCard = memo(
  ({
    product,
    width,
    count,
    order,
    onAdd,
  }: {
    product: Product;
    width: number;
    count: number;
    order: number;
    onAdd: () => void;
  }) => {
    const reduceMotion = useReducedMotion();
    const inBasket = count > 0;

    const bump = useSharedValue(0);
    useEffect(() => {
      if (count === 0 || reduceMotion) return;
      bump.value = withSequence(
        withTiming(1, { duration: 130, easing: motion.easing.out }),
        withSpring(0, { duration: 540, dampingRatio: 0.5 }),
      );
    }, [bump, count, reduceMotion]);

    const artStyle = useAnimatedStyle(() => ({
      transform: [{ scale: 1 + bump.value * 0.09 }, { translateY: -bump.value * 4 }],
    }));

    return (
      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : FadeIn.duration(motion.duration.enter)
                .delay(order * 45)
                .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }, { scale: 0.96 }] })
        }
        style={[styles.card, { width }]}
      >
        <View style={styles.chipRow}>
          {product.was ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{percentOff(product.was, product.price)}% off</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.stage}>
          <Animated.View style={artStyle}>
            <ProductArt product={product.key} size={Math.round(width * 0.74)} />
          </Animated.View>
        </View>

        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.detail} numberOfLines={1}>
          {product.detail}
        </Text>

        <View style={styles.footer}>
          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Coin size={13} />
              <Text style={styles.price}>{product.price}</Text>
            </View>
            <View style={styles.wasRow}>
              {product.was ? <Text style={styles.was}>{product.was}</Text> : null}
            </View>
          </View>

          <PressScale
            accessibilityRole="button"
            accessibilityLabel={
              inBasket
                ? `${product.name}, ${count} in basket. Add another.`
                : `Add ${product.name} to the basket, ${product.price} coins`
            }
            scaleTo={0.88}
            hitSlop={8}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAdd();
            }}
          >
            <View style={[styles.add, inBasket && styles.addOn]}>
              <Animated.View
                key={inBasket ? `n${count}` : "plus"}
                entering={
                  reduceMotion ? undefined : FadeIn.duration(motion.duration.select)
                }
              >
                {inBasket ? (
                  <Text style={styles.addCount}>{count}</Text>
                ) : (
                  <PlusIcon size={iconSize.inline} color={text.primary} weight="bold" />
                )}
              </Animated.View>
            </View>
          </PressScale>
        </View>
      </Animated.View>
    );
  },
);

ProductCard.displayName = "ProductCard";

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
    padding: space.md,
    overflow: "hidden",
  },
  chipRow: { height: 22, justifyContent: "center" },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  chipText: { ...type.caption, fontSize: 11, fontWeight: "700", color: text.primary },

  stage: { alignItems: "center", paddingVertical: space.sm, minHeight: 92, justifyContent: "center" },

  name: { ...type.supporting, fontWeight: "600", color: text.primary, minHeight: 40 },
  detail: { ...type.caption, fontSize: 11, color: text.tertiary, marginTop: 2 },

  footer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.xs,
    marginTop: space.md,
  },
  priceBlock: { flexShrink: 1 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  price: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  wasRow: { height: 14, justifyContent: "center" },
  was: {
    ...type.caption,
    fontSize: 11,
    color: text.tertiary,
    textDecorationLine: "line-through",
  },

  add: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
  },
  addOn: { backgroundColor: accent.deep, borderColor: accent.deep },
  addCount: { ...type.caption, fontWeight: "700", color: text.primary },
});
