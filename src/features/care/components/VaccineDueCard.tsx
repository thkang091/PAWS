import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ArrowRightIcon, SyringeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import type { VaccineDuty } from "@/features/care/state/careOnboarding";
import {
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

export const VaccineDueCard = memo(
  ({
    duty,
    reduceMotion,
    onPress,
  }: {
    duty: VaccineDuty;
    reduceMotion: boolean;
    onPress: () => void;
  }) => (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={`${duty.label} still to book. Find a vet.`}
        scaleTo={0.98}
        style={styles.card}
        onPress={onPress}
      >
        <View style={styles.mark}>
          <SyringeIcon size={iconSize.standard} color={text.primary} weight="regular" />
        </View>

        <View style={styles.copy}>
          <Text style={styles.title}>{duty.label} still to book</Text>
          <Text style={styles.note}>PAWS will ask again tomorrow</Text>
        </View>

        <ArrowRightIcon size={iconSize.inline} color={text.secondary} weight="bold" />
      </PressScale>
    </Animated.View>
  ),
);

VaccineDueCard.displayName = "VaccineDueCard";

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.soft,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  title: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  note: { ...type.caption, color: text.tertiary, marginTop: 2 },
});
