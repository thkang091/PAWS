import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";
import Animated, { FadeIn, SlideInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { XIcon } from "phosphor-react-native";

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

export const DetailSheet = ({
  open,
  title,
  saveLabel,
  saving = false,
  canSave = true,
  onClose,
  onSave,
  children,
}: {
  open: boolean;
  title: string;
  saveLabel: string;
  saving?: boolean;
  canSave?: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
        style={styles.scrim}
      >
        <Pressable style={styles.scrimHit} onPress={onClose} accessibilityLabel="Close" />

        <Animated.View
          entering={
            reduceMotion
              ? undefined
              : SlideInDown.duration(motion.duration.reveal).easing(motion.easing.drawer)
          }
          style={[styles.sheet, { paddingBottom: insets.bottom + space.xxl }]}
        >
          <View style={styles.grabber} />

          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}
              onPress={onClose}
            >
              <XIcon size={iconSize.standard} color={text.primary} weight="bold" />
            </PressScale>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>

          <PressScale
            accessibilityRole="button"
            accessibilityLabel={saveLabel}
            scaleTo={0.97}
            disabled={!canSave || saving}
            style={[styles.save, (!canSave || saving) && styles.saveOff]}
            onPress={() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSave();
            }}
          >
            <Text style={[styles.saveText, (!canSave || saving) && styles.saveTextOff]}>
              {saving ? "Saving…" : saveLabel}
            </Text>
          </PressScale>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.inputTall]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={text.tertiary}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

export const ChipRow = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {options.map((option) => {
        const on = option.key === value;
        return (
          <PressScale
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            scaleTo={0.95}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.key);
            }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{option.label}</Text>
          </PressScale>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.38)", justifyContent: "flex-end" },
  scrimHit: { flex: 1 },
  sheet: {
    maxHeight: "88%",
    backgroundColor: bg.canvas,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: border.default,
    alignSelf: "center",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
  },
  title: { ...type.pageTitle, color: text.primary, flexShrink: 1 },
  close: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },

  body: { marginTop: space.sm },
  bodyContent: { paddingBottom: space.lg },

  field: { marginTop: space.xl },
  fieldLabel: { ...type.supporting, fontWeight: "600", color: text.secondary },
  input: {
    marginTop: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.subtle,
    ...type.body,
    color: text.primary,
  },
  inputTall: { height: 88, textAlignVertical: "top" },

  chips: { gap: space.sm, paddingTop: space.sm, paddingRight: space.xl },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
  },
  chipOn: { backgroundColor: accent.primary, borderColor: accent.primary },
  chipText: { ...type.supporting, color: text.secondary },
  chipTextOn: { color: text.primary, fontWeight: "600" },

  save: {
    height: layout.controlHeight,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xl,
  },
  saveOff: { backgroundColor: bg.subtle },
  saveText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  saveTextOff: { color: text.disabled },
});
