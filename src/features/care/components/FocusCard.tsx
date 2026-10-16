import type { ComponentType, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ArrowRightIcon, type IconProps } from "phosphor-react-native";

import { CareDog } from "@/features/care/components/CareDog";
import { MISSED } from "@/features/care/components/WeekMarks";
import { PressScale } from "@/components/ui/PressScale";
import { accent, icon as iconSize, motion, space, text, type } from "@/constants/design";

export type Focus = {
  key: string;
  /** Small caps line above, e.g. "MOST IMPORTANT" or "NEXT, IN 2 H". */
  eyebrow: string;
  title: string;
  detail: string;
  Glyph: ComponentType<IconProps>;
  action?: { label: string; run: () => void };
  /** A warning (missed check-ins): red tile and label. */
  alert?: boolean;
};

/**
 * One piece of news at the top of the Care tab, always in the same shape so the row reads as one thing: the icon
 * tile, a small label, a bold title, one line, and one action. `detailNode` replaces the line when it needs more
 * than words (the week of check-ins). `art` adds the dog, for when the card stands alone.
 */
export const FocusCard = ({
  focus,
  reduceMotion,
  art = true,
  detailNode,
}: {
  focus: Focus;
  reduceMotion: boolean;
  art?: boolean;
  detailNode?: ReactNode;
}) => (
  <Animated.View
    key={focus.key}
    entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
    style={styles.root}
    accessibilityRole="summary"
    accessibilityLabel={`${focus.eyebrow}. ${focus.title}. ${focus.detail}`}
  >
    <View style={[styles.tile, focus.alert && styles.tileAlert]}>
      <focus.Glyph size={iconSize.feature} color={focus.alert ? text.inverse : text.primary} weight={focus.alert ? "fill" : "regular"} />
    </View>
    <View style={styles.copy}>
      <Text style={[styles.eyebrow, focus.alert && styles.eyebrowAlert]} numberOfLines={1}>
        {focus.eyebrow}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {focus.title}
      </Text>
      <View style={styles.detailRow}>
        {detailNode ?? (
          <Text style={styles.detail} numberOfLines={1}>
            {focus.detail}
          </Text>
        )}
      </View>
      {focus.action ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={focus.action.label}
          hitSlop={8}
          scaleTo={0.95}
          style={styles.action}
          onPress={focus.action.run}
        >
          <Text style={styles.actionText}>{focus.action.label}</Text>
          <ArrowRightIcon size={13} color={text.primary} weight="bold" />
        </PressScale>
      ) : null}
    </View>
    {art ? (
      <View style={styles.art} pointerEvents="none">
        <CareDog art="walk" width={92} />
      </View>
    ) : null}
  </Animated.View>
);

const styles = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "center", gap: space.md },
  tile: { width: 56, height: 56, borderRadius: 28, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  tileAlert: { backgroundColor: MISSED },
  copy: { flex: 1 },
  eyebrow: { ...type.eyebrow, fontSize: 11, color: text.secondary },
  eyebrowAlert: { color: MISSED },
  title: { fontSize: 22, lineHeight: 27, letterSpacing: -0.4, fontWeight: "700", color: text.primary, marginTop: 2 },
  detailRow: { minHeight: 22, justifyContent: "center", marginTop: 2 },
  detail: { ...type.supporting, color: text.secondary },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: space.sm,
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: 16,
    backgroundColor: accent.deep,
  },
  actionText: { ...type.caption, fontWeight: "700", color: text.primary },
  art: { marginRight: -space.sm, alignSelf: "flex-end" },
});
