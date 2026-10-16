import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BowlFoodIcon,
  CookieIcon,
  PlusIcon,
  SparkleIcon,
  ToothIcon,
} from "phosphor-react-native";

import { MARK_LABEL } from "@/features/care/food/FoodPlanParts";
import { useFoodPlanReview } from "@/features/care/food/FoodPlanReview";
import { Lineup, OverviewTab, PlanTab } from "@/features/care/food/FoodPlanBoard";
import { useLivePlan } from "@/features/care/food/usePlan";
import { enter } from "@/features/care/food/enter";
import { AskPeek, PEEK } from "@/features/care/food/AskCamera";
import type { Mark } from "@/features/care/food/foodPlanMath";
import type { PlanItem } from "@/features/care/state/foodPlan";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, layout, motion, radius, scene, space, text, type } from "@/constants/design";

const SHORT: Record<Mark, string> = { good: "Good fit", note: "Mostly fits", bad: "Not a fit" };

type Tab = "overview" | "plan";
const TABS: readonly { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "plan", label: "Food plan" },
];

/** Feed: Overview (routine, plan, and the food check) and Food plan (calories and the lineup). */
export const FoodPlanHome = () => {
  const live = useLivePlan();
  const { plan, result, basis, his } = live;
  const name = basis.name;
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<Tab>("overview");

  if (!plan || !result) {
    return (
      <View>
        <View>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Set up ${name}'s food plan`}
            scaleTo={0.98}
            style={[styles.start, styles.startWithPeek]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/care/food-plan" as never);
            }}
          >
            <View style={styles.flex}>
              <Text style={styles.startTitle}>{`Set up ${name}'s food plan`}</Text>
              <Text style={styles.startText}>{`PAWS checks ${his} food and treats, then works out how much to give.`}</Text>
            </View>
          </PressScale>
          <AskPeek name={name} style={styles.startPeek} />
        </View>
        <Lineup food={null} foodMark={null} treats={[]} focus={null} />
        <Animated.View entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: 420, duration: motion.duration.enter })}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Not sure what to feed? See picks for ${name}`}
            scaleTo={0.98}
            style={styles.ideas}
            onPress={() => {
              void Haptics.selectionAsync();
              router.push("/care/food-browse" as never);
            }}
          >
            <View style={styles.ideasMark}>
              <SparkleIcon size={18} color={text.primary} weight="fill" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.ideasTitle}>Not sure what to feed?</Text>
              <Text style={styles.ideasText}>{`See picks for ${name}`}</Text>
            </View>
            <ArrowRightIcon size={16} color={text.primary} weight="bold" />
          </PressScale>
        </Animated.View>
      </View>
    );
  }

  // Content slides in from the side of the tab you picked, so the two pages keep their places.
  const from = tab === "plan" ? 18 : -18;
  return (
    <View>
      <FeedTabs value={tab} onChange={setTab} />
      <ReviewBanner />
      <Animated.View
        key={tab}
        entering={reduceMotion ? undefined : enter({ x: from }, { duration: motion.duration.enter })}
      >
        {tab === "plan" ? (
          <PlanTab live={live} />
        ) : (
          <OverviewTab live={live} />
        )}
      </Animated.View>
    </View>
  );
};

/** Two tabs with a pill that slides between them. */
const FeedTabs = ({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) => {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = TABS.findIndex((t) => t.value === value);
  const x = useSharedValue(0);
  const segment = (width - TAB_PAD * 2) / TABS.length;

  useEffect(() => {
    const to = index * segment;
    x.value = reduceMotion || !width ? to : withTiming(to, { duration: 260, easing: motion.easing.inOut });
  }, [index, reduceMotion, segment, width, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.tabs} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="tablist">
      {width ? <Animated.View style={[styles.tabPill, { width: segment }, pill]} /> : null}
      {TABS.map((t) => {
        const on = t.value === value;
        return (
          <PressScale
            key={t.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            scaleTo={0.97}
            style={styles.tab}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync();
              onChange(t.value);
            }}
          >
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
          </PressScale>
        );
      })}
    </View>
  );
};

const TAB_PAD = 4;

/** One product on its display block: the pack sits on top, the block carries what it is and whether it fits. */
export const Stand = ({
  order,
  reduceMotion,
  size,
  role,
  item,
  mark,
  onPress,
}: {
  order: number;
  reduceMotion: boolean;
  size: "main" | "side" | "hero";
  role: string;
  item: PlanItem | null;
  mark: Mark | null;
  onPress?: () => void;
}) => {
  const tall = size === "main" ? 150 : size === "hero" ? 170 : 104;
  const arrive = reduceMotion
    ? undefined
    : enter({ y: -14 }, { delay: 120 + order * 80 });
  const body = (
    <>
      <Animated.View entering={arrive} style={[styles.pack, { height: tall }]}>
        {item?.product.imageUrl ? (
          <Image source={{ uri: item.product.imageUrl }} style={styles.packImage} resizeMode="contain" accessibilityIgnoresInvertColors />
        ) : item ? (
          <PackArt role={role} height={tall} />
        ) : (
          <View style={[styles.ghost, { height: tall * 0.82 }]}>
            <PlusIcon size={18} color={text.tertiary} weight="bold" />
          </View>
        )}
      </Animated.View>
      <View style={[styles.block, size !== "side" && styles.blockMain]}>
        <Text style={[styles.role, size !== "side" && styles.roleMain]} numberOfLines={2}>
          {role}
        </Text>
        <Text style={styles.product} numberOfLines={2}>
          {item ? item.product.name : "Add one"}
        </Text>
        {mark ? (
          <View style={[styles.blockChip, mark === "good" ? styles.chipGood : mark === "note" ? styles.chipNote : styles.chipBad]}>
            <Text style={[styles.chipText, mark === "bad" && styles.chipTextBad]} numberOfLines={1}>
              {SHORT[mark]}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
  if (!onPress) return <View style={[styles.stand, size === "main" && styles.standMain]}>{body}</View>;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${role}. ${item ? item.product.name : "Empty"}${mark ? `. ${MARK_LABEL[mark]}` : ""}`}
      scaleTo={0.97}
      style={[styles.stand, size === "main" && styles.standMain, size === "hero" && styles.standHero]}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
    >
      {body}
    </PressScale>
  );
};

