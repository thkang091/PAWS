import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Dimensions, Image, Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import Animated, {
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  ArrowRightIcon,
  BoneIcon,
  BowlFoodIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  CookieIcon,
  DropIcon,
  MoonStarsIcon,
  PawPrintIcon,
  PersonSimpleWalkIcon,
  ScalesIcon,
  SlidersHorizontalIcon,
  SunHorizonIcon,
  SunIcon,
  ToothIcon,
} from "phosphor-react-native";

import { minutesOf, periodOf, prettyTime } from "@/features/care/components/careSetupAnswers";
import { roleOf, type TreatRole } from "@/features/care/food/options";
import { BCS_WORDS, MUSCLE_LABEL, bcsBand, bcsFromBand, type MuscleCondition } from "@/features/care/intel/careIntel";
import { saveFeedingProfile, useFoodPlan } from "@/features/care/state/foodPlan";
import { enter } from "@/features/care/food/enter";
import { AskPeek, PEEK } from "@/features/care/food/AskCamera";
import type { useLivePlan } from "@/features/care/food/usePlan";
import { formatAmount, goalFrom, type Mark } from "@/features/care/food/foodPlanMath";
import type { PlanItem } from "@/features/care/state/foodPlan";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import { accent, bg, border, icon as iconSize, layout, motion, pastel, radius, scene, space, text, type } from "@/constants/design";

type Live = ReturnType<typeof useLivePlan>;
type Focus = "meals" | "treats";

/** One colour per side of the day, used by the ring, the split, the lineup and the routine alike. */
const MEALS = accent.band;
const TREATS = scene.sageDeep;
const TREAT_TINT = "rgba(101,122,89,0.13)";
const MARK_DOT: Record<Mark, string> = { good: scene.sageDeep, note: accent.band, bad: text.primary };
const FIT: Record<Mark, string> = { good: "Good fit", note: "Mostly fits", bad: "Not a fit" };

const go = (href: string) => {
  void Haptics.selectionAsync();
  router.push(href as never);
};
const treatHref = (item: PlanItem) => `/care/food-item?id=${encodeURIComponent(item.product.id)}&role=${roleOf(item)}`;
const markOf = (live: Live, item: PlanItem) => live.result?.treats.find((t) => t.item.product.id === item.product.id)?.verdict.mark ?? null;
const countOf = (live: Live, item: PlanItem) => live.result?.treats.find((t) => t.item.product.id === item.product.id)?.share?.count ?? null;

/** Food plan tab: the day's calories and the lineup. Picking Meals or Treats lights that side up in both. */
export const PlanTab = ({ live }: { live: Live }) => {
  const [focus, setFocus] = useState<Focus | null>(null);
  const { plan, result } = live;
  if (!plan || !result) return null;

  const toggle = (next: Focus) => {
    void Haptics.selectionAsync();
    setFocus((current) => (current === next ? null : next));
  };

  return (
    <>
      <CalorieCard live={live} focus={focus} onToggle={toggle} />
      <Lineup
        food={plan.food}
        foodMark={result.food?.mark ?? null}
        treats={pickLineup(plan.treats).map((item) => ({ item, mark: markOf(live, item) }))}
        focus={focus}
      />
    </>
  );
};

/** Overview tab: when each feeding happens, and why the plan is what it is. */
export const OverviewTab = ({ live }: { live: Live }) =>
  live.plan && live.result ? (
    <>
      <DailyPlan live={live} />
      <Routine live={live} focus={null} />
    </>
  ) : null;

/** A training treat and a dental chew sit beside the main food when there are both; otherwise the first two treats. */
const pickLineup = (treats: readonly PlanItem[]) => {
  const training = treats.find((t) => roleOf(t) === "training");
  const dental = treats.find((t) => roleOf(t) === "dental");
  const picked = [training, dental].filter((t): t is PlanItem => Boolean(t));
  for (const t of treats) if (picked.length < 2 && !picked.includes(t)) picked.push(t);
  return picked;
};

/** Steps back whatever is not part of the picked side. */
const Dim = ({ dim, style, children }: { dim: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) => {
  const reduceMotion = useReducedMotion();
  const v = useSharedValue(dim ? 1 : 0);
  useEffect(() => {
    v.value = reduceMotion ? (dim ? 1 : 0) : withTiming(dim ? 1 : 0, { duration: motion.duration.select, easing: motion.easing.out });
  }, [dim, reduceMotion, v]);
  const fade = useAnimatedStyle(() => ({ opacity: 1 - v.value * 0.65 }));
  return <Animated.View style={[style, fade]}>{children}</Animated.View>;
};

/** Counts up to a number the first time it shows, and glides between values after that. */
const useCountUp = (target: number) => {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : 0);
  const from = useRef(reduceMotion ? target : 0);
  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      from.current = target;
      return;
    }
    const start = Date.now();
    const a = from.current;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 760);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(a + (target - a) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion, target]);
  return value;
};

const rise = (reduceMotion: boolean, order: number) =>
  reduceMotion ? undefined : enter({ y: 12 }, { delay: order * 70 });

// ---------- Daily Calories ----------

