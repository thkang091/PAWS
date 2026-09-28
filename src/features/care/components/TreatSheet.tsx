import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { MagnifyingGlassIcon, PawPrintIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

export const TreatSheet = ({
  visible,
  dogName,
  given,
  allowed,
  treats,
  onLog,
  onSearch,
  onClose,
}: {
  visible: boolean;
  dogName: string;
  given: number;
  allowed: number;
  treats: readonly string[];
  onLog: (name: string | null) => void;
  onSearch: () => void;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const over = given >= allowed;

  const log = (name: string | null) => {
    void Haptics.notificationAsync(
      over ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    );
    onLog(name);
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
            <Text style={styles.title}>Log a treat</Text>
            <Text style={[styles.count, over && styles.countOver]}>
              {over
                ? `${given} of ${allowed} given today. Another one goes over ${dogName}'s plan.`
                : `${given} of ${allowed} given today`}
            </Text>

            <Text style={styles.label}>{treats.length > 0 ? `${dogName}'s treats` : "Quick log"}</Text>
            <View style={styles.chips}>
              {treats.map((name) => (
                <PressScale
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${name}`}
                  scaleTo={0.94}
                  style={styles.chip}
                  onPress={() => log(name)}
                >
                  <PawPrintIcon size={14} color={text.primary} weight="fill" />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {name}
                  </Text>
                </PressScale>
              ))}
              <PressScale
                accessibilityRole="button"
                accessibilityLabel="Log a treat without a name"
                scaleTo={0.94}
                style={[styles.chip, styles.chipPlain]}
                onPress={() => log(null)}
              >
                <Text style={styles.chipText}>Just a treat</Text>
              </PressScale>
            </View>

            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Search all treats"
              scaleTo={0.97}
              style={styles.search}
              onPress={onSearch}
            >
              <MagnifyingGlassIcon size={iconSize.standard} color={text.primary} weight="bold" />
              <Text style={styles.searchText}>Search all treats</Text>
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
    marginBottom: space.lg,
  },
  title: { fontSize: 26, lineHeight: 30, letterSpacing: -0.6, fontWeight: "700", color: text.primary },
  count: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  countOver: { color: text.primary, fontWeight: "600" },
  label: { ...type.supporting, fontWeight: "600", color: text.secondary, marginTop: space.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    maxWidth: "100%",
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  chipPlain: { backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.default },
  chipText: { ...type.supporting, fontWeight: "600", color: text.primary, flexShrink: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    height: layout.controlHeight,
    marginTop: space.xl,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  searchText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
});
