import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { BarbellIcon, BookOpenIcon, CheckIcon, PawPrintIcon, StarIcon, type IconProps } from "phosphor-react-native";
import type { ComponentType } from "react";

import { Reveal } from "@/features/onboarding/components/Reveal";
import { TrainCompanion } from "@/features/train/components/TrainCompanion";
import { CHEST_HEIGHT, CHEST_WIDTH, TrailChest } from "@/features/train/components/TrailChest";
import { trailLayout } from "@/features/train/components/trailLayout";
import type { CompanionPoseKey } from "@/features/train/components/companionPaths";
import type { NodeState } from "@/features/train/components/ChapterNode";
import { accent, bg, border, motion, space, text, type } from "@/constants/design";

export type TrailStep = { id: string; title: string; state: NodeState };

const NODE = 72;
const LIP = 7;
const SLOT = 104;
/** Room above the first step for its "Start" tag. */
const TOP = 84;
const RING = NODE + 22;
/** What each step looks like by its place: a lesson, a read, a practice, a play. */
const GLYPHS: readonly ComponentType<IconProps>[] = [StarIcon, BookOpenIcon, BarbellIcon, PawPrintIcon];

/**
 * Face and lip colours per state, from the same palette as the rest of PAWS: done is the soft cream with an amber tick,
 * next up is the yellow of the selected tab, later steps are white on a grey lip.
 */
const TONE: Record<NodeState, { face: string; lip: string; glyph: string }> = {
  done: { face: accent.primary, lip: "#D8D59B", glyph: accent.band },
  current: { face: accent.deep, lip: "#E1AE45", glyph: text.primary },
  available: { face: bg.surface, lip: border.default, glyph: text.disabled },
  locked: { face: bg.surface, lip: border.default, glyph: text.disabled },
};

/**
 * The topic as a winding path of raised steps with reward chests on the centre line. Done steps are cream with an
 * amber tick, the next step is yellow with a ring for the topic's progress and a "Start" tag, later steps are white.
 * Each step sinks onto its lip when pressed.
 */
export const TopicTrail = ({
  topicKey,
  steps,
  doneCount,
  width,
  pose,
  onStepPress,
}: {
  topicKey: string;
  pose?: CompanionPoseKey;
  steps: readonly TrailStep[];
  doneCount: number;
  width: number;
  onStepPress: (step: TrailStep, index: number) => void;
}) => {
  const amplitude = Math.min(96, width * 0.24);
  const centre = width / 2;
  const { items, sway } = trailLayout(steps.length);
  const points = items.map((_, j) => ({ x: centre + sway(j) * amplitude, y: TOP + j * SLOT }));
  const height = TOP + Math.max(0, items.length - 1) * SLOT + NODE + space.xxl;
  const fraction = steps.length ? doneCount / steps.length : 0;

  // The topic's dog sits in the open space across from the lessons before the first chest.
  const dogAt = Math.max(0, items.findIndex((it) => it.kind === "chest") - 2);
  const dogPoint = pose && steps.length > 2 ? points[dogAt] : undefined;
  const dogSide = dogPoint && dogPoint.x > centre ? { left: 0 } : { right: 0 };
  const dogWidth = Math.min(120, width * 0.3);

  return (
    <View key={topicKey} style={[styles.trail, { width, height }]}>
      {pose && dogPoint ? (
        <View pointerEvents="none" style={[styles.dog, { top: dogPoint.y - dogWidth / 2 + SLOT / 2 }, dogSide]}>
          <TrainCompanion pose={pose} width={dogWidth} />
        </View>
      ) : null}
      {items.map((item, j) => {
        const p = points[j];
        if (item.kind === "chest") {
          const left = Math.max(0, item.after - doneCount);
          return (
            <Reveal key={`chest-${item.after}`} index={j} offset={motion.duration.enter}>
              <View style={[styles.chestSlot, { top: p.y - CHEST_HEIGHT / 2, left: p.x - CHEST_WIDTH / 2 }]}>
                <Chest earned={left === 0} remaining={left} />
              </View>
            </Reveal>
          );
        }
        const step = steps[item.index];
        return (
          <Reveal key={step.id} index={j} offset={motion.duration.enter}>
            <View style={[styles.slot, { top: p.y - NODE / 2, left: p.x - NODE / 2 }]}>
              <Step index={item.index} step={step} fraction={fraction} onPress={() => onStepPress(step, item.index)} />
            </View>
          </Reveal>
        );
      })}
    </View>
  );
};

