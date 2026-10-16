import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { BowlFoodIcon, CaretDownIcon, CheckIcon, MinusIcon, PawPrintIcon, PlusIcon, WarningIcon, XIcon } from "phosphor-react-native";

import type { Check, Facts, Mark } from "@/features/care/food/foodPlanMath";
import type { Product } from "@/services/productLookup";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, motion, radius, scene, space, text, type } from "@/constants/design";

/** A row of the "is this still right?" list: label and current value, opening an editor in place. */
export const ProfileRow = ({
  label,
  value,
  flag,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  flag?: "needed" | "check" | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)} style={styles.row}>
      <PressScale
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${label}, ${value}. ${open ? "Close" : "Change"}`}
        scaleTo={0.99}
        style={styles.rowHead}
        onPress={() => {
          void Haptics.selectionAsync();
          onToggle();
        }}
      >
        <View style={styles.rowCopy}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={[styles.rowValue, flag === "needed" && styles.rowValueNeeded]} numberOfLines={2}>
            {value}
          </Text>
        </View>
        {flag ? (
          <View style={[styles.flag, flag === "needed" ? styles.flagNeeded : styles.flagCheck]}>
            <Text style={styles.flagText}>{flag === "needed" ? "Needed" : "Check"}</Text>
          </View>
        ) : null}
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <CaretDownIcon size={16} color={text.tertiary} weight="bold" />
        </View>
      </PressScale>
      {open ? (
        <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.rowBody}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

/** Pick one, each option with a line that helps you choose. */
export const OptionList = <T extends string>({
  options,
  value,
  suggested,
  onChange,
}: {
  options: readonly { value: T; label: string; hint: string }[];
  value: T | null;
  suggested?: T | null;
  onChange: (value: T) => void;
}) => (
  <View style={styles.options}>
    {options.map((option) => {
      const on = option.value === value;
      return (
        <PressScale
          key={option.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          accessibilityLabel={`${option.label}. ${option.hint}`}
          scaleTo={0.98}
          style={[styles.option, on && styles.optionOn]}
          onPress={() => {
            void Haptics.selectionAsync();
            onChange(option.value);
          }}
        >
          <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
          <View style={styles.optionCopy}>
            <Text style={styles.optionLabel}>
              {option.label}
              {suggested === option.value && !on ? <Text style={styles.suggested}>{"  Suggested"}</Text> : null}
            </Text>
            <Text style={styles.optionHint}>{option.hint}</Text>
          </View>
        </PressScale>
      );
    })}
  </View>
);

/** A small on/off line for optional preferences. */
export const Toggle = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <PressScale
    accessibilityRole="checkbox"
    accessibilityState={{ checked: on }}
    accessibilityLabel={label}
    scaleTo={0.98}
    style={styles.toggle}
    onPress={() => {
      void Haptics.selectionAsync();
      onPress();
    }}
  >
    <View style={[styles.box, on && styles.boxOn]}>{on ? <CheckIcon size={13} color={text.primary} weight="bold" /> : null}</View>
    <Text style={styles.toggleText}>{label}</Text>
  </PressScale>
);

/** Names on a list (conditions, allergies) that can be removed or added to. */
export const TagEditor = ({
  items,
  suggestions,
  placeholder,
  onAdd,
  onRemove,
}: {
  items: readonly { id: string; name: string; locked?: boolean }[];
  suggestions: readonly string[];
  placeholder: string;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}) => {
  const [draft, setDraft] = useState("");
  const left = suggestions.filter((s) => !items.some((i) => i.name.toLowerCase() === s.toLowerCase())).slice(0, 6);
  return (
    <View>
      {items.length ? (
        <View style={styles.tags}>
          {items.map((item) => (
            <View key={item.id} style={styles.tag}>
              <Text style={styles.tagText}>{item.name}</Text>
              {item.locked ? null : (
                <PressScale accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} hitSlop={8} scaleTo={0.85} onPress={() => onRemove(item.id)}>
                  <XIcon size={12} color={text.secondary} weight="bold" />
                </PressScale>
              )}
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={text.tertiary}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (draft.trim().length < 2) return;
            onAdd(draft.trim());
            setDraft("");
          }}
          accessibilityLabel={placeholder}
        />
      </View>
      {left.length ? (
        <View style={styles.tags}>
          {left.map((name) => (
            <PressScale
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`Add ${name}`}
              scaleTo={0.94}
              style={styles.suggestion}
              onPress={() => {
                void Haptics.selectionAsync();
                onAdd(name);
              }}
            >
              <PlusIcon size={11} color={text.secondary} weight="bold" />
              <Text style={styles.suggestionText}>{name}</Text>
            </PressScale>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export const MarkIcon = ({ mark, size = 14 }: { mark: Mark; size?: number }) =>
  mark === "good" ? (
    <View style={[styles.markDisc, styles.markGood]}>
      <CheckIcon size={size - 2} color={text.inverse} weight="bold" />
    </View>
  ) : mark === "note" ? (
    <View style={[styles.markDisc, styles.markNote]}>
      <WarningIcon size={size - 2} color={text.primary} weight="fill" />
    </View>
  ) : (
    <View style={[styles.markDisc, styles.markBad]}>
      <XIcon size={size - 2} color={text.inverse} weight="bold" />
    </View>
  );

export const MARK_LABEL: Record<Mark, string> = { good: "Good fit", note: "Fits, with a note", bad: "Not a good fit" };

export const FitChip = ({ mark }: { mark: Mark }) => (
  <View style={[styles.fit, mark === "good" ? styles.fitGood : mark === "note" ? styles.fitNote : styles.fitBad]}>
    <Text style={[styles.fitText, mark === "bad" && styles.fitTextBad]}>{MARK_LABEL[mark]}</Text>
  </View>
);

/** The reasons behind a verdict, worst first. */
export const Checks = ({ checks }: { checks: readonly Check[] }) => (
  <View style={styles.checks}>
    {checks.map((check, index) => (
      <Animated.View key={check.key} entering={FadeIn.duration(motion.duration.enter).delay(index * motion.stagger)} style={styles.check}>
        <MarkIcon mark={check.mark} />
        <Text style={styles.checkText}>{check.text}</Text>
      </Animated.View>
    ))}
  </View>
);

export const ProductThumb = ({ product, size = 56 }: { product: Product; size?: number }) => (
  <View style={[styles.thumb, { width: size, height: size, borderRadius: size * 0.22 }]}>
    {product.imageUrl ? (
      <Image source={{ uri: product.imageUrl }} style={styles.thumbImage} resizeMode="contain" accessibilityIgnoresInvertColors />
    ) : product.kind === "treat" ? (
      <PawPrintIcon size={size * 0.4} color={text.primary} />
    ) : (
      <BowlFoodIcon size={size * 0.4} color={text.primary} />
    )}
  </View>
);

const stageText = (facts: Facts) =>
  facts.stage === "all" ? "All life stages" : facts.stage === "growth" ? "Growth (puppy)" : facts.stage === "adult" ? "Adult maintenance" : facts.stage === "supplemental" ? "Supplemental only" : null;

/** What PAWS found on the label, as short facts. */
export const FactLines = ({ facts, loading }: { facts: Facts | null; loading: boolean }) => {
  if (loading || !facts) {
    return (
      <View style={styles.reading}>
        <ActivityIndicator size="small" color={text.secondary} />
        <Text style={styles.readingText}>Reading the label</Text>
      </View>
    );
  }
  const calories = [
    facts.kcalPerCup ? `${facts.kcalPerCup} kcal/cup` : null,
    facts.kcalPerCan ? `${facts.kcalPerCan} kcal/can` : null,
    facts.kcalPerKg ? `${facts.kcalPerKg.toLocaleString()} kcal/kg` : null,
    facts.kcalPerPiece ? `${facts.kcalPerPiece} kcal each` : null,
  ].filter(Boolean);
  const analysis = [
    facts.protein != null ? `Protein ${facts.protein}%` : null,
    facts.fat != null ? `Fat ${facts.fat}%` : null,
    facts.fiber != null ? `Fiber ${facts.fiber}%` : null,
  ].filter(Boolean);
  const stage = stageText(facts);
  const lines: [string, string][] = [
    ["Type", facts.form ? (facts.form === "dry" ? "Dry food" : "Wet food") : ""],
    ["Life stage", stage ? `${stage}${facts.stageFrom === "label" ? " (AAFCO)" : ""}` : ""],
    ["Calories", calories.join(" · ")],
    ["Label", analysis.join(" · ")],
    ["Ingredients", facts.ingredientsKnown ? "Read from the label" : ""],
  ];
  const shown = lines.filter(([, value]) => value);
  return (
    <View style={styles.facts}>
      {shown.map(([label, value]) => (
        <View key={label} style={styles.fact}>
          <Text style={styles.factLabel}>{label}</Text>
          <Text style={styles.factValue}>{value}</Text>
        </View>
      ))}
      {shown.length < 3 ? <Text style={styles.factNote}>PAWS found little about this product online. Add the calories from the bag below.</Text> : null}
    </View>
  );
};

/** A number from the bag with a unit picker, for when the web had nothing. */
export const NumberField = ({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number | null;
  suffix: string;
  onChange: (value: number | null) => void;
}) => {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  return (
    <View style={styles.numberField}>
      <Text style={styles.numberLabel}>{label}</Text>
      <View style={styles.numberRow}>
        <TextInput
          style={styles.numberInput}
          value={draft}
          onChangeText={(next) => {
            setDraft(next);
            const n = Number(next.replace(",", "."));
            onChange(next.trim() && Number.isFinite(n) && n > 0 ? n : null);
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={text.disabled}
          accessibilityLabel={label}
          maxLength={6}
        />
        <Text style={styles.numberSuffix}>{suffix}</Text>
      </View>
    </View>
  );
};

/** Plus and minus for small counts (calories per treat). */
export const Stepper = ({ value, step = 1, min = 0, label, onChange }: { value: number; step?: number; min?: number; label: string; onChange: (value: number) => void }) => (
  <View style={styles.stepper}>
    <PressScale accessibilityRole="button" accessibilityLabel={`Less ${label}`} scaleTo={0.88} style={styles.stepButton} onPress={() => onChange(Math.max(min, value - step))}>
      <MinusIcon size={14} color={text.primary} weight="bold" />
    </PressScale>
    <Text style={styles.stepValue}>{value}</Text>
    <PressScale accessibilityRole="button" accessibilityLabel={`More ${label}`} scaleTo={0.88} style={styles.stepButton} onPress={() => onChange(value + step)}>
      <PlusIcon size={14} color={text.primary} weight="bold" />
    </PressScale>
  </View>
);

export const Card = ({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "butter" | "ink" }) => (
  <View style={[styles.card, tone === "butter" && styles.cardButter, tone === "ink" && styles.cardInk]}>{children}</View>
);

export const partsStyles = StyleSheet.create({
  section: { ...type.cardTitle, fontWeight: "700", color: text.primary, marginTop: space.section, marginBottom: space.md },
  caption: { ...type.caption, color: text.tertiary, marginTop: space.sm },
});

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: border.soft },
  rowHead: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.lg },
  rowCopy: { flex: 1 },
  rowLabel: { ...type.caption, color: text.tertiary },
  rowValue: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: 2 },
  rowValueNeeded: { color: text.secondary, fontWeight: "500" },
  rowBody: { paddingBottom: space.lg },
  flag: { paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  flagNeeded: { backgroundColor: accent.deep },
  flagCheck: { backgroundColor: accent.primary },
  flagText: { ...type.caption, fontSize: 11, fontWeight: "700", color: text.primary },

  options: { gap: space.sm },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, borderWidth: 1.5, borderColor: border.soft },
  optionOn: { borderColor: accent.deep, backgroundColor: accent.soft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: text.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: text.primary },
  optionCopy: { flex: 1 },
  optionLabel: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  optionHint: { ...type.caption, color: text.secondary, marginTop: 1 },
  suggested: { ...type.caption, fontWeight: "700", color: accent.band },

  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  boxOn: { borderColor: accent.deep, backgroundColor: accent.deep },
  toggleText: { ...type.body, color: text.primary, flex: 1 },

  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginBottom: space.sm },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, height: 34, borderRadius: radius.pill, backgroundColor: accent.primary },
  tagText: { ...type.supporting, fontWeight: "600", color: text.primary },
  addRow: { marginBottom: space.sm },
  addInput: { height: 44, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: bg.subtle, ...type.body, color: text.primary },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.md, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft },
  suggestionText: { ...type.caption, fontWeight: "600", color: text.secondary },

  markDisc: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 1 },
  markGood: { backgroundColor: scene.sageDeep },
  markNote: { backgroundColor: accent.deep },
  markBad: { backgroundColor: text.primary },

  fit: { alignSelf: "flex-start", paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  fitGood: { backgroundColor: scene.meadow },
  fitNote: { backgroundColor: accent.primary },
  fitBad: { backgroundColor: text.primary },
  fitText: { ...type.caption, fontSize: 11, fontWeight: "700", color: text.primary },
  fitTextBad: { color: text.inverse },

  checks: { gap: space.md },
  check: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  checkText: { ...type.supporting, color: text.primary, flex: 1, lineHeight: 20 },

  thumb: { backgroundColor: accent.soft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImage: { width: "88%", height: "88%" },

  reading: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.md },
  readingText: { ...type.supporting, color: text.secondary },
  facts: { marginTop: space.md, gap: 6 },
  fact: { flexDirection: "row", gap: space.md },
  factLabel: { ...type.caption, color: text.tertiary, width: 84 },
  factValue: { ...type.caption, fontSize: 13, fontWeight: "600", color: text.primary, flex: 1, fontVariant: ["tabular-nums"] },
  factNote: { ...type.caption, color: text.secondary, marginTop: space.xs },

  numberField: { gap: 4 },
  numberLabel: { ...type.caption, fontWeight: "600", color: text.secondary },
  numberRow: { flexDirection: "row", alignItems: "center", height: 48, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: bg.subtle },
  numberInput: { flex: 1, ...type.body, fontWeight: "700", color: text.primary, paddingVertical: 0, fontVariant: ["tabular-nums"] },
  numberSuffix: { ...type.supporting, color: text.tertiary },

  stepper: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  stepValue: { ...type.supporting, fontWeight: "700", color: text.primary, minWidth: 24, textAlign: "center", fontVariant: ["tabular-nums"] },

  card: { marginTop: space.lg, padding: space.lg, borderRadius: radius.card + 4, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.canvas },
  cardButter: { borderColor: accent.primary, backgroundColor: accent.soft },
  cardInk: { borderColor: text.primary, backgroundColor: text.primary },
});
