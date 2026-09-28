import { memo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { ArrowUpRightIcon, StarIcon, StarHalfIcon } from "phosphor-react-native";

import { openLink } from "@/lib/openLink";
import { PressScale } from "@/components/ui/PressScale";
import { RETAILERS, SEARCH_TERM } from "@/constants/retailers";
import { KIT_QUERY, type Offer } from "@/services/shopSearch";
import type { Feed } from "@/services/serpApi";
import {
  accent,
  bg,
  border,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const CARD = 176;

const Stars = memo(({ rating }: { rating: number }) => (
  <View style={styles.stars}>
    {[0, 1, 2, 3, 4].map((index) => {
      const filled = rating - index;
      if (filled >= 0.75)
        return <StarIcon key={index} size={11} color={accent.band} weight="fill" />;
      if (filled >= 0.25)
        return <StarHalfIcon key={index} size={11} color={accent.band} weight="fill" />;
      return <StarIcon key={index} size={11} color={border.strong} weight="fill" />;
    })}
  </View>
));

Stars.displayName = "Stars";

const OfferCard = memo(
  ({ offer, order, reduceMotion }: { offer: Offer; order: number; reduceMotion: boolean }) => {
    const [failed, setFailed] = useState(false);
    const source = failed && offer.fallbackThumbnail ? offer.fallbackThumbnail : offer.thumbnail;

    return (
    <Animated.View
      entering={
        reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 45)
      }
    >
      <PressScale
        accessibilityRole="link"
        accessibilityLabel={`${offer.title}, ${offer.price} at ${offer.merchant}${
          offer.rating ? `, rated ${offer.rating} from ${offer.reviews} reviews` : ""
        }`}
        scaleTo={0.97}
        style={styles.card}
        onPress={() => {
          void Haptics.selectionAsync();
          if (offer.link) void openLink(offer.link);
        }}
      >
        <View style={styles.frame}>
          <Image
            source={{ uri: source }}
            style={styles.photo}
            contentFit="contain"
            transition={180}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
          {offer.tag ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {offer.tag}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {offer.title}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{offer.price}</Text>
          {offer.wasPrice ? <Text style={styles.was}>{offer.wasPrice}</Text> : null}
        </View>

        <View style={styles.merchantRow}>
          {offer.merchantIcon ? (
            <Image
              source={{ uri: offer.merchantIcon }}
              style={styles.merchantIcon}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text style={styles.merchant} numberOfLines={1}>
            {offer.merchant}
          </Text>
        </View>

        {offer.delivery ? (
          <Text style={styles.delivery} numberOfLines={1}>
            {offer.delivery}
          </Text>
        ) : null}

        {offer.rating !== null ? (
          <View style={styles.ratingRow}>
            <Text style={styles.ratingValue}>{offer.rating.toFixed(1)}</Text>
            <Stars rating={offer.rating} />
            {offer.reviews ? (
              <Text style={styles.reviews}>({offer.reviews.toLocaleString()})</Text>
            ) : null}
          </View>
        ) : null}
      </PressScale>
    </Animated.View>
    );
  },
);

OfferCard.displayName = "OfferCard";

const Skeleton = ({ reduceMotion }: { reduceMotion: boolean }) => (
  <View style={styles.railInner}>
    {[0, 1, 2].map((index) => (
      <Animated.View
        key={index}
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
        style={[styles.card, styles.ghost]}
      >
        <View style={[styles.frame, styles.ghostBlock]} />
        <View style={[styles.ghostLine, { width: "92%" }]} />
        <View style={[styles.ghostLine, { width: "64%" }]} />
        <View style={[styles.ghostLine, styles.ghostShort]} />
      </Animated.View>
    ))}
  </View>
);

const ShopHandoff = ({ jobKey, kit }: { jobKey: string; kit: string }) => (
  <View style={styles.handoff}>
    {RETAILERS.map((retailer) => (
      <PressScale
        key={retailer.key}
        accessibilityRole="link"
        accessibilityLabel={`Search ${retailer.name} for ${kit}`}
        scaleTo={0.96}
        style={styles.shopChip}
        onPress={() => {
          void Haptics.selectionAsync();
          const term = KIT_QUERY[jobKey]?.term ?? SEARCH_TERM[jobKey] ?? kit;
          void openLink(retailer.search(term));
        }}
      >
        <Text style={styles.shopChipText}>{retailer.name}</Text>
        <ArrowUpRightIcon size={11} color={text.secondary} weight="bold" />
      </PressScale>
    ))}
  </View>
);

export const ProductRail = ({
  jobKey,
  kit,
  feed,
  reduceMotion,
}: {
  jobKey: string;
  kit: string;
  feed: Feed<Offer>;
  reduceMotion: boolean;
}) => {
  if (feed.state === "loading" || feed.state === "idle") {
    return <Skeleton reduceMotion={reduceMotion} />;
  }

  if (feed.state !== "ready") {
    const note =
      feed.state === "unconfigured"
        ? "Live prices need a SerpApi key in this build."
        : feed.state === "offline"
          ? "No connection to the shops."
          : feed.state === "empty"
            ? "No listings came back for this one."
            : "The product search did not answer.";

    return (
      <View>
        <Text style={styles.failNote}>{note} Search a shop instead:</Text>
        <ShopHandoff jobKey={jobKey} kit={kit} />
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railInner}
        snapToInterval={CARD + space.md}
        decelerationRate="fast"
      >
        {feed.items.map((offer, index) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            order={index}
            reduceMotion={reduceMotion}
          />
        ))}
      </ScrollView>
      <ShopHandoff jobKey={jobKey} kit={kit} />
    </View>
  );
};

const styles = StyleSheet.create({
  railInner: { flexDirection: "row", gap: space.md, paddingVertical: space.sm },
  card: { width: CARD },
  frame: {
    width: CARD,
    height: 148,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
    overflow: "hidden",
    justifyContent: "center",
  },
  photo: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    left: space.sm,
    bottom: space.sm,
    backgroundColor: bg.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: border.soft,
  },
  badgeText: { ...type.caption, fontWeight: "600", color: text.primary },

  cardTitle: {
    ...type.supporting,
    fontWeight: "600",
    color: text.primary,
    marginTop: space.sm,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: space.xs, marginTop: space.xs },
  price: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  was: { ...type.caption, color: text.tertiary, textDecorationLine: "line-through" },

  merchantRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  merchantIcon: { width: 13, height: 13, borderRadius: 3 },
  merchant: { ...type.caption, color: text.secondary, flexShrink: 1 },
  delivery: { ...type.caption, color: text.tertiary, marginTop: 1 },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: 3 },
  ratingValue: { ...type.caption, fontWeight: "600", color: text.primary },
  stars: { flexDirection: "row", gap: 1 },
  reviews: { ...type.caption, color: text.tertiary },

  ghost: { opacity: 0.55 },
  ghostBlock: { backgroundColor: bg.subtle },
  ghostLine: {
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    marginTop: space.sm,
  },
  ghostShort: { width: "40%" },

  failNote: { ...type.caption, color: text.secondary, marginTop: space.sm },
  handoff: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.sm,
  },
  shopChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.surface,
  },
  shopChipText: { ...type.caption, fontWeight: "600", color: text.primary },
});