const CalorieCard = ({ live, focus, onToggle }: { live: Live; focus: Focus | null; onToggle: (f: Focus) => void }) => {
  const { result, basis } = live;
  const energy = result?.energy ?? null;
  const name = basis.name;
  const shown = useCountUp(energy?.kcal ?? 0);

  if (!energy) {
    return (
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`Add ${name}'s weight to work out daily calories`}
        scaleTo={0.98}
        style={[styles.card, styles.missing]}
        onPress={() => go("/care/food-plan?edit=profile")}
      >
        <View style={styles.flex}>
          <Text style={styles.missingTitle}>{`Add ${name}'s weight`}</Text>
          <Text style={styles.missingText}>PAWS needs it to work out daily calories and portions.</Text>
        </View>
        <ArrowRightIcon size={16} color={text.primary} weight="bold" />
      </PressScale>
    );
  }

  const pct = (kcal: number) => Math.round((kcal / energy.kcal) * 100);
  return (
    <>
      <Text style={styles.sectionTitle}>Daily calories</Text>
      <Text style={styles.lede}>{`Recommended for ${name}.`}</Text>
      <View style={styles.hero}>
        <View style={styles.calories}>
          <View style={styles.flex}>
            <Text style={styles.total} accessibilityLabel={`${energy.kcal} kilocalories a day`}>
              {shown.toLocaleString()}
            </Text>
            <Text style={styles.totalUnit}>kcal a day</Text>
          </View>
          <Ring mainKcal={energy.mainKcal} treatKcal={energy.treatKcal} focus={focus} onToggle={onToggle} />
        </View>

        <View style={styles.split} accessibilityRole="tablist">
          <SplitTile tint={MEALS} label="Meals" kcal={energy.mainKcal} pct={pct(energy.mainKcal)} on={focus === "meals"} onPress={() => onToggle("meals")} />
          <View style={styles.splitRule} />
          <SplitTile tint={TREATS} label="Treats" kcal={energy.treatKcal} pct={pct(energy.treatKcal)} on={focus === "treats"} onPress={() => onToggle("treats")} />
        </View>
      </View>
    </>
  );
};

const SIZE = 148;
const STROKE = 16;
const R = (SIZE - STROKE - 8) / 2;
const C = 2 * Math.PI * R;
const GAP = STROKE + 6;

