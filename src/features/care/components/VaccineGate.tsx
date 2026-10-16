import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { CalendarCheckIcon, SyringeIcon, WarningCircleIcon } from "phosphor-react-native";

import { MonthPicker, type PickedDay } from "@/features/care/components/MonthPicker";
import { TimeGrid } from "@/features/care/components/TimeGrid";
import { TIME_SLOTS } from "@/features/care/components/careSetupAnswers";
import { Dialog } from "@/components/ui/Dialog";
import { PressScale } from "@/components/ui/PressScale";
import {
  deferVaccineBooking,
  recordVaccineBooking,
  type VaccineDuty,
} from "@/features/care/state/careOnboarding";
import {
  accent,
  bg,
  border,
  icon as iconSize,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

const CLINIC_HOURS = TIME_SLOTS.filter((time) => {
  const hour = Number(time.slice(0, 2));
  return hour >= 8 && hour <= 18;
});

type Step = "ask" | "why" | "when";

export const VaccineGate = ({
  duty,
  reduceMotion,
  onFindVet,
}: {
  duty: VaccineDuty;
  reduceMotion: boolean;
  onFindVet: () => void;
}) => {
  const [step, setStep] = useState<Step>("ask");
  const [day, setDay] = useState<PickedDay | null>(null);

  const save = (time: string) => {
    if (!day) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    recordVaccineBooking({
      clinic: `${duty.label} appointment`,
      day: day.label,
      dayKey: day.key,
      time,
      phone: null,
      address: null,
    });
  };

  const later = () => {
    void Haptics.selectionAsync();
    deferVaccineBooking();
  };

  return (
    <Dialog visible reduceMotion={reduceMotion} onRequestClose={() => {}}>
      <Animated.View
        layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter)}
      >
        <View style={[styles.mark, step === "why" && styles.markWarn]}>
          {step === "when" ? (
            <CalendarCheckIcon size={iconSize.feature} color={text.primary} weight="regular" />
          ) : step === "why" ? (
            <WarningCircleIcon size={iconSize.feature} color={text.primary} weight="regular" />
          ) : (
            <SyringeIcon size={iconSize.feature} color={text.primary} weight="regular" />
          )}
        </View>

        {step === "ask" ? (
          <Animated.View
            key="ask"
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
          >
            <Text style={styles.title}>Have you booked {duty.label}?</Text>
            <Text style={styles.body}>
              You told PAWS it has not been given yet. If a vet has it in the diary, say
              when and PAWS will keep it with the rest of the week.
            </Text>

            <View style={styles.actions}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Not yet"
                scaleTo={0.97}
                style={styles.quiet}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStep("why");
                }}
              >
                <Text style={styles.quietText}>Not yet</Text>
              </PressScale>

              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Yes, it is booked"
                scaleTo={0.97}
                style={styles.primary}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStep("when");
                }}
              >
                <Text style={styles.primaryText}>It is booked</Text>
              </PressScale>
            </View>
          </Animated.View>
        ) : null}

        {step === "why" ? (
          <Animated.View
            key="why"
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
          >
            <Text style={styles.title}>This one really does matter</Text>
            <Text style={styles.body}>
              Core shots are what boarding kennels, groomers and most travel ask to see,
              and the diseases they cover are the ones that kill unvaccinated dogs. PAWS
              will ask again tomorrow.
            </Text>

            <View style={styles.actions}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Remind me tomorrow"
                scaleTo={0.97}
                style={styles.quiet}
                onPress={later}
              >
                <Text style={styles.quietText}>Remind me tomorrow</Text>
              </PressScale>

              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Find a vet now"
                scaleTo={0.97}
                style={styles.primary}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onFindVet();
                }}
              >
                <Text style={styles.primaryText}>Find a vet</Text>
              </PressScale>
            </View>
          </Animated.View>
        ) : null}

        {step === "when" ? (
          <Animated.View
            key="when"
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
          >
            <Text style={styles.title}>When is it?</Text>
            <Text style={styles.body}>
              PAWS did not make the booking so it cannot see the date. Tell it once and it
              will carry the reminder.
            </Text>

            <ScrollView style={styles.picker} showsVerticalScrollIndicator={false}>
              <MonthPicker
                selected={day?.key ?? null}
                reduceMotion={reduceMotion}
                onPick={setDay}
              />
              <Animated.View
                style={!day && styles.waiting}
                pointerEvents={day ? "auto" : "none"}
              >
                <TimeGrid
                  slots={[]}
                  times={CLINIC_HOURS}
                  animateIn={false}
                  reduceMotion={reduceMotion}
                  onToggle={save}
                />
              </Animated.View>
            </ScrollView>

            <View style={styles.actions}>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Go back"
                scaleTo={0.97}
                style={styles.quiet}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStep("ask");
                }}
              >
                <Text style={styles.quietText}>Back</Text>
              </PressScale>

              <Text style={styles.hint}>
                {day ? `${day.label}. Pick a time.` : "Pick the day first."}
              </Text>
            </View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  mark: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: accent.soft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.lg,
  },
  markWarn: { backgroundColor: accent.primary },

  title: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary },
  body: { ...type.supporting, color: text.secondary, marginTop: space.sm, lineHeight: 21 },

  picker: { maxHeight: 340, marginTop: space.lg },
  waiting: { opacity: 0.35 },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.sm,
    marginTop: space.xl,
  },
  quiet: {
    paddingHorizontal: space.lg,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: bg.surface,
  },
  quietText: { ...type.supporting, fontWeight: "600", color: text.primary },
  primary: {
    paddingHorizontal: space.xl,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { ...type.supporting, fontWeight: "600", color: text.primary },
  hint: { ...type.caption, color: text.tertiary, flex: 1, textAlign: "right" },
});