/** A drawn pack for products without a photo, coloured by role so the shelf still reads at a glance. */
const PackArt = ({ role, height }: { role: string; height: number }) => {
  const dental = /dental/i.test(role);
  const main = /main/i.test(role);
  const Glyph = dental ? ToothIcon : main ? BowlFoodIcon : CookieIcon;
  return (
    <View style={[styles.packArt, { height: height * 0.86, width: height * (main ? 0.66 : 0.72) }, dental ? styles.packDental : main ? styles.packMain : styles.packTreat]}>
      <View style={[styles.packBand, main && styles.packBandMain]}>
        <Glyph size={height * 0.2} color={main ? text.primary : text.inverse} weight="fill" />
      </View>
    </View>
  );
};

/** "{name}'s needs have changed. Review…" when something feeding depends on moved since the plan was saved. */
export const ReviewBanner = () => {
  const reduceMotion = useReducedMotion();
  const review = useFoodPlanReview();
  const live = useLivePlan();
  if (!review.due) return null;
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${live.basis.name}'s needs have changed. Review ${live.his} Food Plan`}
        scaleTo={0.98}
        style={styles.banner}
        onPress={() => {
          void Haptics.selectionAsync();
          router.push("/care/food-plan?review=1" as never);
        }}
      >
        <View style={styles.bannerDisc}>
          <ArrowsClockwiseIcon size={18} color={text.primary} weight="bold" />
        </View>
        <View style={styles.flex}>
          <Text style={styles.bannerTitle}>{`${live.basis.name}'s needs have changed`}</Text>
          <Text style={styles.bannerText}>{`${review.changes[0]?.text ?? "Something changed"}. Review ${live.his} Food Plan?`}</Text>
        </View>
        <ArrowRightIcon size={16} color={text.primary} weight="bold" />
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },


  banner: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.primary, marginTop: space.lg },
  bannerDisc: { width: 36, height: 36, borderRadius: 18, backgroundColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  bannerTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  bannerText: { ...type.caption, fontSize: 13, color: text.secondary, marginTop: 1 },


  stand: { flex: 1, alignItems: "center" },
  standMain: { flex: 1.3 },
  standHero: { flex: 0, width: 180, alignSelf: "center" },
  pack: { width: "100%", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 4 },
  packImage: { width: "100%", height: "100%" },
  ghost: { width: "70%", borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: border.strong, alignItems: "center", justifyContent: "center", backgroundColor: bg.subtle },
  packArt: { borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, alignItems: "center", justifyContent: "center" },
  packMain: { backgroundColor: text.primary },
  packTreat: { backgroundColor: accent.band },
  packDental: { backgroundColor: scene.sageDeep },
  packBand: { width: "100%", paddingVertical: 10, alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  packBandMain: { backgroundColor: accent.deep },
  block: {
    width: "100%",
    height: 132,
    marginTop: space.sm,
    paddingHorizontal: 6,
    paddingVertical: space.md,
    borderRadius: 14,
    backgroundColor: scene.blobSoft,
    borderTopWidth: 3,
    borderTopColor: scene.blob,
    alignItems: "center",
  },
  blockMain: { paddingHorizontal: space.sm },
  role: { ...type.caption, fontWeight: "600", color: text.primary, textAlign: "center" },
  roleMain: { fontSize: 14 },
  product: { ...type.caption, fontSize: 12, lineHeight: 15, color: text.secondary, textAlign: "center", marginTop: 3 },
  blockChip: { marginTop: "auto", paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  chipGood: { backgroundColor: scene.meadow },
  chipNote: { backgroundColor: accent.primary },
  chipBad: { backgroundColor: text.primary },
  chipText: { ...type.caption, fontSize: 11, fontWeight: "700", color: text.primary },
  chipTextBad: { color: text.inverse },

  tabs: { flexDirection: "row", height: 46, padding: TAB_PAD, marginTop: space.lg, borderRadius: radius.pill, backgroundColor: bg.subtle },
  tabPill: { position: "absolute", top: TAB_PAD, bottom: TAB_PAD, left: TAB_PAD, borderRadius: radius.pill, backgroundColor: bg.canvas, shadowColor: "#1C1B1A", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  tab: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabText: { ...type.supporting, fontWeight: "600", color: text.secondary },
  tabTextOn: { fontWeight: "600", color: text.primary },

  ideas: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  ideasMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: scene.blobSoft, alignItems: "center", justifyContent: "center" },
  ideasTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  ideasText: { ...type.caption, fontSize: 13, color: text.secondary, marginTop: 2 },
  startWithPeek: { minHeight: PEEK.height - 8, paddingRight: PEEK.width - 40 },
  startPeek: { right: -layout.gutter, top: space.lg - 18 },
  start: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.card + 4, backgroundColor: accent.primary },
  startTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  startText: { ...type.caption, fontSize: 13, color: text.secondary, marginTop: 2 },
});
