import type { ReactNode } from "react";
import { ActionSheetIOS, ActivityIndicator, Alert, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { CameraIcon, CheckIcon, ClockIcon, ImageBrokenIcon, PackageIcon, ShieldCheckIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, minutesLabel, propsLabel } from "@/features/photoPose/copy";
import type { Criterion } from "@/services/mediaService";
import { accent, bg, border, radius, space, text, type } from "@/constants/design";
import type { PoseCategory, PoseDifficulty } from "../../../../supabase/functions/media/poses";

const LEVEL = { easy: 1, medium: 2, hard: 3 } as const;

/**
 * A photo behind a signed link: a warm placeholder while the link loads, a broken-image note if it fails, never a
 * stand-in picture.
 */
export const PoseImage = ({
  url,
  loading,
  failed,
  aspect = 4 / 5,
  rounded = radius.card + 10,
  style,
  empty,
  accessibilityLabel,
}: {
  url: string | null | undefined;
  loading?: boolean;
  failed?: boolean;
  aspect?: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
  empty?: ReactNode;
  accessibilityLabel?: string;
}) => (
  <View style={[styles.frame, { aspectRatio: aspect, borderRadius: rounded }, style]} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
    {url ? (
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} accessibilityIgnoresInvertColors />
    ) : loading ? (
      <ActivityIndicator color={text.tertiary} />
    ) : failed ? (
      <View style={styles.placeholder}>
        <ImageBrokenIcon size={26} color={text.tertiary} />
        <Text style={styles.placeholderText}>Couldn't load</Text>
      </View>
    ) : (
      (empty ?? (
        <View style={styles.placeholder}>
          <CameraIcon size={28} color={text.tertiary} weight="duotone" />
        </View>
      ))
    )}
  </View>
);

/** Difficulty, setup time and props: the three things that decide whether you try it now. */
export const PoseFacts = ({ difficulty, minutes, objects, category }: { difficulty?: PoseDifficulty; minutes?: number; objects?: readonly string[]; category?: PoseCategory }) => (
  <View style={styles.facts}>
    {difficulty ? (
      <View style={styles.fact} accessibilityLabel={`Difficulty: ${DIFFICULTY_LABEL[difficulty]}`}>
        <View style={styles.pips}>
          {[1, 2, 3].map((n) => (
            <View key={n} style={[styles.pip, n <= LEVEL[difficulty] && styles.pipOn]} />
          ))}
        </View>
        <Text style={styles.factText}>{DIFFICULTY_LABEL[difficulty]}</Text>
      </View>
    ) : null}
    {minutes ? (
      <View style={styles.fact}>
        <ClockIcon size={15} color={text.secondary} weight="bold" />
        <Text style={styles.factText}>{minutesLabel(minutes)}</Text>
      </View>
    ) : null}
    {objects ? (
      <View style={[styles.fact, styles.factShrink]}>
        <PackageIcon size={15} color={text.secondary} weight="bold" />
        <Text style={styles.factText} numberOfLines={1}>
          {propsLabel(objects)}
        </Text>
      </View>
    ) : null}
    {category ? (
      <View style={styles.fact}>
        <Text style={styles.factText}>{CATEGORY_LABEL[category]}</Text>
      </View>
    ) : null}
  </View>
);

/** What a photo needs to count, as a checklist. */
export const CriteriaList = ({ criteria, compact }: { criteria: readonly Criterion[]; compact?: boolean }) => (
  <View style={{ gap: compact ? 6 : space.sm }}>
    {criteria.map((c) => (
      <View key={c.id} style={styles.criterion}>
        <View style={[styles.tick, compact && styles.tickSmall]}>
          <CheckIcon size={compact ? 10 : 12} color={text.primary} weight="bold" />
        </View>
        <Text style={[styles.criterionText, compact && styles.criterionSmall]}>{c.label}</Text>
      </View>
    ))}
  </View>
);

/** Numbered steps. The number matters: the order is the instructions. */
export const StepList = ({ steps }: { steps: readonly string[] }) => (
  <View style={{ gap: space.md }}>
    {steps.map((s, i) => (
      <View key={`${i}-${s}`} style={styles.step}>
        <View style={styles.stepNum}>
          <Text style={styles.stepNumText}>{i + 1}</Text>
        </View>
        <Text style={styles.stepText}>{s}</Text>
      </View>
    ))}
  </View>
);

