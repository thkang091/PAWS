import { useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { runOnJS } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import { DoorOpenIcon, PlusIcon, QrCodeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, text } from "@/constants/design";

const SIZE = 48;
const ACTION = 64;
const OPEN = { damping: 18, stiffness: 260, mass: 0.8 } as const;

type Action = { key: string; label: string; icon: React.ReactNode; color: string; onPress: () => void };

/**
 * Play with friends, from the header: a round "+" that turns into an X and drops two actions out of itself, Join a
 * game and Make a room. The actions grow from the button (origin-aware), a few frames apart; closing is quicker than
 * opening.
 */
export const PlayMenu = ({ onJoin, onMake }: { onJoin: () => void; onMake: () => void }) => {
  const reduceMotion = useReducedMotion();
  const trigger = useRef<View | null>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = useSharedValue(0);

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const openAt = (x: number, y: number) => {
    setAt({ x, y });
    void Haptics.selectionAsync();
    open.value = reduceMotion ? withTiming(1, { duration: 150 }) : withSpring(1, OPEN);
  };
  const show = () => {
    // Where the button is on screen, so the menu grows out of it. If the measurement doesn't come back in time, use
    // the header's own spot (the button only shows at the top of the screen).
    let done = false;
    trigger.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      if (done || !Number.isFinite(pageX) || !Number.isFinite(pageY)) return;
      done = true;
      openAt(pageX, pageY);
    });
    setTimeout(() => {
      if (done) return;
      done = true;
      openAt(width - 24 - 48 - 8 - SIZE, insets.top + 16);
    }, 120);
  };
  const hide = (then?: () => void) => {
    const done = () => {
      setAt(null);
      then?.();
    };
    open.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(done)();
    });
  };

  const actions: Action[] = [
    { key: "join", label: "Join", icon: <QrCodeIcon size={26} color={text.primary} weight="bold" />, color: "#FFFFFF", onPress: () => hide(onJoin) },
    { key: "make", label: "Make a room", icon: <DoorOpenIcon size={26} color={text.primary} weight="fill" />, color: accent.deep, onPress: () => hide(onMake) },
  ];

  const backdrop = useAnimatedStyle(() => ({ opacity: open.value }));
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${open.value * 135}deg` }] }));

  return (
    <>
      <View ref={trigger} collapsable={false}>
        <PressScale accessibilityRole="button" accessibilityLabel="Play with friends: join a game or make a room" scaleTo={0.92} style={styles.trigger} onPress={show}>
          <PlusIcon size={24} color={text.primary} weight="bold" />
        </PressScale>
      </View>
      <Modal visible={at != null} transparent animationType="none" onRequestClose={() => hide()} statusBarTranslucent>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => hide()} />
        </Animated.View>
        {at ? (
          <>
            {/* The trigger again, on top of the dimmed screen, turning into an X. */}
            <PressScale accessibilityRole="button" accessibilityLabel="Close" scaleTo={0.92} style={[styles.trigger, styles.close, { left: at.x, top: at.y }]} onPress={() => hide()}>
              <Animated.View style={turn}>
                <PlusIcon size={24} color="#FFFFFF" weight="bold" />
              </Animated.View>
            </PressScale>
            {actions.map((a, i) => (
              <Item key={a.key} action={a} index={i} open={open} origin={at} reduceMotion={reduceMotion} />
            ))}
          </>
        ) : null}
      </Modal>
    </>
  );
};

/** One action: grows out of the trigger to its spot below it (Make a room straight down, Join down and to the left). */
const Item = ({ action, index, open, origin, reduceMotion }: { action: Action; index: number; open: SharedValue<number>; origin: { x: number; y: number }; reduceMotion: boolean }) => {
  // Final spot, relative to the trigger's top-left.
  const dx = index === 0 ? -(ACTION + 28) : -(ACTION - SIZE) / 2;
  const dy = SIZE + (index === 0 ? 30 : 74);
  // Each item follows `open` a beat apart (stagger), and leaves together.
  const style = useAnimatedStyle(() => {
    const t = open.value;
    const p = index === 0 ? t : interpolate(t, [0.12, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(p, [0, 0.5], [0, 1], Extrapolation.CLAMP),
      transform: reduceMotion
        ? []
        : [{ translateX: interpolate(p, [0, 1], [-dx + (SIZE - ACTION) / 2, 0]) }, { translateY: interpolate(p, [0, 1], [-dy + (SIZE - ACTION) / 2, 0]) }, { scale: interpolate(p, [0, 1], [0.5, 1]) }],
    };
  });
  return (
    <Animated.View style={[styles.item, { left: origin.x + dx, top: origin.y + dy }, style]}>
      <PressScale accessibilityRole="button" accessibilityLabel={action.label} scaleTo={0.92} style={[styles.action, { backgroundColor: action.color }]} onPress={action.onPress}>
        {action.icon}
      </PressScale>
      <View style={styles.label}>
        <Text style={styles.labelText} numberOfLines={1}>
          {action.label}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  trigger: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  close: { position: "absolute", backgroundColor: text.primary },
  backdrop: { backgroundColor: "rgba(28,27,26,0.58)" },
  item: { position: "absolute", width: ACTION, alignItems: "center", overflow: "visible" },
  action: {
    width: ACTION,
    height: ACTION,
    borderRadius: ACTION / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  label: { position: "absolute", top: ACTION + 8, minWidth: 110, alignItems: "center" },
  labelText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
});
