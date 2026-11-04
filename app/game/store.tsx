import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { ArrowUpRightIcon, CaretLeftIcon, GiftIcon } from "phosphor-react-native";

import { enter } from "@/features/care/food/enter";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { usePetCatalog } from "@/hooks/usePetRewards";
import { useWallet } from "@/hooks/useWallet";
import { loadWebBrowser, MissingNativeFeatureError } from "@/lib/nativeFeatures";
import { CATEGORIES, browseStore, type CategoryKey, type StoreItem } from "@/services/storeBrowse";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

type State = { kind: "loading" } | { kind: "ready"; items: readonly StoreItem[] } | { kind: "empty" } | { kind: "failed" };

/** One pet store, browsable inside PAWS. Items open on the store's own site; the coin math shows what a gift card covers. */
export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const { merchant = "", productId = "" } = useLocalSearchParams<{ merchant?: string; productId?: string }>();
  const dog = useCurrentDog();
  const catalog = usePetCatalog(dog.data?.id);
  const wallet = useWallet(dog.data?.id);

  const reward = catalog.data?.rewards.find((r) => r.productId === productId) ?? null;
  const perUsd = catalog.data?.goldPerUsd ?? 100;
  const balance = wallet.data?.goldBalance ?? 0;

  const [category, setCategory] = useState<CategoryKey>("food");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    void browseStore(merchant, category).then((feed) => {
      if (!live) return;
      if (feed.state === "ready") setState(feed.items.length ? { kind: "ready", items: feed.items } : { kind: "empty" });
      else if (feed.state === "empty") setState({ kind: "empty" });
      else setState({ kind: "failed" });
    });
    return () => {
      live = false;
    };
  }, [merchant, category, attempt]);

  const tile = Math.floor((width - layout.gutter * 2 - space.md) / 2);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => router.back()}>
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {merchant}
        </Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.section }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {reward?.imageUrl ? <Image source={{ uri: reward.imageUrl }} style={styles.heroArt} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
          <View style={styles.flex}>
            <Text style={styles.heroLabel}>{`Pay with a ${merchant} gift card`}</Text>
            <Text style={styles.heroValue}>{`Your coins can get one worth $${Math.floor(balance / perUsd).toLocaleString()}`}</Text>
          </View>
          {reward ? (
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Get a ${merchant} gift card`}
              scaleTo={0.95}
              style={styles.heroButton}
              onPress={() => router.navigate(`/game/shop?redeem=${encodeURIComponent(reward.productId)}` as never)}
            >
              <GiftIcon size={16} color={text.primary} weight="bold" />
              <Text style={styles.heroButtonText}>Gift card</Text>
            </PressScale>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((c) => {
            const on = c.key === category;
            return (
              <PressScale
                key={c.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.label}
                scaleTo={0.95}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => {
                  if (on) return;
                  void Haptics.selectionAsync();
                  setCategory(c.key);
                }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </PressScale>
            );
          })}
        </ScrollView>

        {state.kind === "loading" ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: tile }}>
                <View style={[styles.skeleton, { height: tile }]} />
                <View style={styles.skeletonLine} />
              </View>
            ))}
          </View>
        ) : state.kind === "ready" ? (
          <View style={styles.grid}>
            {state.items.map((item, i) => (
              <Animated.View key={`${item.id}-${i}`} entering={reduceMotion ? undefined : enter({ y: 12 }, { delay: i * 40, duration: motion.duration.enter })} style={{ width: tile }}>
                <PressScale
                  accessibilityRole="link"
                  accessibilityLabel={`${item.title}${item.price ? `, ${item.price}` : ""}. Opens ${merchant}`}
                  scaleTo={0.96}
                  onPress={async () => {
                    void Haptics.selectionAsync();
                    try {
                      const WebBrowser = loadWebBrowser("Opening store websites");
                      // The store opens inside PAWS; Done brings you straight back here.
                      await WebBrowser.openBrowserAsync(item.url, {
                        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                        controlsColor: text.primary,
                        dismissButtonStyle: "done",
                      });
                    } catch (error) {
                      Alert.alert("Could not open the store", error instanceof MissingNativeFeatureError ? error.message : "Try again in a moment.");
                    }
                  }}
                >
                  <View style={[styles.photo, { height: tile }]}>
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photoImage} contentFit="contain" transition={150} accessibilityIgnoresInvertColors /> : null}
                    <View style={styles.open}>
                      <ArrowUpRightIcon size={12} color={text.primary} weight="bold" />
                    </View>
                  </View>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={styles.priceRow}>
                    {item.price ? <Text style={styles.price}>{item.price}</Text> : null}
                  </View>
                </PressScale>
              </Animated.View>
            ))}
          </View>
        ) : (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{state.kind === "empty" ? `Nothing from ${merchant} here right now` : `${merchant} could not load`}</Text>
            <Text style={styles.noticeBody}>{state.kind === "empty" ? "Try another category." : "Check your connection and try again."}</Text>
            {state.kind === "failed" ? (
              <PressScale accessibilityRole="button" accessibilityLabel="Try again" scaleTo={0.96} style={styles.noticeAction} onPress={() => setAttempt((n) => n + 1)}>
                <Text style={styles.noticeActionText}>Try again</Text>
              </PressScale>
            ) : null}
          </View>
        )}

        <Text style={styles.fine}>{`Coins buy gift cards, not items. Redeem a ${merchant} gift card in the Pet Shop, then use it at checkout on ${merchant}. Prices from Google Shopping.`}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  round: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  spacer: { width: 44, height: 44 },
  headerTitle: { ...type.sectionTitle, color: text.primary, flex: 1, textAlign: "center" },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.md },

  hero: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.card + 6, backgroundColor: accent.soft },
  heroArt: { width: 64, height: 40, borderRadius: 6 },
  heroLabel: { ...type.caption, color: text.secondary },
  heroValue: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  heroButton: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  heroButtonText: { ...type.supporting, fontWeight: "600", color: text.primary },

  bleed: { marginHorizontal: -layout.gutter, marginTop: space.xl, marginBottom: space.lg },
  chips: { gap: space.sm, paddingHorizontal: layout.gutter },
  chip: { height: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, justifyContent: "center" },
  chipOn: { backgroundColor: text.primary, borderColor: text.primary },
  chipText: { ...type.supporting, color: text.primary },
  chipTextOn: { color: text.inverse, fontWeight: "600" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, rowGap: space.xl },
  photo: { borderRadius: 14, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  photoImage: { width: "82%", height: "82%" },
  open: { position: "absolute", top: space.sm, right: space.sm, width: 24, height: 24, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  itemTitle: { ...type.caption, fontSize: 13, lineHeight: 17, color: text.primary, marginTop: space.sm, minHeight: 34 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  price: { ...type.supporting, fontWeight: "600", color: text.primary, marginRight: 4, fontVariant: ["tabular-nums"] },
  skeleton: { borderRadius: 14, backgroundColor: bg.subtle },
  skeletonLine: { height: 12, width: "70%", borderRadius: 6, backgroundColor: bg.subtle, marginTop: space.sm },

  notice: { padding: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  noticeTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  noticeBody: { ...type.supporting, color: text.secondary, marginTop: 4 },
  noticeAction: { alignSelf: "flex-start", marginTop: space.md, height: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  noticeActionText: { ...type.supporting, fontWeight: "600", color: text.primary },
  fine: { ...type.caption, color: text.tertiary, textAlign: "center", marginTop: space.xl },
});