export const SafetyNote = ({ notes }: { notes: readonly string[] }) =>
  notes.length ? (
    <View style={styles.safety}>
      <ShieldCheckIcon size={18} color={text.primary} weight="fill" />
      <View style={{ flex: 1, gap: 4 }}>
        {notes.map((n) => (
          <Text key={n} style={styles.safetyText}>
            {n}
          </Text>
        ))}
      </View>
    </View>
  ) : null;

export const SectionTitle = ({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.sectionWrap, style]}>
    <Text style={styles.section} accessibilityRole="header">
      {children}
    </Text>
  </View>
);

/** A small selectable pill. */
export const Chip = ({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) => (
  <PressScale
    accessibilityRole="button"
    accessibilityState={{ selected: on, disabled }}
    disabled={disabled}
    style={[styles.chip, on && styles.chipOn, disabled && styles.chipOff]}
    onPress={() => {
      void Haptics.selectionAsync();
      onPress();
    }}
  >
    <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
  </PressScale>
);

/** An equal-width segmented choice. */
export const Segments = <T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) => (
  <View style={styles.segments} accessibilityRole="tablist">
    {options.map(([key, label]) => (
      <PressScale
        key={key}
        accessibilityRole="tab"
        accessibilityState={{ selected: value === key }}
        style={[styles.segment, value === key && styles.segmentOn]}
        onPress={() => {
          void Haptics.selectionAsync();
          onChange(key);
        }}
      >
        <Text style={[styles.segmentText, value === key && styles.segmentTextOn]}>{label}</Text>
      </PressScale>
    ))}
  </View>
);

/** A native list of choices: the action sheet on iOS, an alert elsewhere. */
export const chooseFrom = (title: string, options: readonly (readonly [string, string])[], onPick: (key: string) => void, destructive = false) => {
  const labels = options.map(([, l]) => l);
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...labels, "Cancel"], cancelButtonIndex: labels.length, destructiveButtonIndex: destructive ? labels.map((_, i) => i) : undefined },
      (i) => i < options.length && onPick(options[i][0]),
    );
  } else {
    Alert.alert(title, undefined, [...options.map(([k, l]) => ({ text: l, onPress: () => onPick(k) })), { text: "Cancel", style: "cancel" as const }]);
  }
};

const styles = StyleSheet.create({
  frame: { width: "100%", overflow: "hidden", backgroundColor: bg.stage, alignItems: "center", justifyContent: "center" },
  placeholder: { alignItems: "center", gap: 6 },
  placeholderText: { ...type.caption, color: text.tertiary },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  fact: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 11, borderRadius: radius.pill, backgroundColor: bg.subtle },
  factShrink: { maxWidth: 180 },
  factText: { fontSize: 13, fontWeight: "700", color: text.primary },
  pips: { flexDirection: "row", gap: 2 },
  pip: { width: 8, height: 4, borderRadius: 2, backgroundColor: border.default },
  pipOn: { backgroundColor: accent.band },
  criterion: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center", marginTop: 1 },
  tickSmall: { width: 16, height: 16, borderRadius: 8 },
  criterionText: { ...type.supporting, color: text.primary, flex: 1 },
  criterionSmall: { fontSize: 13, lineHeight: 18 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  stepNum: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: accent.band, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 13, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  stepText: { ...type.body, color: text.primary, flex: 1, marginTop: 1 },
  safety: { flexDirection: "row", gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  safetyText: { ...type.supporting, color: text.primary },
  sectionWrap: { marginTop: space.section, marginBottom: space.md },
  section: { ...type.sectionTitle, fontWeight: "800", color: text.primary },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.soft, backgroundColor: bg.surface, justifyContent: "center" },
  chipOn: { borderColor: accent.band, backgroundColor: accent.soft },
  chipOff: { opacity: 0.45 },
  chipText: { fontSize: 14, fontWeight: "700", color: text.secondary },
  chipTextOn: { color: text.primary },
  segments: { flexDirection: "row", padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: bg.subtle },
  segment: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  segmentOn: { backgroundColor: bg.surface, shadowColor: "#1C1B1A", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  segmentText: { fontSize: 14, fontWeight: "700", color: text.secondary },
  segmentTextOn: { color: text.primary },
});
