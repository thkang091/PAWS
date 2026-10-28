import type { ReactNode } from "react";
import { createContext, memo, useContext, useEffect } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  ArrowRightIcon,
  BellIcon,
  BowlFoodIcon,
  CaretRightIcon,
  ClockIcon,
  DatabaseIcon,
  DeviceMobileIcon,
  FolderIcon,
  GraduationCapIcon,
  HeartIcon,
  LifebuoyIcon,
  LockIcon,
  MapPinIcon,
  NotebookIcon,
  PersonSimpleWalkIcon,
  SmileyIcon,
  StethoscopeIcon,
  UserCircleIcon,
  UsersIcon,
  UsersThreeIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const PAD = space.xxl;

type Tone = "card" | "butter";
const TONE_TRACK: Record<Tone, string> = { card: accent.primary, butter: accent.deep };
const TONE_DISC: Record<Tone, string> = { card: accent.primary, butter: bg.canvas };
const ToneContext = createContext<Tone>("card");

const ROW_GLYPH: Record<string, PhosphorIcon> = {
  personality: SmileyIcon,
  social: MapPinIcon,
  routine: ClockIcon,
  people: UsersIcon,
  records: FolderIcon,
  training: GraduationCapIcon,
  behaviour: NotebookIcon,
  health: HeartIcon,
  food: BowlFoodIcon,
  activity: PersonSimpleWalkIcon,
  "care-team": StethoscopeIcon,
  notifications: BellIcon,
  account: UserCircleIcon,
  privacy: LockIcon,
  devices: DeviceMobileIcon,
  household: UsersThreeIcon,
  data: DatabaseIcon,
  help: LifebuoyIcon,
};

export const glyphFor = (key: string) => ROW_GLYPH[key];

const useReveal = (delay = 0) => {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion
      ? 1
      : withDelay(delay, withTiming(1, { duration: motion.duration.flourish, easing: motion.easing.out }));
  }, [delay, progress, reduceMotion]);
  return progress;
};

export const Panel = ({
  lead,
  title,
  size = "hero",
  meta,
  accessory,
  label,
  onPress,
  tone,
  style,
  children,
}: {
  tone?: Tone;
  lead?: string;
  title: string;
  size?: "hero" | "section";
  meta?: string;
  accessory?: ReactNode;
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) => {
  const reduceMotion = useReducedMotion();
  const surface: Tone = tone ?? "card";
  const fill = surface === "butter" ? styles.panelButter : styles.panelCard;
  const head = (
    <View style={styles.head}>
      <Text style={[styles.headline, size === "section" && styles.headlineSection]} accessibilityRole="header">
        {lead ? (
          <>
            <Text style={styles.lead}>{lead}</Text>
            {"\n"}
          </>
        ) : null}
        {title}
      </Text>
      {onPress ? (
        <View style={[styles.arrow, { backgroundColor: TONE_DISC[surface] }]}>
          <ArrowRightIcon size={iconSize.standard} color={text.primary} weight="bold" />
        </View>
      ) : accessory ? (
        <View style={styles.accessory}>{accessory}</View>
      ) : null}
    </View>
  );

  const body = (
    <ToneContext.Provider value={surface}>
      {head}
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </ToneContext.Provider>
  );

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
      style={[styles.panelWrap, style]}
    >
      {onPress ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={label ?? `${lead ?? ""} ${title}`}
          scaleTo={0.985}
          style={[styles.panel, fill]}
          onPress={onPress}
        >
          {body}
        </PressScale>
      ) : (
        <View style={[styles.panel, fill]} accessibilityLabel={label}>
          {body}
        </View>
      )}
    </Animated.View>
  );
};

export const Steps = ({
  filled,
  total,
  delay = 0,
  wide = false,
}: {
  filled: number;
  total: number;
  delay?: number;
  wide?: boolean;
}) => {
  const progress = useReveal(motion.duration.enter + delay);
  const track = { backgroundColor: TONE_TRACK[useContext(ToneContext)] };
  return (
    <View style={[styles.steps, wide && styles.stepsWide]} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: Math.max(1, total) }, (_, step) => (
        <Step key={step} step={step} filled={filled} progress={progress} wide={wide} track={track} />
      ))}
    </View>
  );
};

