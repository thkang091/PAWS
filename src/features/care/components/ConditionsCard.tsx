import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition, ZoomIn, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { PlusIcon, XIcon } from "phosphor-react-native";

import { FieldLabel, FlowSheet } from "@/features/care/components/FlowSheet";
import {
  SUGGESTIONS,
  addRecordItem,
  removeRecordItem,
  useHealthRecord,
  type RecordItem,
  type RecordKind,
} from "@/features/care/state/healthRecord";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, space, text, type } from "@/constants/design";

const GROUPS: readonly { kind: RecordKind; title: string; empty: string }[] = [
  { kind: "condition", title: "Conditions", empty: "None on file" },
  { kind: "allergy", title: "Allergies", empty: "None on file" },
];

export const ConditionsCard = ({ dogName, bare = false }: { dogName: string; bare?: boolean }) => {
  const reduceMotion = useReducedMotion();
  const { items } = useHealthRecord();
  const [adding, setAdding] = useState<RecordKind | null>(null);
  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);

  const remove = (item: RecordItem) => {
    Alert.alert(`Remove ${item.name}?`, `It comes off ${dogName}'s record and the emergency brief.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void Haptics.selectionAsync();
          removeRecordItem(item.id);
        },
      },
    ]);
  };

  return (
    <View style={bare ? styles.bare : styles.card}>
      {bare ? null : (
        <>
          <Text style={styles.title}>Conditions and allergies</Text>
          <Text style={styles.lede}>What a vet or sitter should know. It goes into the emergency brief too.</Text>
        </>
      )}

      {GROUPS.map((group) => {
        const list = items.filter((item) => item.kind === group.kind);
        return (
          <Animated.View key={group.kind} layout={settle} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={styles.groupCount}>{list.length ? String(list.length) : group.empty}</Text>
            </View>
            <View style={styles.chips}>
              {list.map((item) => (
                <Animated.View
                  key={item.id}
                  entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.select).easing(motion.easing.out)}
                  layout={settle}
                >
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}. Remove`}
                    scaleTo={0.95}
                    style={[styles.chip, group.kind === "allergy" && styles.chipAllergy]}
                    onPress={() => remove(item)}
                  >
                    <Text style={styles.chipText}>{item.name}</Text>
                    <XIcon size={12} color={text.secondary} weight="bold" />
                  </PressScale>
                </Animated.View>
              ))}
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Add ${group.kind === "allergy" ? "an allergy" : "a condition"}`}
                scaleTo={0.95}
                style={styles.add}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setAdding(group.kind);
                }}
              >
                <PlusIcon size={13} color={text.primary} weight="bold" />
                <Text style={styles.addText}>Add</Text>
              </PressScale>
            </View>
          </Animated.View>
        );
      })}

      <AddSheet kind={adding} existing={items} onClose={() => setAdding(null)} />
    </View>
  );
};

const AddSheet = ({
  kind,
  existing,
  onClose,
}: {
  kind: RecordKind | null;
  existing: readonly RecordItem[];
  onClose: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState<RecordKind>("condition");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!kind) return;
    setShown(kind);
    setName("");
    setNote("");
  }, [kind]);

  const taken = new Set(existing.filter((item) => item.kind === shown).map((item) => item.name.toLowerCase()));
  const suggestions = SUGGESTIONS[shown].filter((item) => !taken.has(item.toLowerCase()));

  const save = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addRecordItem(shown, name, note);
    onClose();
  };

  return (
    <FlowSheet
      open={Boolean(kind)}
      title={shown === "allergy" ? "Add an allergy" : "Add a condition"}
      lede={shown === "allergy" ? "Foods, medicines or anything in the environment." : "Anything diagnosed, or that a vet is keeping an eye on."}
      step={0}
      total={1}
      direction={1}
      primary={{ label: name.trim() ? `Add ${name.trim()}` : "Add", disabled: name.trim().length < 2, onPress: save }}
      onBack={onClose}
      onClose={onClose}
    >
      <View style={styles.segment}>
        {(["condition", "allergy"] as const).map((option) => {
          const on = option === shown;
          return (
            <PressScale
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={option === "allergy" ? "Allergy" : "Condition"}
              scaleTo={0.97}
              style={[styles.segmentItem, on && styles.segmentOn]}
              onPress={() => {
                void Haptics.selectionAsync();
                setShown(option);
                setName("");
              }}
            >
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{option === "allergy" ? "Allergy" : "Condition"}</Text>
            </PressScale>
          );
        })}
      </View>

      {suggestions.length > 0 ? (
        <>
          <FieldLabel>Common ones</FieldLabel>
          <Animated.View key={shown} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.chips}>
            {suggestions.map((item) => {
              const on = item === name;
              return (
                <PressScale
                  key={item}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={item}
                  scaleTo={0.95}
                  style={[styles.pick, on && styles.pickOn]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setName(on ? "" : item);
                  }}
                >
                  <Text style={[styles.pickText, on && styles.pickTextOn]}>{item}</Text>
                </PressScale>
              );
            })}
          </Animated.View>
        </>
      ) : null}

      <FieldLabel>Or type it</FieldLabel>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={shown === "allergy" ? "Chicken, for example" : "Arthritis, for example"}
        placeholderTextColor={text.tertiary}
        accessibilityLabel="Name"
      />
      <TextInput
        style={[styles.input, styles.inputGap]}
        value={note}
        onChangeText={setNote}
        placeholder="Note, optional. What happens, what helps"
        placeholderTextColor={text.tertiary}
        accessibilityLabel="Note"
      />
    </FlowSheet>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: space.section },
  bare: { marginTop: space.sm },
  title: { ...type.sectionTitle, color: text.primary },
  lede: { ...type.supporting, color: text.secondary, marginTop: 4 },
  group: { marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  groupHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: space.md },
  groupTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  groupCount: { ...type.caption, color: text.tertiary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  chipAllergy: { backgroundColor: bg.canvas, borderWidth: 1.5, borderColor: accent.band },
  chipText: { ...type.supporting, fontWeight: "600", color: text.primary },
  add: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.default,
    borderStyle: "dashed",
  },
  addText: { ...type.supporting, fontWeight: "600", color: text.primary },

  segment: { flexDirection: "row", marginTop: space.xl, padding: 4, borderRadius: radius.pill, backgroundColor: bg.subtle },
  segmentItem: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: bg.canvas },
  segmentText: { ...type.supporting, fontWeight: "600", color: text.tertiary },
  segmentTextOn: { color: text.primary },
  pick: { paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.soft },
  pickOn: { backgroundColor: accent.primary, borderColor: accent.deep },
  pickText: { ...type.supporting, color: text.secondary },
  pickTextOn: { color: text.primary, fontWeight: "600" },
  input: {
    height: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: border.soft,
    backgroundColor: bg.subtle,
    ...type.body,
    color: text.primary,
  },
  inputGap: { marginTop: space.sm },
});
