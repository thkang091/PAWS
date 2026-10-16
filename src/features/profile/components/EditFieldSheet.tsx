import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from "react-native-reanimated";

import { PressScale } from "@/components/ui/PressScale";
import {
  bg,
  border,
  layout,
  motion,
  radius,
  space,
  text,
  type,
} from "@/constants/design";

export type EditTarget = { label: string; value: string; options?: readonly string[] | null } | null;

export const EditFieldSheet = ({
  target,
  onCancel,
  onSave,
}: {
  target: EditTarget;
  onCancel: () => void;
  onSave: (value: string) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    // An unanswered question opens empty, not with the words "Not added" to delete first.
    if (target) setDraft(target.value === "Not added" ? "" : target.value);
  }, [target]);

  if (!target) return null;

  const unchanged = draft.trim() === target.value.trim() || draft.trim().length === 0;
  const options = target.options ?? null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onCancel}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
        exiting={reduceMotion ? undefined : FadeOut.duration(motion.duration.exit)}
        style={styles.scrim}
      >
        <Pressable style={styles.scrimHit} onPress={onCancel} accessibilityLabel="Cancel" />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.lift}
        pointerEvents="box-none"
      >
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.duration(motion.duration.enter)}
          exiting={reduceMotion ? undefined : SlideOutDown.duration(motion.duration.exit)}
          style={styles.sheet}
        >
          <View style={styles.grip} />
          <Text style={styles.label}>{target.label}</Text>
          {options ? (
            <View style={styles.options}>
              {options.map((option) => {
                const on = draft.trim().toLowerCase() === option.toLowerCase();
                return (
                  <PressScale
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={option}
                    scaleTo={0.95}
                    style={[styles.option, on && styles.optionOn]}
                    onPress={() => setDraft(option)}
                  >
                    <Text style={[styles.optionText, on && styles.optionTextOn]}>{option}</Text>
                  </PressScale>
                );
              })}
            </View>
          ) : null}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={options ? "Or write your own" : "Type it here"}
            autoFocus={!options}
            selectTextOnFocus
            style={styles.input}
            placeholderTextColor={text.tertiary}
            returnKeyType="done"
            onSubmitEditing={() => (unchanged ? onCancel() : onSave(draft.trim()))}
          />

          <View style={styles.actions}>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={styles.quiet}
              onPress={onCancel}
            >
              <Text style={styles.quietLabel}>Cancel</Text>
            </PressScale>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: unchanged }}
              disabled={unchanged}
              style={[styles.save, unchanged && styles.saveOff]}
              onPress={() => onSave(draft.trim())}
            >
              <Text style={[styles.saveLabel, unchanged && styles.saveLabelOff]}>Save</Text>
            </PressScale>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(28,27,26,0.28)",
  },
  scrimHit: { flex: 1 },
  lift: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: bg.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    paddingBottom: space.block,
  },
  grip: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: border.default,
    marginBottom: space.xl,
  },
  label: { ...type.eyebrow, color: text.tertiary },
  input: {
    ...type.sectionTitle,
    color: text.primary,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: border.default,
  },
  actions: { flexDirection: "row", gap: space.md, marginTop: space.xxl },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg, marginBottom: space.sm },
  option: { height: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, justifyContent: "center" },
  optionOn: { backgroundColor: text.primary, borderColor: text.primary },
  optionText: { ...type.supporting, color: text.primary },
  optionTextOn: { color: text.inverse, fontWeight: "600" },
  quiet: {
    flex: 1,
    height: layout.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
  },
  quietLabel: { ...type.supporting, fontWeight: "500", color: text.secondary },
  save: {
    flex: 1,
    height: layout.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: text.primary,
  },
  saveOff: { backgroundColor: bg.subtle },
  saveLabel: { ...type.supporting, fontWeight: "600", color: text.inverse },
  saveLabelOff: { color: text.disabled },
});