/** A chest answers a tap with a small wobble: a shake when it is still shut, a happy hop once it is earned. */
const Chest = ({ earned, remaining }: { earned: boolean; remaining: number }) => {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  const lift = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { rotate: `${turn.value}deg` }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={earned ? "Reward chest. Earned" : `Reward chest. ${remaining} more ${remaining === 1 ? "lesson" : "lessons"} to open`}
      hitSlop={8}
      onPress={() => {
        if (earned) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (!reduceMotion) lift.value = withSequence(withTiming(-8, { duration: 140, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 260 }));
          return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!reduceMotion) turn.value = withSequence(withTiming(-6, { duration: 60 }), withTiming(6, { duration: 80 }), withTiming(-3, { duration: 70 }), withSpring(0, { damping: 12, stiffness: 300 }));
      }}
    >
      <Animated.View style={style}>
        <TrailChest earned={earned} />
      </Animated.View>
    </Pressable>
  );
};

const Step = ({ index, step, fraction, onPress }: { index: number; step: TrailStep; fraction: number; onPress: () => void }) => {
  const Glyph = GLYPHS[index % GLYPHS.length];
  const reduceMotion = useReducedMotion();
  const tone = TONE[step.state];
  const locked = step.state === "locked";
  const current = step.state === "current";

  // Pressed, the face sinks onto its lip.
  const sink = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: sink.value * (LIP - 1) }] }));

  // The "Start" tag bobs gently so the next step is easy to find.
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!current || reduceMotion) return;
    bob.value = withRepeat(withSequence(withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) })), -1);
  }, [bob, current, reduceMotion]);
  const tag = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  const r = RING / 2 - 4;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={styles.stepBox}>
      {current ? (
        <>
          <Svg width={RING} height={RING} style={styles.ring}>
            <Circle cx={RING / 2} cy={RING / 2} r={r} stroke="rgba(255,255,255,0.7)" strokeWidth={7} fill="none" />
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              stroke={accent.band}
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - Math.max(0.04, fraction))}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          </Svg>
          <Animated.View style={[styles.tag, tag]} pointerEvents="none">
            <Text style={styles.tagText} numberOfLines={1}>
              {index === 0 ? "START" : "NEXT"}
            </Text>
            <View style={styles.tagTail} />
          </Animated.View>
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Step ${index + 1}. ${step.title}. ${step.state === "done" ? "Done" : current ? "Next up" : locked ? "Locked" : "Not started"}`}
        accessibilityState={{ disabled: locked }}
        disabled={locked}
        onPressIn={() => {
          sink.value = reduceMotion ? 1 : withTiming(1, { duration: 70 });
        }}
        onPressOut={() => {
          sink.value = reduceMotion ? 0 : withSpring(0, { damping: 14, stiffness: 320 });
        }}
        onPress={() => {
          void Haptics.impactAsync(current ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        hitSlop={8}
      >
        <View style={[styles.lip, { backgroundColor: tone.lip }]} />
        <Animated.View style={[styles.face, { backgroundColor: tone.face }, face]}>
          {step.state === "done" ? <CheckIcon size={34} color={tone.glyph} weight="bold" /> : <Glyph size={32} color={tone.glyph} weight="fill" />}
        </Animated.View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  trail: { alignSelf: "center", marginTop: space.lg },
  slot: { position: "absolute", width: NODE, height: NODE + LIP },
  chestSlot: { position: "absolute", width: CHEST_WIDTH, height: CHEST_HEIGHT },
  stepBox: { width: NODE, height: NODE + LIP, alignItems: "center" },
  ring: { position: "absolute", top: -(RING - NODE) / 2 + LIP / 2, left: -(RING - NODE) / 2 },
  lip: { position: "absolute", top: LIP, width: NODE, height: NODE, borderRadius: NODE / 2 },
  face: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dog: { position: "absolute" },

  tag: { position: "absolute", top: -46, width: 104, left: (NODE - 104) / 2, alignItems: "center", zIndex: 2 },
  tagText: {
    ...type.caption,
    fontWeight: "800",
    letterSpacing: 1,
    color: text.primary,
    backgroundColor: bg.canvas,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: border.soft,
    overflow: "hidden",
  },
  tagTail: { width: 10, height: 10, marginTop: -6, backgroundColor: bg.canvas, borderRightWidth: 2, borderBottomWidth: 2, borderColor: border.soft, transform: [{ rotate: "45deg" }] },

});
