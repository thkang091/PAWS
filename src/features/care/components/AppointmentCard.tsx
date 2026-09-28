import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { PhoneIcon, SyringeIcon } from "phosphor-react-native";

import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { PressScale } from "@/components/ui/PressScale";
import { openLink } from "@/lib/openLink";
import type { CareAppointment } from "@/features/care/state/careOnboarding";
import {
  accent,
  bg,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate(),
  ).padStart(2, "0")}`;
};

export const AppointmentCard = memo(
  ({
    appointment,
    reduceMotion,
    onUnreachable,
  }: {
    appointment: CareAppointment;
    reduceMotion: boolean;
    onUnreachable?: (message: string) => void;
  }) => {
    const today = appointment.dayKey === todayKey();

    return (
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
        style={styles.card}
      >
        <View style={styles.head}>
          <View style={styles.disc}>
            <SyringeIcon size={iconSize.standard} color={text.primary} weight="regular" />
          </View>

          <View style={styles.copy}>
            <Text style={styles.label}>
              {today ? "Vet appointment today" : "Vet appointment"}
            </Text>
            <Text style={styles.clinic} numberOfLines={2}>
              {appointment.clinic}
            </Text>
            <Text style={styles.when}>
              {today ? prettyTime(appointment.time) : `${appointment.day} · ${prettyTime(appointment.time)}`}
            </Text>
          </View>
        </View>

        {appointment.phone ? (
          <PressScale
            accessibilityRole="link"
            accessibilityLabel={`Call ${appointment.clinic} on ${appointment.phone}`}
            scaleTo={0.97}
            style={styles.call}
            onPress={() => {
              void Haptics.selectionAsync();
              void openLink(`tel:${appointment.phone?.replace(/[^\d+]/g, "")}`).then(
                (opened) =>
                  !opened &&
                  onUnreachable?.(`No dialler here. Call ${appointment.phone}.`),
              );
            }}
          >
            <PhoneIcon size={iconSize.inline} color={text.primary} weight="bold" />
            <Text style={styles.callText}>{appointment.phone}</Text>
          </PressScale>
        ) : null}
      </Animated.View>
    );
  },
);

AppointmentCard.displayName = "AppointmentCard";

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: accent.deep,
    backgroundColor: accent.soft,
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  disc: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, gap: 2 },
  label: { ...type.caption, color: text.secondary },
  clinic: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  when: { ...type.supporting, color: text.primary },

  call: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: bg.canvas,
  },
  callText: { ...type.supporting, fontWeight: "600", color: text.primary },
});
