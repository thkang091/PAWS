import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInUp, FadeOutUp, useAnimatedProps, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { CheckIcon, CrownSimpleIcon } from "phosphor-react-native";

import type { RacePlayer } from "../../../../supabase/functions/tournament/numberContract";
import { PHASE_LABELS } from "@/features/numberTrail/raceCopy";
import { NT } from "@/features/numberTrail/theme";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Connected to the room's live channel, or catching up. */
export const ConnectionPill = ({ live, dark = false }: { live: boolean; dark?: boolean }) => (
  <View style={[styles.pill, dark && styles.pillDark]} accessibilityLabel={live ? "Connected" : "Reconnecting"} accessibilityLiveRegion="polite">
    <View style={[styles.pillDot, { backgroundColor: live ? "#2F8F4E" : accent.band }]} />
    <Text style={[styles.pillText, dark && styles.pillTextDark]}>{live ? "Live" : "Reconnecting"}</Text>
  </View>
);

/**
 * Something is happening that takes an unknown time: a dashed street path that keeps walking. Never a percentage,
 * because the server doesn't report one. Constant motion, so linear; reduced motion shows it still.
 */
export const IndeterminateTrail = memo(({ width = 120 }: { width?: number }) => {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
  }, [reduceMotion, t]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: -t.value * 20 }));
  return (
    <Svg width={width} height={22} viewBox="0 0 120 22" accessibilityRole="progressbar" accessibilityLabel="Working">
      <Path d="M4 16 L34 16 L34 6 L70 6 L70 16 L116 16" stroke={border.default} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <AnimatedPath d="M4 16 L34 16 L34 6 L70 6 L70 16 L116 16" stroke={NT.one} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[8, 12]} animatedProps={props} />
    </Svg>
  );
});
IndeterminateTrail.displayName = "IndeterminateTrail";

export const Avatar = ({ name, size = 40, online }: { name: string; size?: number; online?: boolean }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{name.slice(0, 1).toUpperCase()}</Text>
    {online !== undefined ? <View style={[styles.presence, online && styles.presenceOn]} /> : null}
  </View>
);

/** Who's here. In the lobby: ready and connection. In the race: where each player is, by phase, never where they are on the map. */
export const RacePlayerList = ({ players, me, online, racing = false }: { players: readonly RacePlayer[]; me: string; online?: Set<string>; racing?: boolean }) => (
  <View style={styles.list}>
    {players.map((p, i) => {
      const here = online?.has(p.userId);
      const note = racing ? (p.status === "left" ? "Left" : p.finished ? "Finished" : p.phase ? PHASE_LABELS[p.phase] : "Getting ready") : !p.inRoom ? "Left" : here === undefined ? "" : here ? "Here" : "Away";
      return (
        <View key={p.userId} style={[styles.row, i > 0 && styles.rowRule]} accessible accessibilityLabel={`${p.name}${p.userId === me ? ", you" : ""}${p.isHost ? ", host" : ""}. ${racing ? note : p.ready || p.isHost ? "Ready" : "Not ready"}`}>
          <Avatar name={p.name} online={racing ? undefined : here} />
          <View style={styles.flex}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {p.userId === me ? `${p.name} (you)` : p.name}
              </Text>
              {p.isHost ? <CrownSimpleIcon size={15} color={accent.band} weight="fill" /> : null}
            </View>
            {note ? <Text style={styles.note} numberOfLines={1}>{note}</Text> : null}
          </View>
          {racing ? (
            <DigitDots done={p.finished ? 2 : p.digitsDone} />
          ) : (
            <View style={[styles.ready, (p.ready || p.isHost) && styles.readyOn]}>
              {p.ready || p.isHost ? <CheckIcon size={13} color={text.primary} weight="bold" /> : null}
              <Text style={styles.readyText}>{p.ready || p.isHost ? "Ready" : "Not ready"}</Text>
            </View>
          )}
        </View>
      );
    })}
  </View>
);

/** Two marks, one per digit, filled when the server has checked it. */
export const DigitDots = ({ done, total = 2 }: { done: number; total?: number }) => (
  <View style={styles.dots} accessibilityLabel={`${done} of ${total} digits done`}>
    <View style={[styles.dot, done >= 1 && { backgroundColor: NT.one, borderColor: NT.one }]} />
    {total > 1 ? <View style={[styles.dot, done >= 2 && { backgroundColor: NT.two, borderColor: NT.two }]} /> : null}
  </View>
);

export type Toast = { id: string; text: string };

/** Short notes about other players, one direction in and out, never more than two. */
export const Toasts = ({ toasts, top }: { toasts: readonly Toast[]; top: number }) => {
  const reduceMotion = useReducedMotion();
  return (
    <View pointerEvents="none" style={[styles.toasts, { top }]} accessibilityLiveRegion="polite">
      {toasts.map((t) => (
        <Animated.View key={t.id} entering={reduceMotion ? undefined : FadeInUp.duration(220).easing(motion.easing.out)} exiting={reduceMotion ? undefined : FadeOutUp.duration(160)} style={styles.toast}>
          <Text style={styles.toastText} numberOfLines={2}>
            {t.text}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.soft },
  pillDark: { backgroundColor: "rgba(28,27,26,0.06)", borderColor: "transparent" },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: "800", color: text.primary },
  pillTextDark: { color: text.primary },
  avatar: { backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800", color: text.primary },
  presence: { position: "absolute", right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, backgroundColor: border.default, borderWidth: 2, borderColor: bg.surface },
  presenceOn: { backgroundColor: "#2F8F4E" },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, minHeight: 64, paddingVertical: space.sm },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { ...type.cardTitle, fontWeight: "700", color: text.primary, flexShrink: 1 },
  note: { ...type.caption, color: text.secondary, marginTop: 1 },
  ready: { flexDirection: "row", alignItems: "center", gap: 4, height: 26, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: bg.subtle },
  readyOn: { backgroundColor: accent.deep },
  readyText: { fontSize: 11, fontWeight: "800", color: text.primary },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: border.default, backgroundColor: bg.surface },
  toasts: { position: "absolute", left: space.lg, right: space.lg, alignItems: "center", gap: space.sm, zIndex: 50 },
  toast: { maxWidth: 360, paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: text.primary },
  toastText: { fontSize: 14, fontWeight: "700", color: text.inverse, textAlign: "center" },
});