const Ring = ({ mainKcal, treatKcal, focus, onToggle }: { mainKcal: number; treatKcal: number; focus: Focus | null; onToggle: (f: Focus) => void }) => {
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) sweep.value = withDelay(120, withTiming(1, { duration: 760, easing: motion.easing.out }));
  }, [reduceMotion, sweep]);

  const mealsLen = (mainKcal / (mainKcal + treatKcal)) * C;
  const showing: Focus = focus ?? "meals";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mainKcal} kilocalories for meals and ${treatKcal} for treats. Tap to switch.`}
      onPress={() => onToggle(showing === "meals" ? "treats" : "meals")}
      style={styles.ring}
    >
      <Svg width={SIZE} height={SIZE}>
        <G transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <Arc start={GAP / 2} len={mealsLen - GAP} tint={MEALS} state={focus == null ? 0 : focus === "meals" ? 1 : -1} sweep={sweep} />
          <Arc start={mealsLen + GAP / 2} len={C - mealsLen - GAP} tint={TREATS} state={focus == null ? 0 : focus === "treats" ? 1 : -1} sweep={sweep} />
        </G>
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Animated.Text
          key={showing}
          entering={reduceMotion ? undefined : enter({ scale: 0.9 }, { duration: 200 })}
          style={styles.ringValue}
        >
          {showing === "meals" ? mainKcal : treatKcal}
        </Animated.Text>
        <Text style={styles.ringLabel}>{`kcal ${showing}`}</Text>
      </View>
    </Pressable>
  );
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** state: 1 picked (thicker), 0 resting, -1 stepped back. */
const Arc = ({ start, len, tint, state, sweep }: { start: number; len: number; tint: string; state: -1 | 0 | 1; sweep: SharedValue<number> }) => {
  const reduceMotion = useReducedMotion();
  const s = useSharedValue(state);
  useEffect(() => {
    s.value = reduceMotion ? state : withTiming(state, { duration: motion.duration.select, easing: motion.easing.out });
  }, [reduceMotion, s, state]);
  const props = useAnimatedProps(() => {
    const drawn = Math.max(0, Math.min(len, sweep.value * C - start));
    return {
      strokeDasharray: [drawn, C],
      strokeDashoffset: -start,
      strokeWidth: STROKE + Math.max(0, s.value) * 5,
      strokeOpacity: drawn < 0.5 ? 0 : 1 - Math.max(0, -s.value) * 0.7,
    };
  });
  return <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={tint} strokeLinecap="round" fill="none" animatedProps={props} />;
};

const SplitTile = ({ tint, label, kcal, pct, on, onPress }: { tint: string; label: string; kcal: number; pct: number; on: boolean; onPress: () => void }) => (
  <PressScale
    accessibilityRole="tab"
    accessibilityState={{ selected: on }}
    accessibilityLabel={`${label}, ${kcal} kilocalories, ${pct} percent of the day`}
    scaleTo={0.97}
    style={[styles.splitTile, on && styles.splitTileOn]}
    onPress={onPress}
  >
    <View style={[styles.splitDot, { backgroundColor: tint }]} />
    <View>
      <Text style={styles.splitLabel}>{label}</Text>
      <Text style={styles.splitValue}>
        {`${kcal} kcal`}
        <Text style={styles.splitPct}>{`  ${pct}%`}</Text>
      </Text>
    </View>
  </PressScale>
);

// ---------- The lineup: three products side by side on one wall, like an exhibit ----------

const ROLE_NAME: Record<"main" | TreatRole, string> = {
  main: "Main food",
  training: "Training treat",
  dental: "Dental chew",
  topper: "Topper",
  snack: "Treat",
};

/** The pack at its own proportions, standing on the bottom edge of its space. */
const Photo = ({ item, kind }: { item: PlanItem | null; kind: "main" | TreatRole }) => {
  const [aspect, setAspect] = useState<number | null>(null);
  if (item?.product.imageUrl)
    return (
      <Image
        source={{ uri: item.product.imageUrl }}
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source;
          if (width && height) setAspect(width / height);
        }}
        style={[styles.photo, { aspectRatio: aspect ?? 0.72 }]}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    );
  if (item)
    return (
      <View style={[styles.photoArt, { backgroundColor: kind === "main" ? accent.soft : scene.blobSoft }]}>
        {kind === "main" ? <BowlFoodIcon size={34} color={MEALS} weight="fill" /> : <CookieIcon size={30} color={TREATS} weight="fill" />}
      </View>
    );
  return <PackGhost kind={kind} />;
};

/**
 * An empty spot on the shelf: the outline of the pack that belongs there (a kibble bag, a treat pouch, a chew box),
 * drawn in the page's quiet grey with a dashed edge, and a small plus on its label. The main food stands tallest.
 */
const PackGhost = ({ kind }: { kind: "main" | TreatRole }) => {
  const shape = kind === "main" ? "bag" : kind === "dental" ? "box" : "pouch";
  const stroke = { stroke: border.strong, strokeWidth: 1.5, strokeDasharray: "4 4", fill: bg.subtle };
  const plus = (cx: number, cy: number) => (
    <G>
      <Circle cx={cx} cy={cy} r={13} fill={bg.canvas} />
      <Path d={`M${cx - 5} ${cy}h10M${cx} ${cy - 5}v10`} stroke={text.tertiary} strokeWidth={2} strokeLinecap="round" />
    </G>
  );
  if (shape === "bag")
    return (
      <Svg width={92} height={132} viewBox="0 0 92 132" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Path d="M10 20h72l6 102a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8z" {...stroke} />
        <Rect x={8} y={4} width={76} height={16} rx={4} {...stroke} />
        <Path d="M16 12h60" stroke={border.default} strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" />
        <Rect x={20} y={50} width={52} height={46} rx={10} fill={bg.canvas} opacity={0.7} />
        {plus(46, 73)}
      </Svg>
    );
  if (shape === "pouch")
    return (
      <Svg width={76} height={104} viewBox="0 0 76 104" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Path d="M8 6h60a2 2 0 0 1 2 2v82a12 12 0 0 1-12 12H18A12 12 0 0 1 6 90V8a2 2 0 0 1 2-2z" {...stroke} />
        <Path d="M6 22h64" stroke={border.default} strokeWidth={1.5} strokeLinecap="round" />
        {plus(38, 62)}
      </Svg>
    );
  return (
    <Svg width={72} height={90} viewBox="0 0 72 90" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M4 14L14 4h44l10 10z" {...stroke} />
      <Rect x={4} y={14} width={64} height={72} rx={6} {...stroke} />
      <Rect x={6} y={34} width={60} height={22} fill={bg.canvas} opacity={0.7} />
      {plus(36, 45)}
    </Svg>
  );
};

export const Lineup = ({
  food,
  foodMark,
  treats,
  focus,
}: {
  food: PlanItem | null;
  foodMark: Mark | null;
  treats: readonly { item: PlanItem; mark: Mark | null }[];
  focus: Focus | null;
}) => {
  const pieces = [
    { key: "main", kind: "main" as const, item: food, mark: foodMark, group: "meals" as Focus, href: food ? "/care/food-item?id=main" : "/care/food-plan" },
    ...[0, 1].map((i) => {
      const entry = treats[i];
      const kind: TreatRole = entry ? roleOf(entry.item) : i === 0 ? "training" : "dental";
      return {
        key: entry?.item.product.id ?? `empty-${i}`,
        kind,
        item: entry?.item ?? null,
        mark: entry?.mark ?? null,
        group: "treats" as Focus,
        href: entry ? treatHref(entry.item) : food ? `/care/food-change?slot=new&role=${kind}` : "/care/food-plan",
      };
    }),
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>On the menu</Text>
      <Text style={styles.lede}>What is in the bowl now.</Text>
      <View style={styles.exhibits}>
        {pieces.map((p, i) => (
          <Exhibit key={p.key} order={i} kind={p.kind} item={p.item} mark={p.mark} dim={focus != null && focus !== p.group} href={p.href} />
        ))}
      </View>
    </View>
  );
};

const Exhibit = ({ order, kind, item, mark, dim, href }: { order: number; kind: "main" | TreatRole; item: PlanItem | null; mark: Mark | null; dim: boolean; href: string }) => {
  const reduceMotion = useReducedMotion();
  return (
    <Dim dim={dim} style={styles.flex}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${ROLE_NAME[kind]}. ${item ? item.product.name : "Empty, add one"}${mark ? `. ${FIT[mark]}` : ""}`}
        scaleTo={0.96}
        style={styles.exhibit}
        onPress={() => go(href)}
      >
        <Animated.View
          entering={reduceMotion ? undefined : enter({ y: -16 }, { delay: 120 + order * 90, duration: motion.duration.flourish })}
          style={styles.stage}
        >
          <Photo item={item} kind={kind} />
        </Animated.View>
        <Animated.View entering={rise(reduceMotion, 3 + order)} style={styles.placard}>
          <Text style={styles.role} numberOfLines={1}>
            {ROLE_NAME[kind]}
          </Text>
          <Text style={styles.exhibitName} numberOfLines={3}>
            {item ? item.product.name : `Add a ${ROLE_NAME[kind].toLowerCase()}`}
          </Text>
          {mark ? (
            <View style={styles.fitLine}>
              <View style={[styles.fitDot, { backgroundColor: MARK_DOT[mark] }]} />
              <Text style={styles.fitText} numberOfLines={1}>
                {FIT[mark]}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </PressScale>
    </Dim>
  );
};

// ---------- Feeding Routine: the day as a ribbon, then each feeding in order ----------

type IconKind = "breakfast" | "lunch" | "dinner" | TreatRole;

type Stop = {
  key: string;
  icon: IconKind;
  minutes: number | null;
  when: string;
  title: string;
  product: string;
  amount: string;
  group: Focus;
  href: string;
};

const MEAL_NAME = { morning: "Breakfast", midday: "Lunch", evening: "Dinner" } as const;
const DAY_START = 6 * 60;
const DAY_END = 24 * 60;

const clock = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

