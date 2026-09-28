import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CheckIcon, XIcon } from "phosphor-react-native";

import { Stepper } from "@/features/care/components/FoodPlanEditor";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

export type MealChoice = { name: string; grams: number; fed: boolean };

export const MealLogSheet = ({
  visible,
  choices,
  onLog,
  onClose,
}: {
  visible: boolean;
  choices: readonly MealChoice[];
  onLog: (meal: { name: string; grams: number }) => void;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const options = [...choices, { name: "Extra", grams: 50, fed: false }];
  const [picked, setPicked] = useState(0);
  const [grams, setGrams] = useState(options[0]?.grams ?? 100);

  useEffect(() => {
    if (!visible) return;
    const first = options.findIndex((option) => !option.fed);
    const index = first === -1 ? options.length - 1 : first;
    setPicked(index);
    setGrams(options[index].grams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const choose = (index: number) => {
    void Haptics.selectionAsync();
    setPicked(index);
    setGrams(options[index].grams);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {visible ? (
        <View style={styles.root}>
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
            style={styles.scrim}
          >
            <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Close" onPress={onClose} />
          </Animated.View>

          <Animated.View
            entering={
              reduceMotion
                ? FadeIn.duration(motion.duration.select)
                : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)
            }
            style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}
          >
            <View style={styles.grabber} />
            <View style={styles.head}>
              <Text style={styles.title}>Log a meal</Text>
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                scaleTo={0.9}
                style={styles.close}
                onPress={onClose}
              >
                <XIcon size={16} color={text.primary} weight="bold" />
              </PressScale>
            </View>

            <View style={styles.chips} accessibilityRole="radiogroup">
              {options.map((option, index) => {
                const on = index === picked;
                return (
                  <PressScale
                    key={option.name}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${option.name}${option.fed ? ", already logged today" : ""}`}
                    scaleTo={0.94}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => choose(index)}
                  >
                    {option.fed ? (
                      <CheckIcon size={12} color={on ? text.inverse : text.secondary} weight="bold" />
                    ) : null}
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.name}</Text>
                  </PressScale>
                );
              })}
            </View>

            <Stepper
              label="Portion"
              value={`${grams} g`}
              onStep={(dir) => setGrams((current) => Math.min(1500, Math.max(5, current + dir * 5)))}
            />

            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Log ${options[picked]?.name ?? "meal"}, ${grams} grams`}
              scaleTo={0.97}
              style={styles.save}
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                onLog({ name: options[picked]?.name ?? "Meal", grams });
              }}
            >
              <Text style={styles.saveText}>Log {options[picked]?.name.toLowerCase() ?? "meal"}</Text>
            </PressScale>
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(28,27,26,0.4)" },
  sheet: {
    paddingHorizontal: layout.gutter,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: bg.canvas,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: border.default,
    marginTop: space.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.lg,
  },
  title: { fontSize: 26, lineHeight: 30, letterSpacing: -0.6, fontWeight: "700", color: text.primary },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
  },
  chipOn: { backgroundColor: text.primary, borderColor: text.primary },
  chipText: { ...type.supporting, fontWeight: "600", color: text.primary },
  chipTextOn: { color: text.inverse },
  save: {
    height: layout.controlHeight,
    marginTop: space.xl,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { ...type.cardTitle, fontSize: 17, fontWeight: "700", color: text.primary },
});
