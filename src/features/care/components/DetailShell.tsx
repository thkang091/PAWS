import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretLeftIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

export const goBack = (fallback: string) => {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
};

const ACTION_CLEARANCE = 104;

export const DetailShell = ({
  title,
  glyph,
  action,
  back = "/(tabs)/care",
  children,
}: {
  title: string;
  glyph: ReactNode;
  action?: { label: string; icon: ReactNode; onPress: () => void; disabled?: boolean };
  back?: string;
  children: ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.roundButton}
          onPress={() => goBack(back)}
        >
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>

        <View style={styles.titleWrap}>
          {glyph}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              insets.bottom + space.xxl + (action ? ACTION_CLEARANCE : space.block),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>

      {action ? (
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.duration(motion.duration.enter)}
          style={[styles.dock, { paddingBottom: insets.bottom + space.lg }]}
        >
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={action.label}
            scaleTo={0.97}
            disabled={action.disabled}
            style={[styles.actionButton, action.disabled && styles.actionDisabled]}
            onPress={action.onPress}
          >
            {action.icon}
            <Text style={styles.actionLabel}>{action.label}</Text>
          </PressScale>
        </Animated.View>
      ) : null}
    </View>
  );
};

export const DetailEmpty = ({
  glyph,
  title,
  body,
}: {
  glyph: ReactNode;
  title: string;
  body: string;
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
      style={styles.empty}
    >
      <View style={styles.emptyDisc}>{glyph}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
    paddingBottom: space.sm,
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
  headerSpacer: { width: layout.iconButton, height: layout.iconButton },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1 },
  title: { ...type.sectionTitle, color: text.primary, flexShrink: 1 },

  content: { paddingHorizontal: layout.gutter },

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
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  actionDisabled: { backgroundColor: bg.subtle },
  actionLabel: { ...type.cardTitle, fontWeight: "700", color: text.primary },

  empty: { alignItems: "center", paddingTop: space.xl, paddingHorizontal: space.xl },
  emptyDisc: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { ...type.sectionTitle, color: text.primary, marginTop: space.lg },
  emptyBody: {
    ...type.supporting,
    color: text.tertiary,
    textAlign: "center",
    marginTop: space.sm,
    maxWidth: 260,
  },
});
