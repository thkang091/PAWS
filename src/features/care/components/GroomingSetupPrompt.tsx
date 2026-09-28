import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ScissorsIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { deferGroomingPrompt } from "@/features/care/state/groomingSetup";
import { accent, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

export const GroomingSetupPrompt = ({ onSetUp }: { onSetUp: () => void }) => {
  const reduceMotion = useReducedMotion();

  const dismiss = () => {
    void Haptics.selectionAsync();
    deferGroomingPrompt();
  };

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={styles.card}>
      <View style={styles.disc}>
        <ScissorsIcon size={iconSize.standard} color={text.primary} weight="regular" />
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Set up grooming?</Text>
        <Text style={styles.body}>
          You skipped this during setup. Add a grooming routine so baths, nails and teeth stay on schedule.
        </Text>

        <View style={styles.actions}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Set up grooming"
            scaleTo={0.97}
            style={styles.primary}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSetUp();
            }}
          >
            <Text style={styles.primaryText}>Set up grooming</Text>
          </PressScale>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Ask me later"
            scaleTo={0.97}
            style={styles.secondary}
            onPress={dismiss}
          >
            <Text style={styles.secondaryText}>Later</Text>
          </PressScale>
        </View>
      </View>

      <PressScale accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.close} onPress={dismiss}>
        <XIcon size={14} color={text.tertiary} weight="bold" />
      </PressScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: space.md,
    marginTop: space.xxl,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: accent.soft,
  },
  disc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  title: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  body: { ...type.caption, color: text.secondary, marginTop: 4, lineHeight: 17 },

  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  primary: {
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
  },
  primaryText: { ...type.caption, fontWeight: "700", color: text.inverse },
  secondary: { paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.pill },
  secondaryText: { ...type.caption, fontWeight: "600", color: text.secondary },

  close: { padding: 4, marginTop: -2, marginRight: -2 },
});
