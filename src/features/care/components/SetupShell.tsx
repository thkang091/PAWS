import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRightIcon, CaretLeftIcon, CheckIcon, XIcon, type IconProps } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

/**
 * The frame every PAWS setup flow uses (Care, Food Plan): a back button and progress segments on top, one question
 * per screen that slides in from the side you are moving towards, and a single action docked at the bottom.
 */
export const SetupShell = ({
  step,
  total,
  direction,
  closing = false,
  onBack,
  primary,
  bottomInset = 0,
  scrollable = true,
  above,
  children,
}: {
  step: number;
  total: number;
  direction: number;
  /** Show a close button instead of back (the first step of a flow opened from elsewhere). */
  closing?: boolean;
  onBack: () => void;
  primary: { label: string; done?: boolean; disabled?: boolean; busy?: boolean; onPress: () => void } | null;
  bottomInset?: number;
  scrollable?: boolean;
  /** Content that stays put while steps slide, e.g. a running preview of the plan. */
  above?: ReactNode;
  children: ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? undefined : (direction > 0 ? FadeInRight : FadeInLeft).duration(motion.duration.enter);
  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);
  const off = Boolean(primary?.disabled || primary?.busy);
  // Each step starts at the top, not wherever the last one was scrolled to.
  const scroller = useRef<Animated.ScrollView>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const body = (
    <Animated.View key={step} entering={enter}>
      {children}
    </Animated.View>
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={closing ? "Close" : step === 0 ? "Back to the start" : "Previous step"}
          style={styles.roundButton}
          onPress={onBack}
        >
          {closing ? (
            <XIcon size={iconSize.nav} color={text.primary} weight="bold" />
          ) : (
            <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
          )}
        </PressScale>

        <Animated.View style={styles.progress} layout={settle}>
          {Array.from({ length: total }, (_, index) => (
            <Animated.View
              key={index}
              layout={settle}
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
              style={[styles.segment, index <= step && styles.segmentOn]}
            />
          ))}
        </Animated.View>

        <View style={styles.headerSpacer} />
      </View>

      {scrollable ? (
        <Animated.ScrollView
          ref={scroller}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + bottomInset + 128 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {above}
          {body}
        </Animated.ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{body}</View>
      )}

      {primary ? (
        <View style={[styles.dock, { paddingBottom: insets.bottom + bottomInset + space.lg }]}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            accessibilityState={{ disabled: off, busy: primary.busy }}
            scaleTo={0.97}
            disabled={off}
            style={[styles.next, off && styles.nextOff]}
            onPress={primary.onPress}
          >
            {primary.busy ? <ActivityIndicator color={text.secondary} /> : null}
            <Text style={[styles.nextText, off && styles.nextTextOff]}>{primary.label}</Text>
            {primary.busy ? null : primary.done ? (
              <CheckIcon size={iconSize.button} color={off ? text.disabled : text.primary} weight="bold" />
            ) : (
              <ArrowRightIcon size={iconSize.button} color={off ? text.disabled : text.primary} weight="bold" />
            )}
          </PressScale>
        </View>
      ) : null}
    </View>
  );
};

/** The big tappable choice card from Care setup: icon disc, label and hint, and a box that springs a tick in. */
export const SetupChoiceCard = ({
  order,
  label,
  hint,
  Glyph,
  on,
  reduceMotion,
  role = "checkbox",
  onPress,
}: {
  order: number;
  label: string;
  hint: string;
  Glyph: ComponentType<IconProps>;
  on: boolean;
  reduceMotion: boolean;
  role?: "checkbox" | "radio";
  onPress: () => void;
}) => {
  const pop = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    pop.value = reduceMotion ? (on ? 1 : 0) : withSpring(on ? 1 : 0, { duration: 380, dampingRatio: 0.7 });
  }, [on, pop, reduceMotion]);
  const tick = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.7 + pop.value * 0.3 }] }));

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(order * 50)}>
      <PressScale
        accessibilityRole={role}
        accessibilityState={role === "radio" ? { selected: on } : { checked: on }}
        accessibilityLabel={`${label}. ${hint}`}
        scaleTo={0.98}
        style={[styles.card, on && styles.cardOn]}
        onPress={onPress}
      >
        <View style={[styles.disc, on && styles.discOn]}>
          <Glyph size={iconSize.feature} color={text.primary} weight={on ? "fill" : "regular"} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.cardLabel}>{label}</Text>
          {hint ? <Text style={styles.cardHint}>{hint}</Text> : null}
        </View>
        <View style={[styles.box, role === "radio" && styles.boxRound, on && styles.boxOn]}>
          <Animated.View style={tick}>
            <CheckIcon size={14} color={text.primary} weight="bold" />
          </Animated.View>
        </View>
      </PressScale>
    </Animated.View>
  );
};

/** Shared type for setup screens: the big question and its one-line note. */
export const setupText = StyleSheet.create({
  title: { ...type.hero, fontSize: 32, lineHeight: 36, color: text.primary },
  note: { ...type.supporting, color: text.tertiary, marginTop: space.md },
  label: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.section },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: layout.gutter,
    paddingBottom: space.lg,
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
  headerSpacer: { width: layout.iconButton },
  progress: { flex: 1, flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: bg.subtle },
  segmentOn: { backgroundColor: accent.deep },
  content: { paddingHorizontal: layout.gutter, paddingTop: space.lg },
  fill: { flex: 1 },
  dock: {
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
  next: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  nextOff: { backgroundColor: bg.subtle },
  nextText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  nextTextOff: { color: text.disabled },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    borderRadius: radius.card + 4,
    borderWidth: 1.5,
    borderColor: border.soft,
    backgroundColor: bg.canvas,
  },
  cardOn: { borderColor: accent.deep, backgroundColor: accent.soft },
  disc: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  discOn: { backgroundColor: accent.primary },
  copy: { flex: 1 },
  cardLabel: { ...type.sectionTitle, color: text.primary },
  cardHint: { ...type.supporting, color: text.secondary, marginTop: 2 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  boxRound: { borderRadius: 13 },
  boxOn: { borderColor: accent.deep, backgroundColor: accent.deep },
});