const stopsFor = (live: Live): Stop[] => {
  const { plan, result, mealTimes } = live;
  if (!plan || !result) return [];
  const meals: Stop[] = mealTimes.map((time, i) => ({
    key: `meal-${time}-${i}`,
    icon: (periodOf(time) === "morning" ? "breakfast" : periodOf(time) === "midday" ? "lunch" : "dinner") as IconKind,
    minutes: minutesOf(time),
    when: prettyTime(time),
    title: MEAL_NAME[periodOf(time) as keyof typeof MEAL_NAME] ?? "Meal",
    product: plan.food.product.name,
    amount: result.perMeal != null ? formatAmount(result.perMeal, plan.unit) : result.amount != null ? formatAmount(result.amount, plan.unit) : "",
    group: "meals",
    href: "/care/food-item?id=main",
  }));
  const lastMeal = meals.length ? (meals[meals.length - 1].minutes ?? 18 * 60) : 18 * 60;
  const bedtime = Math.min(lastMeal + 120, 22 * 60 + 30);

  const treats: Stop[] = plan.treats.map((item) => {
    const role = roleOf(item);
    const count = countOf(live, item);
    const base = { key: item.product.id, icon: role as IconKind, product: item.product.name, group: "treats" as const, href: treatHref(item) };
    if (role === "dental")
      return { ...base, minutes: bedtime, when: prettyTime(clock(bedtime)), title: "Dental chew", amount: count === 0 ? "Every other day" : `${count ?? 1} a day` };
    if (role === "topper") return { ...base, minutes: null, when: "Meals", title: "Topper", amount: count ? `${count} a day` : "A little" };
    return { ...base, minutes: null, when: "All day", title: role === "training" ? "Training treats" : "Treats", amount: count ? `Up to ${count}` : "As needed" };
  });

  const timed = [...meals, ...treats.filter((t) => t.minutes != null)].sort((a, b) => (a.minutes ?? 0) - (b.minutes ?? 0));
  const allDay = treats.filter((t) => t.minutes == null);
  return [...timed.slice(0, 1), ...allDay, ...timed.slice(1)];
};

const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
};

/**
 * One family of marks for the day: a rounded tile, a duotone glyph, amber for meals and sage for treats.
 * Each settles in with a small turn; the next feeding's mark gives one nudge so the eye finds it.
 */
const ICONS: Record<IconKind, { Glyph: typeof SunIcon; tint: string; ink: string }> = {
  breakfast: { Glyph: SunHorizonIcon, tint: accent.soft, ink: MEALS },
  lunch: { Glyph: SunIcon, tint: accent.soft, ink: MEALS },
  dinner: { Glyph: MoonStarsIcon, tint: accent.soft, ink: MEALS },
  training: { Glyph: BoneIcon, tint: TREAT_TINT, ink: TREATS },
  dental: { Glyph: ToothIcon, tint: TREAT_TINT, ink: TREATS },
  topper: { Glyph: DropIcon, tint: TREAT_TINT, ink: TREATS },
  snack: { Glyph: CookieIcon, tint: TREAT_TINT, ink: TREATS },
};

/** Health's row mark: a round disc with a plain glyph. The next feeding's disc is butter and nudges once. */
const FeedIcon = ({ kind, order, next }: { kind: IconKind; order: number; next: boolean }) => {
  const reduceMotion = useReducedMotion();
  const nudge = useSharedValue(1);
  useEffect(() => {
    if (!next || reduceMotion) return;
    nudge.value = withDelay(
      700 + order * 70,
      withSequence(withTiming(1.12, { duration: 160, easing: motion.easing.out }), withSpring(1, { duration: 420, dampingRatio: 0.55 })),
    );
  }, [next, nudge, order, reduceMotion]);
  const bump = useAnimatedStyle(() => ({ transform: [{ scale: nudge.value }] }));
  const { Glyph } = ICONS[kind];
  return (
    <Animated.View entering={reduceMotion ? undefined : enter({ scale: 0.8, rotate: -14 }, { delay: 200 + order * 60, duration: 380 })}>
      <Animated.View style={[styles.disc, next && styles.discOn, bump]}>
        <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
      </Animated.View>
    </Animated.View>
  );
};

const Routine = ({ live, focus }: { live: Live; focus: Focus | null }) => {
  const reduceMotion = useReducedMotion();
  const now = useNow();
  const stops = useMemo(() => stopsFor(live), [live]);
  if (!stops.length) return null;

  const timed = stops.filter((s) => s.minutes != null);
  const next = timed.find((s) => (s.minutes ?? 0) > now) ?? null;
  const tomorrow = next ? null : (timed[0] ?? null);
  const nextKey = (next ?? tomorrow)?.key;

  return (
    <View>
      <Text style={styles.sectionTitle}>Feeding routine</Text>
      <Text style={styles.lede}>
        {next ? `Next is ${next.title.toLowerCase()} at ${next.when}.` : tomorrow ? `Next is ${tomorrow.title.toLowerCase()} tomorrow at ${tomorrow.when}.` : "Treats through the day."}
      </Text>

      <View style={styles.list}>
        <View style={styles.ribbonWrap}>
          <DayRibbon stops={stops} now={now} focus={focus} hasDaytimeTreats={stops.some((s) => s.minutes == null && s.group === "treats")} />
        </View>
        {stops.map((stop, i) => {
          const isNext = stop.key === nextKey;
          return (
            <Dim key={stop.key} dim={focus != null && focus !== stop.group}>
              <Animated.View entering={rise(reduceMotion, 2 + i)}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`${stop.title}, ${stop.when}. ${stop.amount}${isNext ? ". Next" : ""}`}
                  scaleTo={0.98}
                  style={[styles.listRow, styles.ruled]}
                  onPress={() => go(stop.href)}
                >
                  <FeedIcon kind={stop.icon} order={i} next={isNext} />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{stop.title}</Text>
                    <View style={styles.statusRow}>
                      {isNext ? <View style={styles.flag} /> : null}
                      <Text style={[styles.status, isNext && styles.statusOn]} numberOfLines={1}>
                        {`${isNext ? "Next, " : ""}${stop.when}  ·  ${stop.amount}`}
                      </Text>
                    </View>
                  </View>
                  <CaretRightIcon size={iconSize.inline} color={border.strong} weight="bold" />
                </PressScale>
              </Animated.View>
            </Dim>
          );
        })}
      </View>
    </View>
  );
};

