import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";

import { PrimaryCta } from "@/features/onboarding/components/PrimaryCta";
import { PressScale } from "@/components/ui/PressScale";
import { bg, layout, motion, radius, space, text, type } from "@/constants/design";

export const AnonymousAccountWarningModal = ({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Dismiss">
        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : FadeIn.duration(motion.duration.enter).withInitialValues({
                  transform: [{ scale: 0.94 }],
                })
          }
          exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
          style={styles.card}
        >
          <Pressable onPress={() => undefined}>
            <Text style={styles.title}>Sign out without saving?</Text>
            <Text style={styles.copy}>
              This account only exists on this device. Signing out now can permanently take the dog
              profile, memories, streak and rewards with it.
            </Text>

            <View style={styles.actions}>
              <PrimaryCta
                label="Add a way to sign in first"
                onPress={() => {
                  onCancel();
                  router.push("/account/link");
                }}
              />
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Sign out anyway"
                style={styles.quiet}
                onPress={onConfirm}
              >
                <Text style={styles.quietLabel}>Sign out anyway</Text>
              </PressScale>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: layout.gutter,
    backgroundColor: "rgba(28,27,26,0.28)",
  },
  card: {
    backgroundColor: bg.surface,
    borderRadius: radius.sheet,
    padding: space.xxl,
  },
  title: { ...type.sectionTitle, color: text.primary },
  copy: { ...type.body, color: text.secondary, marginTop: space.md },
  actions: { marginTop: space.xxl, gap: space.sm },
  quiet: {
    height: layout.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  quietLabel: { ...type.supporting, fontWeight: "500", color: text.secondary },
});
