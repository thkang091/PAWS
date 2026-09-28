import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  ArrowUpIcon,
  CaretLeftIcon,
  CheckIcon,
  PlusIcon,
  ProhibitIcon,
  XIcon,
} from "phosphor-react-native";

import { goBack } from "@/features/care/components/DetailShell";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useAddFoodRule, useFoodRules, useRemoveFoodRule } from "@/hooks/useFood";
import type { FoodRuleKind } from "@/services/foodService";
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

const KINDS: readonly { key: FoodRuleKind; label: string }[] = [
  { key: "never", label: "Never give" },
  { key: "allergy", label: "Allergy" },
  { key: "intolerance", label: "Upsets tummy" },
  { key: "vet", label: "Vet said no" },
];

const KIND_LABEL: Record<FoodRuleKind, string> = {
  never: "Never give",
  allergy: "Allergy",
  intolerance: "Upsets tummy",
  vet: "Vet said no",
};

const DANGERS = [
  "Grapes and raisins",
  "Chocolate",
  "Xylitol",
  "Onion",
  "Garlic",
  "Macadamia nuts",
  "Cooked bones",
  "Alcohol",
  "Caffeine",
  "Avocado",
];

export default function FoodRulesScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const name = dog.data?.name ?? "your dog";

  const rules = useFoodRules(dogId);
  const addRule = useAddFoodRule(dogId);
  const removeRule = useRemoveFoodRule(dogId);

  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<FoodRuleKind>("never");
  const inputRef = useRef<TextInput>(null);

  const list = rules.data ?? [];
  const names = useMemo(() => new Set(list.map((rule) => rule.name.toLowerCase())), [list]);
  const typing = draft.trim().length > 0;
  const duplicate = names.has(draft.trim().toLowerCase());

  const add = (value: string, as: FoodRuleKind) => {
    const clean = value.trim();
    if (!clean || names.has(clean.toLowerCase()) || !dogId) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addRule.mutate({ name: clean, kind: as });
  };

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.roundButton}
          onPress={() => goBack("/(tabs)/care")}
        >
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Check a food for ${name}`}
          scaleTo={0.95}
          style={styles.checkChip}
          onPress={() => router.push("/care/food-check")}
        >
          <Text style={styles.checkChipText}>Check a food</Text>
        </PressScale>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.page }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>What {name} can&rsquo;t eat</Text>
          <Text style={styles.lede}>Every food check is judged against this list.</Text>

          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a food"
              placeholderTextColor={text.tertiary}
              autoCapitalize="sentences"
              returnKeyType="done"
              maxLength={80}
              onSubmitEditing={() => {
                add(draft, kind);
                setDraft("");
              }}
            />
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Add ${draft.trim() || "food"} as ${KIND_LABEL[kind]}`}
              accessibilityState={{ disabled: !typing || duplicate }}
              disabled={!typing || duplicate}
              scaleTo={0.9}
              style={[styles.send, (!typing || duplicate) && styles.sendOff]}
              onPress={() => {
                add(draft, kind);
                setDraft("");
                inputRef.current?.blur();
              }}
            >
              <ArrowUpIcon size={iconSize.standard} color={typing && !duplicate ? text.primary : text.disabled} weight="bold" />
            </PressScale>
          </View>

          {typing ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
              exiting={reduceMotion ? undefined : FadeOut.duration(120)}
              style={styles.kinds}
              accessibilityRole="radiogroup"
            >
              {KINDS.map((item) => {
                const on = item.key === kind;
                return (
                  <PressScale
                    key={item.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={item.label}
                    scaleTo={0.94}
                    style={[styles.kind, on && styles.kindOn]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setKind(item.key);
                    }}
                  >
                    <Text style={[styles.kindText, on && styles.kindTextOn]}>{item.label}</Text>
                  </PressScale>
                );
              })}
            </Animated.View>
          ) : null}
          {duplicate ? <Text style={styles.hint}>Already on the list.</Text> : null}

          <Animated.View layout={settle} style={styles.list}>
            {rules.isError ? (
              <Text style={styles.empty}>
                Could not load the list. Check your connection and come back.
              </Text>
            ) : list.length === 0 && !rules.isLoading ? (
              <Text style={styles.empty}>Nothing on the list yet. Add anything {name} reacts to.</Text>
            ) : (
              list.map((rule, index) => (
                <Animated.View
                  key={rule.id}
                  layout={settle}
                  entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
                  exiting={reduceMotion ? undefined : FadeOut.duration(140)}
                  style={[styles.row, index > 0 && styles.rowRule]}
                >
                  <View style={[styles.rowBadge, rule.kind === "never" && styles.rowBadgeNever]}>
                    <ProhibitIcon
                      size={14}
                      color={rule.kind === "never" ? text.inverse : text.primary}
                      weight="bold"
                    />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {rule.name}
                    </Text>
                    <Text style={styles.rowKind}>{KIND_LABEL[rule.kind]}</Text>
                  </View>
                  <PressScale
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${rule.name}`}
                    hitSlop={10}
                    scaleTo={0.88}
                    style={styles.remove}
                    disabled={rule.id.startsWith("pending-")}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      removeRule.mutate(rule.id);
                    }}
                  >
                    <XIcon size={14} color={text.secondary} weight="bold" />
                  </PressScale>
                </Animated.View>
              ))
            )}
          </Animated.View>

          {addRule.isError ? (
            <Text style={styles.hint}>That one did not save. Check your connection and try again.</Text>
          ) : null}

          <Text style={styles.sectionTitle}>Dangerous for every dog</Text>
          <Text style={styles.sectionLede}>Tap to add. These go on as never give.</Text>
          <View style={styles.dangers}>
            {DANGERS.map((item) => {
              const added = names.has(item.toLowerCase());
              return (
                <PressScale
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: added }}
                  accessibilityLabel={added ? `${item}, already on the list` : `Add ${item}`}
                  disabled={added}
                  scaleTo={0.94}
                  style={[styles.danger, added && styles.dangerAdded]}
                  onPress={() => add(item, "never")}
                >
                  {added ? (
                    <CheckIcon size={14} color={text.primary} weight="bold" />
                  ) : (
                    <PlusIcon size={14} color={text.primary} weight="bold" />
                  )}
                  <Text style={styles.dangerText}>{item}</Text>
                </PressScale>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
  },
  roundButton: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  checkChip: {
    height: 36,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    justifyContent: "center",
  },
  checkChipText: { ...type.supporting, fontWeight: "700", color: text.primary },

  content: { paddingHorizontal: layout.gutter, paddingTop: space.xl },
  title: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.9,
    fontWeight: "700",
    color: text.primary,
  },
  lede: { ...type.body, color: text.secondary, marginTop: space.sm },

  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xl,
    paddingLeft: space.lg,
    paddingRight: 6,
    height: layout.controlHeight,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: text.primary,
  },
  input: { ...type.body, flex: 1, color: text.primary, paddingVertical: 0 },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { backgroundColor: bg.subtle },

  kinds: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  kind: {
    height: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
    justifyContent: "center",
  },
  kindOn: { backgroundColor: text.primary, borderColor: text.primary },
  kindText: { ...type.caption, fontWeight: "600", color: text.primary },
  kindTextOn: { color: text.inverse },
  hint: { ...type.caption, color: text.secondary, marginTop: space.sm },

  list: {
    marginTop: space.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.soft,
  },
  empty: { ...type.supporting, color: text.secondary, paddingVertical: space.lg },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60 },
  rowRule: { borderTopWidth: 1, borderTopColor: border.soft },
  rowBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowBadgeNever: { backgroundColor: text.primary },
  rowCopy: { flex: 1 },
  rowName: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowKind: { ...type.caption, color: text.tertiary, marginTop: 1 },
  remove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: border.default,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: { ...type.sectionTitle, color: text.primary, marginTop: space.section },
  sectionLede: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  dangers: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  danger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
  },
  dangerAdded: { backgroundColor: accent.primary, borderColor: accent.primary },
  dangerText: { ...type.supporting, fontWeight: "600", color: text.primary },
});