const AXIS = [
  { at: 6 * 60, label: "6 am" },
  { at: 12 * 60, label: "Noon" },
  { at: 18 * 60, label: "6 pm" },
  { at: 24 * 60, label: "Midnight" },
];

/** Ribbon marks share the routine's icons, solid so they read on the thin track. */
const MARK = 30;

const DayRibbon = ({ stops, now, focus, hasDaytimeTreats }: { stops: readonly Stop[]; now: number; focus: Focus | null; hasDaytimeTreats: boolean }) => {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const fill = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion && width) fill.value = withDelay(200, withTiming(1, { duration: 700, easing: motion.easing.out }));
  }, [fill, reduceMotion, width]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));

  const x = (m: number) => ((Math.min(DAY_END, Math.max(DAY_START, m)) - DAY_START) / (DAY_END - DAY_START)) * width;
  const meals = stops.filter((s) => s.group === "meals" && s.minutes != null);
  const first = meals[0]?.minutes ?? 8 * 60;
  const last = stops.reduce((m, s) => Math.max(m, s.minutes ?? 0), first);
  const nowX = x(now);
  const inDay = now >= DAY_START;

  return (
    <View style={styles.ribbon} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {width ? (
        <>
          <View style={styles.track} />
          {hasDaytimeTreats ? (
            <Dim dim={focus === "meals"} style={[styles.window, { left: x(first), width: Math.max(0, x(last) - x(first)) }]}>
              <View style={styles.windowFill} />
            </Dim>
          ) : null}
          {inDay ? <Animated.View style={[styles.elapsed, { width: nowX }, grow]} /> : null}
          {stops.map((s, i) =>
            s.minutes == null ? null : (
              <Dim key={s.key} dim={focus != null && focus !== s.group} style={[styles.markerWrap, { left: x(s.minutes) - MARK / 2 }]}>
                <Animated.View
                  entering={reduceMotion ? undefined : enter({ scale: 0.6, rotate: -20 }, { delay: 380 + i * 90, duration: 360 })}
                  style={[styles.marker, { backgroundColor: ICONS[s.icon].ink }]}
                >
                  {(() => {
                    const Glyph = ICONS[s.icon].Glyph;
                    return <Glyph size={15} color={bg.canvas} weight="fill" />;
                  })()}
                </Animated.View>
              </Dim>
            ),
          )}
          {inDay ? (
            <View style={[styles.now, { left: nowX - 1 }]}>
              <View style={styles.nowLine} />
            </View>
          ) : null}
          {inDay ? <Text style={[styles.nowLabel, { left: Math.min(width - 32, Math.max(0, nowX - 16)) }]}>Now</Text> : null}
          {AXIS.map((a, i) => (
            <Text
              key={a.label}
              style={[styles.axis, i === 0 ? { left: 0 } : i === AXIS.length - 1 ? { right: 0 } : { left: x(a.at) - 24, width: 48, textAlign: "center" }]}
            >
              {a.label}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
};

// ---------- Daily Plan: the goal, where the dog is, and what PAWS recommends for the day ----------

const GOAL_TITLE = { maintain: "Maintain weight", lose: "Lose weight", gain: "Gain weight" } as const;

const useWeightTrend = () => {
  const dog = useCurrentDog();
  const logs = useWeightLogs(dog.data?.id);
  return useMemo(() => {
    const kg = (l: { weightValue: number; weightUnit: string }) => (l.weightUnit === "kg" ? l.weightValue : l.weightValue * 0.4536);
    const list = logs.data ?? [];
    const latest = list[0];
    if (!latest) return null;
    const at = new Date(latest.recordedAt).getTime();
    const past = list.find((l) => at - new Date(l.recordedAt).getTime() >= 21 * 86_400_000);
    if (!past) return null;
    return { delta: Math.round((kg(latest) - kg(past)) * 10) / 10, days: Math.round((at - new Date(past.recordedAt).getTime()) / 86_400_000) };
  }, [logs.data]);
};

const DailyPlan = ({ live }: { live: Live }) => {
  const { plan, result, basis, weighedDaysAgo, walking } = live;
  const reduceMotion = useReducedMotion();
  const trend = useWeightTrend();
  const store = useFoodPlan();
  if (!plan || !result) return null;
  const energy = result.energy;
  const name = basis.name;
  const puppy = basis.stage === "puppy";
  const goal = puppy ? "maintain" : (basis.goal ?? "maintain");
  const suggested = puppy || !basis.bodyCondition ? null : goalFrom(basis.bodyCondition);
  const kg = basis.weightKg;

  // How the weight is moving against the goal, once there are two weigh-ins a few weeks apart.
  const trendLine: { mark: Mark; text: string } | null = (() => {
    if (!trend || kg == null) return null;
    const d = trend.delta;
    const span = `${d > 0 ? "+" : ""}${d} kg in ${trend.days} days`;
    if (goal === "maintain") return Math.abs(d) <= kg * 0.02 ? { mark: "good", text: `Holding steady, ${span}` } : { mark: "note", text: `${d > 0 ? "Gaining" : "Losing"}, ${span}` };
    if (goal === "lose") return d < 0 ? { mark: "good", text: `On track, ${span}` } : { mark: "note", text: `Not dropping yet, ${span}` };
    return d > 0 ? { mark: "good", text: `On track, ${span}` } : { mark: "note", text: `Not gaining yet, ${span}` };
  })();

  const every = puppy ? 7 : goal === "maintain" ? 28 : 14;
  const dueIn = weighedDaysAgo == null ? null : every - weighedDaysAgo;
  const recs: Rec[] = [
    {
      key: "food",
      Glyph: BowlFoodIcon,
      tint: accent.soft,
      ink: MEALS,
      label: "Food",
      value: result.amount != null ? `${formatAmount(result.amount, plan.unit)} a day` : "Add calories to the food",
      sub: result.perMeal != null ? `${formatAmount(result.perMeal, plan.unit)} per meal` : plan.food.product.name,
      href: "/care/food-item?id=main",
    },
    {
      key: "treats",
      Glyph: BoneIcon,
      tint: TREAT_TINT,
      ink: TREATS,
      label: "Treats",
      value: energy ? `Up to ${energy.treatKcal} kcal a day` : "Add a weight first",
      sub: "10% of daily calories",
      href: plan.treats[0] ? treatHref(plan.treats[0]) : "/care/food-change?slot=new",
    },
    {
      // Walking sets the activity level, and the activity level sets the calories: a busier week feeds a little more.
      key: "activity",
      Glyph: PersonSimpleWalkIcon,
      tint: pastel.mint,
      ink: scene.sageDeep,
      label: "Activity",
      value: walking ? `${walking.minutesPerDay} min of walking a day` : basis.activity ? `${ACTIVITY_WORD[basis.activity]} activity` : "Walk to set this",
      sub: walking ? `${ACTIVITY_WORD[walking.level]} this week, sets the calories` : "Set by walks after 3 days",
      href: "/care/exercise",
    },
    {
      key: "weigh",
      Glyph: ScalesIcon,
      tint: scene.blobSoft,
      ink: scene.tan,
      label: "Weigh-in",
      value: puppy ? "Every week" : goal === "maintain" ? "Every 4 weeks" : "Every 2 weeks",
      sub: dueIn == null ? "Add a weigh-in to start" : dueIn <= 0 ? "Due today" : `Next in ${dueIn} ${dueIn === 1 ? "day" : "days"}`,
      href: "/care/food-plan?edit=profile",
    },
  ];

  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, styles.flush, styles.flex]}>Daily plan</Text>
        <EditPlan name={name} />
      </View>
      <Text style={styles.lede}>{`What ${name} eats each day, and why.`}</Text>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.headline}>{GOAL_TITLE[goal]}</Text>
          <Text style={styles.heroSub}>
            {kg == null
              ? "Add a weigh-in"
              : `${kg} kg${weighedDaysAgo == null ? "" : weighedDaysAgo === 0 ? ", weighed today" : `, weighed ${weighedDaysAgo} ${weighedDaysAgo === 1 ? "day" : "days"} ago`}`}
          </Text>
          {suggested && suggested !== goal ? (
            <PressScale accessibilityRole="button" accessibilityLabel={`PAWS suggests ${GOAL_TITLE[suggested]}. Change goal`} scaleTo={0.97} hitSlop={8} style={styles.recLine} onPress={() => go("/care/food-prefs")}>
              <View style={styles.flag} />
              <Text style={styles.recText}>
                {`PAWS suggests ${GOAL_TITLE[suggested].toLowerCase()}. `}
                <Text style={styles.recLink}>Change</Text>
              </Text>
            </PressScale>
          ) : suggested ? (
            <View style={styles.recLine}>
              <CheckIcon size={13} color={scene.sageDeep} weight="bold" />
              <Text style={[styles.recText, styles.recAgree]}>Recommended by PAWS</Text>
            </View>
          ) : null}
          {/* The food check peeks in from the screen edge, beside the goal, like the walk dog on Activity. */}
          <AskPeek name={name} style={styles.peek} />
        </View>

        <BodyHealth
          bcs={store.profile.bcs ?? bcsFromBand(basis.bodyCondition)}
          mcs={store.profile.mcs ?? null}
          onSave={(bcs, mcs) => saveFeedingProfile({ ...store.profile, bcs, mcs, bodyCondition: bcsBand(bcs) })}
        />
        {trendLine ? (
          <View style={styles.trend}>
            <View style={[styles.statusDot, { backgroundColor: MARK_DOT[trendLine.mark] }]} />
            <Text style={styles.trendText}>{trendLine.text}</Text>
          </View>
        ) : null}

        <View style={styles.heroList}>
          {recs.map((r, i) => (
            <Animated.View key={r.key} entering={rise(reduceMotion, 2 + i)}>
              <PressScale accessibilityRole="button" accessibilityLabel={`${r.label}. ${r.value}. ${r.sub}`} scaleTo={0.98} style={[styles.heroRow, i > 0 && styles.ruled]} onPress={() => go(r.href)}>
                <View style={styles.discSmall}>
                  <r.Glyph size={iconSize.standard} color={text.primary} weight="regular" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{r.value}</Text>
                  <Text style={styles.status} numberOfLines={1}>{`${r.label}  ·  ${r.sub}`}</Text>
                </View>
                <CaretRightIcon size={iconSize.inline} color={border.strong} weight="bold" />
              </PressScale>
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
};

const ACTIVITY_WORD = { low: "Light", moderate: "Moderate", high: "High" } as const;

type Rec = { key: string; Glyph: typeof SunIcon; tint: string; ink: string; label: string; value: string; sub: string; href: string };

/**
 * Body health: the 9-point body condition score with the healthy 4 to 5 band shaded, and muscle condition. Tap to
 * score it; the food maths follows the band (3 or less thin, 6 or more heavy).
 */
const BodyHealth = ({ bcs, mcs, onSave }: { bcs: number | null; mcs: MuscleCondition | null; onSave: (bcs: number, mcs: MuscleCondition) => void }) => {
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draftBcs, setDraftBcs] = useState(bcs ?? 5);
  const [draftMcs, setDraftMcs] = useState<MuscleCondition>(mcs ?? "normal");
  const shown = editing ? draftBcs : bcs;

  const toggle = () => {
    void Haptics.selectionAsync();
    if (editing) {
      onSave(draftBcs, draftMcs);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setDraftBcs(bcs ?? 5);
      setDraftMcs(mcs ?? "normal");
    }
    setEditing((v) => !v);
  };

  return (
    <View style={styles.body}>
      <View style={styles.bodyHead}>
        <Text style={styles.bodyLabel}>Body condition</Text>
        <Text style={styles.bodyValue}>{shown ? `${shown}/9 · ${BCS_WORDS[shown]}` : "Not scored"}</Text>
        <PressScale accessibilityRole="button" accessibilityLabel={editing ? "Save body condition" : "Score body condition"} hitSlop={8} scaleTo={0.94} onPress={toggle}>
          <Text style={styles.bodyEdit}>{editing ? "Done" : "Score"}</Text>
        </PressScale>
      </View>
      <View style={styles.bcs} accessibilityRole="adjustable" accessibilityLabel={`Body condition ${shown ?? "not scored"} of 9`}>
        {Array.from({ length: 9 }, (_, i) => {
          const n = i + 1;
          const on = n === shown;
          return (
            <PressScale
              key={n}
              disabled={!editing}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${n} of 9, ${BCS_WORDS[n]}`}
              scaleTo={0.9}
              style={[styles.bcsCell, (n === 4 || n === 5) && styles.bcsIdeal]}
              onPress={() => {
                void Haptics.selectionAsync();
                setDraftBcs(n);
              }}
            >
              {on ? <Animated.View key={`m-${n}`} entering={reduceMotion ? undefined : enter({ scale: 0.6 }, { duration: 220 })} style={styles.bcsMark} /> : null}
              {editing ? <Text style={[styles.bcsNum, on && styles.bcsNumOn]}>{n}</Text> : null}
            </PressScale>
          );
        })}
      </View>
      <View style={styles.bodyHead}>
        <Text style={styles.bodyLabel}>Muscle</Text>
        <Text style={styles.bodyValue}>{MUSCLE_LABEL[editing ? draftMcs : (mcs ?? "normal")]}</Text>
      </View>
      {editing ? (
        <Animated.View entering={reduceMotion ? undefined : enter({ y: 6 }, { duration: motion.duration.enter })} style={styles.mcs}>
          {(Object.keys(MUSCLE_LABEL) as MuscleCondition[]).map((key) => {
            const on = key === draftMcs;
            return (
              <PressScale
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={MUSCLE_LABEL[key]}
                scaleTo={0.95}
                style={[styles.mcsChip, on && styles.mcsChipOn]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setDraftMcs(key);
                }}
              >
                <Text style={[styles.mcsText, on && styles.mcsTextOn]}>{MUSCLE_LABEL[key]}</Text>
              </PressScale>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
};

// ---------- Edit plan: a small menu that grows out of its button ----------

const EditPlan = ({ name }: { name: string }) => {
  const reduceMotion = useReducedMotion();
  const anchorRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const open = () => {
    void Haptics.selectionAsync();
    anchorRef.current?.measureInWindow((x, y, w, h) => setAnchor({ top: y + h + 8, right: Dimensions.get("window").width - (x + w) }));
  };
  const close = () => setAnchor(null);

  const items = [
    { key: "food", Glyph: BowlFoodIcon, label: "Change main food", href: "/care/food-change?slot=main" },
    { key: "treat", Glyph: CookieIcon, label: "Add a treat or chew", href: "/care/food-change?slot=new" },
    { key: "prefs", Glyph: SlidersHorizontalIcon, label: "Food Preferences", href: "/care/food-prefs" },
    { key: "dog", Glyph: PawPrintIcon, label: `Update ${name}'s details`, href: "/care/food-plan?edit=profile" },
  ];
  const height = Dimensions.get("window").height;
  const flip = anchor != null && anchor.top > height - 260;

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <PressScale accessibilityRole="button" accessibilityLabel="Edit plan" accessibilityState={{ expanded: anchor != null }} scaleTo={0.94} hitSlop={10} style={styles.edit} onPress={open}>
          <Text style={styles.editText}>Edit</Text>
          <CaretDownIcon size={12} color={text.primary} weight="bold" />
        </PressScale>
      </View>

      <Modal transparent visible={anchor != null} animationType="none" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close menu">
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={[StyleSheet.absoluteFill, styles.scrim]} />
        </Pressable>
        {anchor ? (
          <Animated.View
            entering={reduceMotion ? undefined : enter({ scale: 0.94 }, { duration: 200 })}
            style={[styles.menu, flip ? { bottom: height - anchor.top + 56, right: anchor.right, transformOrigin: "bottom right" } : { top: anchor.top, right: anchor.right }]}
            accessibilityRole="menu"
          >
            {items.map((item, i) => (
              <PressScale
                key={item.key}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                scaleTo={0.98}
                style={[styles.menuItem, i > 0 && styles.menuRule]}
                onPress={() => {
                  close();
                  router.push(item.href as never);
                }}
              >
                <item.Glyph size={18} color={text.primary} weight="bold" />
                <Text style={styles.menuText}>{item.label}</Text>
              </PressScale>
            ))}
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: space.md, padding: space.lg, borderRadius: radius.card + 6, backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.soft },
  cardTitle: { ...type.sectionTitle, color: text.primary },

  calories: { flexDirection: "row", alignItems: "center" },
  total: { fontSize: 56, lineHeight: 60, letterSpacing: -2.2, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  totalUnit: { ...type.supporting, color: text.secondary, marginTop: -2 },
  ring: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center", marginRight: -space.xs },
  ringCenter: { position: "absolute", alignItems: "center" },
  ringValue: { ...type.sectionTitle, fontSize: 24, lineHeight: 28, color: text.primary, fontVariant: ["tabular-nums"] },
  ringLabel: { ...type.caption, color: text.secondary },

  missing: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg },
  missingTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  missingText: { ...type.caption, color: text.secondary, marginTop: 1 },

  split: { flexDirection: "row", alignItems: "stretch", marginTop: space.lg, borderRadius: radius.card, backgroundColor: bg.canvas, overflow: "hidden" },
  splitRule: { width: 1, marginVertical: space.md, backgroundColor: border.soft },
  splitTile: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg },
  splitTileOn: { backgroundColor: accent.primary },
  splitDot: { width: 14, height: 14, borderRadius: 7 },
  splitLabel: { ...type.caption, color: text.secondary },
  splitValue: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  splitPct: { ...type.caption, fontWeight: "600", color: text.tertiary },

  exhibits: { flexDirection: "row", gap: space.md },
  exhibit: { flex: 1 },
  stage: { height: 158, justifyContent: "flex-end", alignItems: "center", zIndex: 0 },
  // Shop photos carry a wide white margin; scaling from the bottom edge trims it on the white page without moving the floor line.
  photo: { width: "100%", maxHeight: 158, transform: [{ scale: 1.3 }], transformOrigin: "bottom" },
  photoArt: { height: 132, marginHorizontal: space.sm, borderRadius: radius.card, alignItems: "center", justifyContent: "center" },
  placard: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 2, borderTopColor: text.primary, backgroundColor: bg.canvas },
  exhibitName: { fontSize: 13, lineHeight: 17, fontWeight: "600", color: text.primary, marginTop: 2, minHeight: 51 },
  role: { ...type.caption, fontSize: 11.5, fontWeight: "600", color: text.secondary },
  fitLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: space.sm },
  fitDot: { width: 7, height: 7, borderRadius: 4 },
  fitText: { ...type.caption, fontWeight: "600", color: text.primary },

  ribbon: { height: 72, marginTop: space.lg },
  track: { position: "absolute", left: 0, right: 0, top: 28, height: 8, borderRadius: 4, backgroundColor: bg.subtle },
  window: { position: "absolute", top: 28, height: 8 },
  windowFill: { flex: 1, borderRadius: 4, backgroundColor: "rgba(101,122,89,0.28)" },
  elapsed: { position: "absolute", left: 0, top: 28, height: 8, borderRadius: 4, backgroundColor: "rgba(28,27,26,0.12)", transformOrigin: "left" },
  markerWrap: { position: "absolute", top: 32 - 15, width: 30, height: 30 },
  marker: { width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: bg.canvas, alignItems: "center", justifyContent: "center" },
  now: { position: "absolute", top: 16, height: 32, width: 2 },
  nowLine: { flex: 1, borderRadius: 1, backgroundColor: text.primary },
  nowLabel: { position: "absolute", top: 0, width: 32, textAlign: "center", ...type.caption, fontSize: 11, fontWeight: "700", color: text.primary },
  axis: { position: "absolute", top: 54, ...type.caption, fontSize: 11, color: text.tertiary },


  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  trend: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md },
  trendText: { ...type.supporting, color: text.primary },
  edit: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 2 },
  editText: { ...type.supporting, fontWeight: "700", color: text.primary },
  label: { ...type.caption, color: text.secondary },
  // Health's rhythm: a 22pt section title, a one-line lede, then the content.
  flush: { marginTop: 0 },
  sectionHead: { flexDirection: "row", alignItems: "center", marginTop: space.section },
  sectionTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary, marginTop: space.section },
  lede: { ...type.supporting, color: text.secondary, marginTop: 2, marginBottom: space.lg },
  hero: { padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  heroTop: { minHeight: PEEK.height - 8, paddingRight: PEEK.width - 40 },
  headline: { ...type.pageTitle, fontSize: 24, lineHeight: 28, color: text.primary },
  heroSub: { ...type.supporting, color: text.secondary, marginTop: 4, fontVariant: ["tabular-nums"] },
  recLine: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: space.sm },
  recText: { ...type.caption, fontSize: 13, color: text.secondary },
  recAgree: { color: scene.sageDeep, fontWeight: "600" },
  recLink: { color: text.primary, fontWeight: "600", textDecorationLine: "underline" },
  peek: { right: -(layout.gutter + space.xl), top: -6 },
  heroList: { marginTop: space.xl, borderRadius: radius.card, backgroundColor: bg.canvas, overflow: "hidden" },
  heroRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14 },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  ribbonWrap: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  listRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  discOn: { backgroundColor: accent.primary },
  discSmall: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  flag: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: accent.band },
  status: { ...type.caption, color: text.tertiary, flexShrink: 1, marginTop: 2, fontVariant: ["tabular-nums"] },
  statusOn: { color: text.primary, fontWeight: "600" },
  body: { marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.canvas },
  bodyHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bodyLabel: { ...type.caption, color: text.secondary, flex: 1 },
  bodyValue: { ...type.supporting, fontWeight: "600", color: text.primary, fontVariant: ["tabular-nums"] },
  bodyEdit: { ...type.supporting, fontWeight: "600", color: text.primary, textDecorationLine: "underline", marginLeft: space.sm },
  bcs: { flexDirection: "row", gap: 3, marginTop: space.sm, marginBottom: space.md },
  bcsCell: { flex: 1, height: 22, borderRadius: 6, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  bcsIdeal: { backgroundColor: "rgba(101,122,89,0.18)" },
  bcsMark: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: 6, backgroundColor: text.primary },
  bcsNum: { ...type.caption, fontSize: 11, color: text.secondary },
  bcsNumOn: { color: text.inverse, fontWeight: "600" },
  mcs: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  mcsChip: { height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle, justifyContent: "center" },
  mcsChipOn: { backgroundColor: text.primary },
  mcsText: { ...type.caption, fontSize: 13, color: text.primary },
  mcsTextOn: { color: text.inverse, fontWeight: "600" },
  planHead: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },


  scrim: { backgroundColor: "rgba(28,27,26,0.08)" },
  menu: {
    position: "absolute",
    width: 236,
    paddingVertical: space.xs,
    borderRadius: radius.card,
    backgroundColor: bg.canvas,
    borderWidth: 1,
    borderColor: border.soft,
    transformOrigin: "top right",
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: space.md, height: 48, paddingHorizontal: space.lg },
  menuRule: { borderTopWidth: 1, borderTopColor: border.soft },
  menuText: { ...type.supporting, fontWeight: "600", color: text.primary },
});
