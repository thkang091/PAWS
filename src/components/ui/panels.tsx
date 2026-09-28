import type { ReactNode } from "react";
import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import {
  ArrowUpRightIcon,
  BowlFoodIcon,
  CalendarBlankIcon,
  CaretRightIcon,
  ChatCircleIcon,
  ConfettiIcon,
  ClockIcon,
  FolderIcon,
  GenderMaleIcon,
  GlobeIcon,
  GraduationCapIcon,
  HandIcon,
  HeartIcon,
  HouseIcon,
  LightningIcon,
  MapPinIcon,
  MoonIcon,
  NotebookIcon,
  PersonSimpleWalkIcon,
  PillIcon,
  ScalesIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  SmileyIcon,
  StethoscopeIcon,
  SyringeIcon,
  TargetIcon,
  TennisBallIcon,
  TrendUpIcon,
  UsersIcon,
  UsersThreeIcon,
  WaveSineIcon,
} from "phosphor-react-native";

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

type PhosphorIcon = typeof HeartIcon;

const GLYPH: Record<string, PhosphorIcon> = {
  energy: LightningIcon,
  confidence: ShieldCheckIcon,
  sociability: UsersThreeIcon,
  play: TennisBallIcon,
  independence: HouseIcon,
  sensitivity: WaveSineIcon,
  gender: GenderMaleIcon,
  calendar: CalendarBlankIcon,
  folder: FolderIcon,
  target: TargetIcon,
  syringe: SyringeIcon,
  heart: HeartIcon,
  pill: PillIcon,
  walk: PersonSimpleWalkIcon,
  confetti: ConfettiIcon,
  scissors: ScissorsIcon,
  shield: ShieldCheckIcon,
  scales: ScalesIcon,
  trend: TrendUpIcon,
  communication: ChatCircleIcon,
  calmness: MoonIcon,
  leash: PersonSimpleWalkIcon,
  social: UsersIcon,
  world: GlobeIcon,
  handling: HandIcon,
  personality: SmileyIcon,
  places: MapPinIcon,
  routine: ClockIcon,
  people: UsersIcon,
  records: FolderIcon,
  training: GraduationCapIcon,
  behaviour: NotebookIcon,
  health: HeartIcon,
  food: BowlFoodIcon,
  activity: PersonSimpleWalkIcon,
  "care-team": StethoscopeIcon,
};

const glyphFor = (key: string) => GLYPH[key] ?? FolderIcon;

const useEnter = () => {
  const reduceMotion = useReducedMotion();
  return (order: number) =>
    reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 40);
};

export type SpotlightData = {
  chip: string;
  glyph: string;
  title: string;
  meta: string;
  progress?: number;
  progressNote?: string;
};

