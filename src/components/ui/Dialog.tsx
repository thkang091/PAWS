import type { ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { bg, motion, radius, space } from "@/constants/design";

export const Dialog = ({
  visible,
  reduceMotion,
  children,
  onRequestClose,
}: {
  visible: boolean;
  reduceMotion: boolean;
  children: ReactNode;
  onRequestClose: () => void;
}) => (
  <Modal transparent visible={visible} animationType="none" onRequestClose={onRequestClose}>
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
      exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
      style={styles.scrim}
    >
      <Animated.View
        entering={
          reduceMotion
            ? undefined
            : FadeIn.duration(motion.duration.enter).withInitialValues({
                transform: [{ scale: 0.94 }, { translateY: 10 }],
              })
        }
        exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
        style={styles.card}
      >
        {children}
      </Animated.View>
    </Animated.View>
  </Modal>
);

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(28, 27, 26, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xxl,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.sheet,
    backgroundColor: bg.surface,
    padding: space.xxl,
  },
});