const Step = ({
  step,
  filled,
  progress,
  wide,
  track,
}: {
  track: { backgroundColor: string };
  step: number;
  filled: number;
  progress: SharedValue<number>;
  wide: boolean;
}) => {
  const fill = useAnimatedStyle(() => {
    const reached = interpolate(progress.value * filled - step, [0, 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: reached, transform: [{ scaleY: 0.6 + reached * 0.4 }] };
  });
  return (
    <View style={[styles.step, track, wide && styles.stepWide]}>
      {step < filled ? <Animated.View style={[styles.stepFill, fill]} /> : null}
    </View>
  );
};

export const PanelRow = ({
  label,
  sub,
  value,
  steps,
  order = 0,
  onPress,
  editing = false,
  a11y,
  icon: Glyph,
}: {
  icon?: PhosphorIcon;
  label: string;
  sub?: string;
  value?: string;
  steps?: { filled: number; total: number };
  order?: number;
  onPress?: () => void;
  editing?: boolean;
  a11y?: string;
}) => {
  const described = a11y ?? [label, sub, value].filter(Boolean).join(", ");
  const disc = { backgroundColor: TONE_DISC[useContext(ToneContext)] };
  const content = (
    <>
      {Glyph ? (
        <View style={[styles.rowIcon, disc]}>
          <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
        </View>
      ) : null}
      <View style={steps ? styles.rowLabelFixed : styles.rowLabelFlex}>
        <Text style={[styles.label, sub && styles.labelStrong]} numberOfLines={sub ? 1 : 2}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      {steps ? <Steps filled={steps.filled} total={steps.total} delay={order * motion.stagger} /> : null}
      {value ? (
        <View style={[steps && styles.valueFixed, editing && styles.editable]}>
          <Text style={[styles.value, value === "Not added" && styles.valueEmpty]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ) : null}
      {onPress ? (
        <View style={styles.go}>
          <CaretRightIcon size={14} color={text.tertiary} weight="bold" />
        </View>
      ) : null}
    </>
  );

  return onPress ? (
    <PressScale accessibilityRole="button" accessibilityLabel={described} scaleTo={0.985} style={styles.row} onPress={onPress}>
      {content}
    </PressScale>
  ) : (
    <View style={styles.row} accessibilityLabel={described}>
      {content}
    </View>
  );
};

export const PanelChips = ({ items }: { items: readonly string[] }) => {
  const disc = { backgroundColor: TONE_DISC[useContext(ToneContext)] };
  return (
  <View style={styles.chips}>
    {items.map((item) => (
      <View key={item} style={[styles.chip, disc]}>
        <Text style={styles.chipText}>{item}</Text>
      </View>
    ))}
  </View>
  );
};

export type Trait = { key: string; value: string; label: string; level: number; phrase: string };

const listPhrase = (words: readonly string[]) =>
  words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;

export const TemperamentHero = memo(({ name, traits }: { name: string; traits: readonly Trait[] }) => {
  const standout = [...traits]
    .map((trait, order) => ({ trait, order }))
    .sort((a, b) => b.trait.level - a.trait.level || a.order - b.order)
    .slice(0, 3)
    .sort((a, b) => a.order - b.order)
    .map(({ trait }) => trait.phrase);

  return (
    <Panel tone="butter" lead={`${name} is`} title={`${listPhrase(standout)}.`}>
      {traits.map((trait, index) => (
        <PanelRow
          key={trait.key}
          label={trait.label}
          steps={{ filled: trait.level, total: 5 }}
          value={trait.value}
          order={index}
        />
      ))}
    </Panel>
  );
});

TemperamentHero.displayName = "TemperamentHero";

export const FocusHero = memo(
  ({
    lead,
    title,
    meta,
    progress,
    progressNote,
    onPress,
  }: {
    lead: string;
    title: string;
    meta: string;
    progress?: number;
    progressNote?: string;
    onPress: () => void;
  }) => {
    const total = progress != null && progressNote ? Number(progressNote.match(/of (\d+)/)?.[1] ?? 0) : 0;
    const done = Math.round((progress ?? 0) * total);
    return (
      <Panel tone="butter" lead={lead} title={title} meta={meta} onPress={onPress} label={`${lead} ${title}. ${meta}. ${progressNote ?? ""}`}>
        {total > 0 ? (
          <>
            <Steps filled={done} total={total} wide />
            <Text style={styles.stepsNote}>{progressNote}</Text>
          </>
        ) : null}
      </Panel>
    );
  },
);

FocusHero.displayName = "FocusHero";

export const IdentityPanel = ({
  name,
  breed,
  rows,
  onPressBond,
}: {
  name: string;
  breed: string;
  /** The internal dog tag; kept for callers but never shown. */
  tag?: string;
  rows: readonly { key: string; label: string; value: string; steps?: { filled: number; total: number } }[];
  onPressBond: () => void;
}) => (
  <Panel lead={breed} title={name}>
    {rows.map((row, index) => (
      <PanelRow
        key={row.key}
        label={row.label}
        value={row.value}
        steps={row.steps}
        order={index}
        onPress={row.key === "bond" ? onPressBond : undefined}
      />
    ))}
  </Panel>
);

const styles = StyleSheet.create({
  panelWrap: { marginTop: space.xl },
  panel: { padding: PAD, borderRadius: radius.card + 6 },
  panelCard: { backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.soft },
  panelButter: { backgroundColor: accent.primary },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  headline: {
    flex: 1,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
    fontWeight: "700",
    color: text.primary,
  },
  headlineSection: { fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  lead: { fontWeight: "500", color: text.secondary },
  meta: { ...type.supporting, color: text.secondary, marginTop: space.md },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  accessory: { paddingTop: 4, maxWidth: "46%" },
  body: { marginTop: space.xl, gap: space.md },

  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 24 },
  rowLabelFixed: { width: 96 },
  rowLabelFlex: { flex: 1 },
  label: { ...type.supporting, color: text.secondary },
  labelStrong: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  sub: { ...type.caption, color: text.secondary, marginTop: 1 },
  value: { ...type.supporting, fontWeight: "600", color: text.primary, textAlign: "right" },
  valueEmpty: { color: text.tertiary, fontWeight: "500" },
  valueFixed: { flex: 1 },
  editable: { borderBottomWidth: 3, borderBottomColor: text.primary, borderRadius: 1 },
  go: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  steps: { flexDirection: "row", gap: 3 },
  stepsWide: { gap: 6 },
  step: { width: 17, height: 10, borderRadius: 3, overflow: "hidden" },
  stepWide: { flex: 1, width: undefined },
  stepFill: { flex: 1, borderRadius: 3, backgroundColor: text.primary },
  stepsNote: { ...type.caption, fontWeight: "600", color: text.primary },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  chipText: { ...type.supporting, fontWeight: "500", color: text.primary },

  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  tagText: { ...type.caption, fontWeight: "600", color: text.primary, flexShrink: 1 },
});