export const Spotlight = memo(
  ({ data, onPress }: { data: SpotlightData; onPress: () => void }) => {
    const reduceMotion = useReducedMotion();
    const Glyph = glyphFor(data.glyph);

    const target = data.progress ?? 0;
    const filled = useSharedValue(reduceMotion ? target : 0);
    useEffect(() => {
      filled.value = reduceMotion
        ? target
        : withDelay(
            motion.duration.enter,
            withTiming(target, {
              duration: motion.duration.flourish,
              easing: motion.easing.out,
            }),
          );
    }, [filled, reduceMotion, target]);

    const fillStyle = useAnimatedStyle(() => ({ width: `${filled.value * 100}%` }));

    return (
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${data.chip}. ${data.title}. ${data.meta}. ${data.progressNote ?? ""}`}
        scaleTo={0.99}
        style={styles.spotlight}
        onPress={onPress}
      >
        <View style={styles.spotHead}>
          <Glyph size={iconSize.inline} color={text.tertiary} weight="regular" />
          <Text style={styles.spotLabel}>{data.chip}</Text>
          <View style={styles.spotRule} />
          <CaretRightIcon size={iconSize.inline} color={border.strong} weight="bold" />
        </View>

        <Text style={styles.spotTitle}>{data.title}</Text>
        <Text style={styles.spotMeta}>{data.meta}</Text>

        {data.progress != null ? (
          <View style={styles.spotProgress}>
            <View style={styles.spotTrack}>
              <Animated.View style={[styles.spotFill, fillStyle]} />
            </View>
            {data.progressNote ? (
              <Text style={styles.spotNote}>{data.progressNote}</Text>
            ) : null}
          </View>
        ) : null}
      </PressScale>
    );
  },
);

Spotlight.displayName = "Spotlight";

export type BandFigure = { key: string; glyph: string; value: string; label: string };

export const Band = memo(({ figures }: { figures: readonly BandFigure[] }) => (
  <View style={styles.band}>
    {figures.map((figure, index) => {
      const Glyph = glyphFor(figure.glyph);
      return (
        <View key={figure.key} style={styles.bandCell}>
          {index > 0 ? <View style={styles.bandRule} /> : null}
          <View style={styles.bandInner} accessibilityLabel={`${figure.label}: ${figure.value}`}>
            <Glyph size={iconSize.standard} color={text.secondary} weight="regular" />
            <Text style={styles.bandValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {figure.value}
            </Text>
            <Text style={styles.bandLabel} numberOfLines={1}>
              {figure.label}
            </Text>
          </View>
        </View>
      );
    })}
  </View>
));

Band.displayName = "Band";

export type RailCard = {
  key: string;
  title: string;
  chip?: string;
  meta: string;
  onPress?: () => void;
};

export const Rail = memo(({ cards }: { cards: readonly RailCard[] }) => {
  const enter = useEnter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      style={styles.railViewport}
    >
      {cards.map((card, index) => (
        <Animated.View key={card.key} entering={enter(index)}>
          <PressScale
            accessibilityRole={card.onPress ? "button" : "text"}
            accessibilityLabel={`${card.title}. ${card.chip ?? ""} ${card.meta}`}
            scaleTo={0.96}
            disabled={!card.onPress}
            style={styles.railCard}
            onPress={card.onPress}
          >
            <View style={styles.railTop}>
              <Text style={styles.railTitle} numberOfLines={2}>
                {card.title}
              </Text>
              {card.onPress ? (
                <ArrowUpRightIcon size={iconSize.inline} color={text.tertiary} weight="bold" />
              ) : null}
            </View>

            {card.chip ? (
              <View style={styles.railChip}>
                <Text style={styles.railChipText} numberOfLines={1}>
                  {card.chip}
                </Text>
              </View>
            ) : null}

            <Text style={styles.railMeta} numberOfLines={1}>
              {card.meta}
            </Text>
          </PressScale>
        </Animated.View>
      ))}
    </ScrollView>
  );
});

Rail.displayName = "Rail";

export const TraitRail = memo(
  ({ traits }: { traits: readonly { key: string; value: string; label: string }[] }) => {
    const enter = useEnter();

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        style={styles.railViewport}
      >
        {traits.map((trait, index) => {
          const Glyph = glyphFor(trait.key);
          return (
            <Animated.View key={trait.key} entering={enter(index)}>
              <View
                style={styles.traitCard}
                accessibilityLabel={`${trait.label}: ${trait.value}`}
              >
                <View style={styles.traitDisc}>
                  <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
                </View>
                <Text
                  style={styles.traitValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {trait.value}
                </Text>
                <Text style={styles.traitLabel} numberOfLines={1}>
                  {trait.label}
                </Text>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    );
  },
);

TraitRail.displayName = "TraitRail";

export type MeterCard = { key: string; label: string; strong: number; total: number };

export const Meters = memo(({ rows }: { rows: readonly MeterCard[] }) => {
  const reduceMotion = useReducedMotion();
  const enter = useEnter();

  return (
    <View style={styles.meters}>
      {rows.map((row, index) => (
        <Animated.View key={row.key} entering={enter(index)} style={styles.meterCard}>
          <MeterBody row={row} order={index} reduceMotion={reduceMotion} />
        </Animated.View>
      ))}
    </View>
  );
});

Meters.displayName = "Meters";

const MeterBody = ({
  row,
  order,
  reduceMotion,
}: {
  row: MeterCard;
  order: number;
  reduceMotion: boolean;
}) => {
  const Glyph = glyphFor(row.key);
  const share = row.total > 0 ? row.strong / row.total : 0;

  const grow = useDerivedValue(
    () =>
      reduceMotion
        ? share
        : withDelay(
            motion.duration.enter + order * 40,
            withTiming(share, { duration: motion.duration.reveal, easing: motion.easing.out }),
          ),
    [share, order, reduceMotion],
  );

  const fillStyle = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));

  return (
    <View accessibilityLabel={`${row.label}: ${row.strong} of ${row.total} strong`}>
      <View style={styles.meterHead}>
        <Glyph size={iconSize.inline} color={text.secondary} weight="regular" />
        <Text style={styles.meterCount}>
          {row.strong}/{row.total}
        </Text>
      </View>

      <Text style={styles.meterLabel} numberOfLines={1}>
        {row.label}
      </Text>

      <View style={styles.meterTrack}>
        <Animated.View style={[styles.meterFill, fillStyle]} />
      </View>
    </View>
  );
};

export type TileData = { key: string; glyph: string; title: string; summary: string; onPress: () => void };

export const Tiles = memo(({ tiles }: { tiles: readonly TileData[] }) => {
  const enter = useEnter();
  const wideIndex = tiles.length % 2 === 1 ? tiles.length - 1 : -1;

  return (
    <View style={styles.tiles}>
      {tiles.map((tile, index) => {
        const Glyph = glyphFor(tile.glyph);
        const wide = index === wideIndex;
        return (
          <Animated.View
            key={tile.key}
            entering={enter(index)}
            style={wide ? styles.tileSlotWide : styles.tileSlot}
          >
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`${tile.title}. ${tile.summary}`}
              scaleTo={0.96}
              style={[styles.tile, wide && styles.tileWide]}
              onPress={tile.onPress}
            >
              <View style={styles.tileDisc}>
                <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
              </View>
              <View style={wide ? styles.tileCopyWide : undefined}>
                <Text style={[styles.tileTitle, wide && styles.tileTitleWide]} numberOfLines={1}>
                  {tile.title}
                </Text>
                <Text style={styles.tileSummary} numberOfLines={2}>
                  {tile.summary}
                </Text>
              </View>
            </PressScale>
          </Animated.View>
        );
      })}
    </View>
  );
});

Tiles.displayName = "Tiles";

export const PanelHead = ({ title, trailing }: { title: string; trailing?: ReactNode }) => (
  <View style={styles.head}>
    <Text style={styles.headTitle}>{title}</Text>
    {trailing}
  </View>
);

const TILE_GAP = space.md;
const RAIL_CARD = 164;
const TRAIT_CARD = 116;

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.section,
    marginBottom: space.lg,
  },
  headTitle: { ...type.sectionTitle, color: text.primary },

  spotlight: { marginTop: space.xxl },
  spotHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  spotLabel: { ...type.caption, fontWeight: "600", color: text.tertiary },
  spotRule: { flex: 1, height: 1, backgroundColor: border.soft },
  spotTitle: { ...type.hero, color: text.primary, marginTop: space.lg },
  spotMeta: { ...type.body, color: text.secondary, marginTop: space.sm },
  spotProgress: { marginTop: space.xl },
  spotTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    overflow: "hidden",
  },
  spotFill: { height: "100%", borderRadius: radius.pill, backgroundColor: accent.deep },
  spotNote: { ...type.caption, color: text.tertiary, marginTop: space.sm },

  band: { flexDirection: "row", alignItems: "stretch", marginTop: space.xxl },
  bandCell: { flex: 1, flexDirection: "row" },
  bandRule: { width: 1, backgroundColor: border.soft, marginHorizontal: space.md },
  bandInner: { flex: 1, alignItems: "center", gap: 6 },
  bandValue: { ...type.sectionTitle, fontWeight: "600", color: text.primary, textAlign: "center" },
  bandLabel: { ...type.caption, color: text.tertiary },

  railViewport: { marginHorizontal: -space.xxl },
  rail: { paddingHorizontal: space.xxl, gap: TILE_GAP },
  railCard: {
    width: RAIL_CARD,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
  },
  railTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  railTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary, flex: 1 },
  railChip: {
    alignSelf: "flex-start",
    marginTop: space.xs,
    paddingVertical: 4,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
  },
  railChipText: { ...type.caption, fontWeight: "600", color: text.primary },
  railMeta: { ...type.caption, color: text.tertiary, marginTop: space.sm },

  traitCard: {
    width: TRAIT_CARD,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
    alignItems: "center",
  },
  traitDisc: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  traitValue: {
    ...type.cardTitle,
    fontWeight: "700",
    color: text.primary,
    marginTop: space.md,
    textAlign: "center",
  },
  traitLabel: { ...type.caption, color: text.tertiary, marginTop: 2 },

  meters: { flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP, marginTop: space.xs },
  meterCard: {
    width: `48%`,
    flexGrow: 1,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
  },
  meterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  meterCount: {
    ...type.cardTitle,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  meterLabel: { ...type.caption, color: text.secondary, marginTop: space.sm },
  meterTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    overflow: "hidden",
    marginTop: space.sm,
  },
  meterFill: { height: "100%", borderRadius: radius.pill, backgroundColor: accent.deep },

  tiles: { flexDirection: "row", flexWrap: "wrap", gap: TILE_GAP },
  tileSlot: { width: `48%`, flexGrow: 1 },
  tileSlotWide: { width: "100%" },
  tile: {
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: bg.subtle,
    minHeight: 128,
  },
  tileWide: { flexDirection: "row", alignItems: "center", gap: space.lg, minHeight: 0 },
  tileCopyWide: { flex: 1 },
  tileTitleWide: { marginTop: 0 },
  tileDisc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.md },
  tileSummary: { ...type.caption, color: text.tertiary, marginTop: 3 },
});
