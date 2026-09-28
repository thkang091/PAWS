import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CloudArrowUpIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { accent, border, icon, motion, radius, space, text, type } from "@/constants/design";

export const SaveProgressBanner = ({ forceVisible = false }: { forceVisible?: boolean }) => {
  const [dismissed, setDismissed] = useState(false);
  const status = useAccountStatus();
  const reduceMotion = useReducedMotion();

  if (dismissed || (!forceVisible && !status.data?.isAnonymous)) return null;

  return (
    <Animated.View
      exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
      style={styles.row}
    >
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Save your progress by linking an account"
        scaleTo={0.99}
        style={styles.action}
        onPress={() => {
          void Haptics.selectionAsync();
          router.push("/account/link");
        }}
      >
        <View style={styles.disc}>
          <CloudArrowUpIcon size={icon.inline} color={text.primary} weight="bold" />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>Save your progress</Text>
          <Text style={styles.sub} numberOfLines={2}>
            Streaks and rewards stay safe if you change phones.
          </Text>
        </View>

      </PressScale>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        scaleTo={0.9}
        hitSlop={8}
        style={styles.close}
        onPress={() => setDismissed(true)}
      >
        <XIcon size={14} color={text.tertiary} weight="bold" />
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: space.md,
    paddingRight: space.sm,
    marginBottom: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.md,
  },
  disc: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 2 },
  title: { ...type.supporting, fontWeight: "700", color: text.primary },
  sub: { ...type.caption, color: text.secondary },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
