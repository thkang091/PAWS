import { memo, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  SlideInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import {
  CaretRightIcon,
  CheckIcon,
  ForkKnifeIcon,
  MinusIcon,
  PlusIcon,
  XIcon,
} from "phosphor-react-native";

import { prettyTime } from "@/features/care/components/careSetupAnswers";
import { MEAL_TINTS, PlanDonut } from "@/features/care/components/PlanDonut";
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

export type PlanMeal = { at: string; grams: number };

export const mealName = (index: number, total: number): string => {
  if (total <= 1) return "Meal";
  if (index === 0) return "Breakfast";
  if (index === total - 1) return "Dinner";
  return total === 3 ? "Lunch" : `Meal ${index + 1}`;
};

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (minutes: number) => {
  const clamped = Math.min(23 * 60 + 30, Math.max(5 * 60, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

const sortMeals = (meals: readonly PlanMeal[]) =>
  [...meals].sort((a, b) => toMinutes(a.at) - toMinutes(b.at));

const signatureOf = (meals: readonly PlanMeal[], treats: number) =>
  `${meals.map((m) => `${m.at}:${m.grams}`).join("|")}#${treats}`;

const MAX_MEALS = 4;

type Editing =
  | { kind: "meal"; index: number | null }
  | { kind: "treats" }
  | null;

export const FoodPlanEditor = memo(
  ({
    dogName,
    meals: incoming,
    treatsPerDay: incomingTreats,
    fed,
    active,
    food,
    treats,
    onSave,
    onChangeFood,
    onAddTreat,
    onRemoveTreat,
    children,
  }: {
    children?: React.ReactNode;
    dogName: string;
    meals: readonly PlanMeal[];
    treatsPerDay: number;
    fed: readonly boolean[];
    active: boolean;
    food: { name: string; imageUrl: string | null; kcalPer100g: number | null } | null;
    treats: readonly { key: string; name: string; removable: boolean }[];
    onSave: (plan: { meals: readonly PlanMeal[]; treatsPerDay: number }) => void;
    onChangeFood: () => void;
    onAddTreat: () => void;
    onRemoveTreat: (key: string) => void;
  }) => {
    const reduceMotion = useReducedMotion();
    const [pending, setPending] = useState<{ meals: PlanMeal[]; treats: number } | null>(null);
    const [editing, setEditing] = useState<Editing>(null);
    const [undo, setUndo] = useState<{ label: string; meals: PlanMeal[]; treats: number } | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    }, []);

    const incomingSignature = signatureOf(incoming, incomingTreats);
    useEffect(() => {
      if (pending && signatureOf(pending.meals, pending.treats) === incomingSignature) setPending(null);
    }, [incomingSignature, pending]);

    const meals = pending?.meals ?? sortMeals(incoming);
    const treatsPerDay = pending?.treats ?? incomingTreats;
    const totalGrams = meals.reduce((total, meal) => total + meal.grams, 0);
    const kcal = food?.kcalPer100g ? Math.round((totalGrams * food.kcalPer100g) / 100) : null;

    const commit = (nextMeals: PlanMeal[], nextTreats: number) => {
      const sorted = sortMeals(nextMeals);
      setPending({ meals: sorted, treats: nextTreats });
      onSave({ meals: sorted, treatsPerDay: nextTreats });
    };

    const open = (next: Editing) => {
      void Haptics.selectionAsync();
      setEditing(next);
    };

    const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.select);

    return (
      <View>
        <PlanDonut
          active={active}
          kcal={kcal}
          parts={meals.map((meal, index) => ({
            key: `${index}`,
            grams: meal.grams,
            tint: MEAL_TINTS[index % MEAL_TINTS.length],
          }))}
        />

        <Animated.View layout={settle} style={styles.list}>
          {meals.map((meal, index) => (
            <Row
              key={`${meal.at}-${index}`}
              first={index === 0}
              label={`${mealName(index, meals.length)} at ${prettyTime(meal.at)}, ${meal.grams} grams${fed[index] ? ", fed today" : ""}. Edit`}
              onPress={() => open({ kind: "meal", index })}
            >
              <View style={[styles.swatch, { backgroundColor: MEAL_TINTS[index % MEAL_TINTS.length] }]} />
              <Text style={styles.rowTime}>{prettyTime(meal.at)}</Text>
              <View style={styles.rowName}>
                <Text style={styles.rowTitle}>{mealName(index, meals.length)}</Text>
                {fed[index] ? (
                  <View style={styles.fed}>
                    <CheckIcon size={10} color={text.primary} weight="bold" />
                  </View>
                ) : null}
              </View>
              <Text style={styles.rowValue}>{meal.grams} g</Text>
            </Row>
          ))}

        </Animated.View>

        {undo ? (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
            style={styles.undo}
          >
            <Text style={styles.undoText}>{undo.label} removed</Text>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Undo, bring back ${undo.label}`}
              hitSlop={10}
              scaleTo={0.94}
              onPress={() => {
                void Haptics.selectionAsync();
                commit(undo.meals, undo.treats);
                setUndo(null);
              }}
            >
              <Text style={styles.undoAction}>Undo</Text>
            </PressScale>
          </Animated.View>
        ) : null}

        {meals.length < MAX_MEALS ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Add a meal"
            scaleTo={0.96}
            style={styles.addMeal}
            onPress={() => open({ kind: "meal", index: null })}
          >
            <PlusIcon size={14} color={text.primary} weight="bold" />
            <Text style={styles.addMealText}>Add a meal</Text>
          </PressScale>
        ) : null}

        <Text style={styles.groupTitle}>Food</Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={food ? `Food: ${food.name}. Change` : `Add ${dogName}'s food`}
          scaleTo={0.98}
          style={styles.food}
          onPress={onChangeFood}
        >
          {food?.imageUrl ? (
            <Image source={{ uri: food.imageUrl }} style={styles.foodThumb} contentFit="contain" />
          ) : (
            <View style={[styles.foodThumb, !food && styles.foodThumbAdd]}>
              {food ? (
                <ForkKnifeIcon size={iconSize.inline} color={text.secondary} weight="regular" />
              ) : (
                <PlusIcon size={iconSize.inline} color={text.primary} weight="bold" />
              )}
            </View>
          )}
          <Text style={[styles.foodName, !food && styles.foodNameEmpty]} numberOfLines={1}>
            {food ? food.name : `Add ${dogName}'s food`}
          </Text>
          <Text style={styles.link}>{food ? "Change" : "Add"}</Text>
        </PressScale>


        <View style={styles.treatHead}>
          <Text style={[styles.groupTitle, styles.groupTitleInline]}>Treats</Text>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`${treatsPerDay} treats a day. Change`}
            scaleTo={0.95}
            style={styles.treatCount}
            onPress={() => open({ kind: "treats" })}
          >
            <Text style={styles.treatCountText}>{treatsPerDay} a day</Text>
            <CaretRightIcon size={12} color={text.secondary} weight="bold" />
          </PressScale>
        </View>
        <Animated.View layout={settle} style={styles.treatChips}>
          {treats.map((treat) => (
            <Animated.View
              key={treat.key}
              layout={settle}
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
              style={styles.treatChip}
            >
              <Text style={styles.treatChipText} numberOfLines={1}>
                {treat.name}
              </Text>
              {treat.removable ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${treat.name}`}
                  hitSlop={10}
                  scaleTo={0.85}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    onRemoveTreat(treat.key);
                  }}
                >
                  <XIcon size={12} color={text.secondary} weight="bold" />
                </PressScale>
              ) : null}
            </Animated.View>
          ))}
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Add a treat ${dogName} has`}
            scaleTo={0.94}
            style={[styles.treatChip, styles.treatAdd]}
            onPress={onAddTreat}
          >
            <PlusIcon size={12} color={text.primary} weight="bold" />
            <Text style={styles.treatChipText}>Add a treat</Text>
          </PressScale>
        </Animated.View>

        {children}

        <PlanSheet
          editing={editing}
          meals={meals}
          treatsPerDay={treatsPerDay}
          kcal={kcal}
          dogName={dogName}
          treats={treats}
          onClose={() => setEditing(null)}
          onSaveMeal={(index, meal) => {
            const next = index === null ? [...meals, meal] : meals.map((m, i) => (i === index ? meal : m));
            commit(next, treatsPerDay);
            setEditing(null);
          }}
          onRemoveMeal={(index) => {
            const before = { label: mealName(index, meals.length), meals: [...meals], treats: treatsPerDay };
            commit(meals.filter((_, i) => i !== index), treatsPerDay);
            setEditing(null);
            setUndo(before);
            if (undoTimer.current) clearTimeout(undoTimer.current);
            undoTimer.current = setTimeout(() => setUndo(null), 6000);
          }}
          onSaveTreats={(count) => {
            commit(meals, count);
            setEditing(null);
          }}
          onAddTreat={() => {
            setEditing(null);
            onAddTreat();
          }}
          onRemoveTreat={onRemoveTreat}
        />
      </View>
    );
  },
);

FoodPlanEditor.displayName = "FoodPlanEditor";

const Row = ({
  first,
  label,
  onPress,
  children,
}: {
  first: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) => (
  <PressScale
    accessibilityRole="button"
    accessibilityLabel={label}
    scaleTo={0.985}
    style={[styles.row, !first && styles.rowRule]}
    onPress={onPress}
  >
    {children}
    <CaretRightIcon size={14} color={text.tertiary} weight="bold" />
  </PressScale>
);

const PlanSheet = ({
  editing,
  meals,
  treatsPerDay,
  kcal,
  dogName,
  treats,
  onClose,
  onSaveMeal,
  onRemoveMeal,
  onSaveTreats,
  onAddTreat,
  onRemoveTreat,
}: {
  editing: Editing;
  meals: readonly PlanMeal[];
  treatsPerDay: number;
  kcal: number | null;
  dogName: string;
  treats: readonly { key: string; name: string; removable: boolean }[];
  onClose: () => void;
  onSaveMeal: (index: number | null, meal: PlanMeal) => void;
  onRemoveMeal: (index: number) => void;
  onSaveTreats: (count: number) => void;
  onAddTreat: () => void;
  onRemoveTreat: (key: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [at, setAt] = useState("12:00");
  const [grams, setGrams] = useState(150);
  const [count, setCount] = useState(treatsPerDay);

  const isMeal = editing?.kind === "meal";
  const index = editing?.kind === "meal" ? editing.index : null;

  useEffect(() => {
    if (!editing) return;
    if (editing.kind === "treats") {
      setCount(treatsPerDay);
      return;
    }
    if (editing.index !== null && meals[editing.index]) {
      setAt(meals[editing.index].at);
      setGrams(meals[editing.index].grams);
      return;
    }
    const last = meals[meals.length - 1];
    setAt(last ? toTime(Math.min(toMinutes(last.at) + 4 * 60, 21 * 60)) : "12:00");
    const average = meals.reduce((t, m) => t + m.grams, 0) / Math.max(1, meals.length);
    setGrams(Math.round(average / 5) * 5 || 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const title = !editing
    ? ""
    : editing.kind === "treats"
      ? "Treats a day"
      : index === null
        ? "New meal"
        : mealName(index, meals.length);

  return (
    <Modal visible={editing !== null} transparent animationType="none" onRequestClose={onClose}>
      {editing ? (
        <View style={styles.sheetRoot}>
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
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{title}</Text>
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

            {isMeal ? (
              <>
                <Stepper
                  label="Time"
                  value={prettyTime(at)}
                  onStep={(dir) => setAt((current) => toTime(toMinutes(current) + dir * 30))}
                />
                <Stepper
                  label="Portion"
                  value={`${grams} g`}
                  onStep={(dir) => setGrams((current) => Math.min(1500, Math.max(5, current + dir * 5)))}
                />
              </>
            ) : (
              <>
                <Stepper
                  label="Per day"
                  value={String(count)}
                  onStep={(dir) => setCount((current) => Math.min(12, Math.max(0, current + dir)))}
                />
                <Text style={styles.sheetNote}>
                  {kcal
                    ? `Treats should stay under about ${Math.round(kcal * 0.1)} kcal a day, around a tenth of ${dogName}'s food.`
                    : `Treats count toward ${dogName}'s daily food.`}
                </Text>
              </>
            )}

            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Save"
              scaleTo={0.97}
              style={styles.save}
              onPress={() => {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (isMeal) onSaveMeal(index, { at, grams });
                else onSaveTreats(count);
              }}
            >
              <Text style={styles.saveText}>{isMeal && index === null ? "Add meal" : "Save"}</Text>
            </PressScale>

            {isMeal && index !== null && meals.length > 1 ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Remove ${title}`}
                scaleTo={0.96}
                style={styles.remove}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onRemoveMeal(index);
                }}
              >
                <Text style={styles.removeText}>Remove this meal</Text>
              </PressScale>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
};

export const Stepper = ({
  label,
  value,
  onStep,
}: {
  label: string;
  value: string;
  onStep: (direction: 1 | -1) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);

  const stop = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };
  useEffect(() => stop, []);

  const step = (dir: 1 | -1) => {
    void Haptics.selectionAsync();
    setDirection(dir);
    onStep(dir);
  };

  const button = (dir: 1 | -1) => (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${dir > 0 ? "More" : "Less"} ${label.toLowerCase()}`}
      scaleTo={0.9}
      style={styles.stepButton}
      onPress={() => step(dir)}
      onLongPress={() => {
        stop();
        repeat.current = setInterval(() => {
          setDirection(dir);
          onStep(dir);
        }, 70);
      }}
      onPressOut={stop}
      delayLongPress={320}
    >
      {dir > 0 ? (
        <PlusIcon size={iconSize.standard} color={text.primary} weight="bold" />
      ) : (
        <MinusIcon size={iconSize.standard} color={text.primary} weight="bold" />
      )}
    </PressScale>
  );

  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepRow}>
        {button(-1)}
        <View style={styles.stepValueWrap}>
          <Animated.Text
            key={value}
            entering={
              reduceMotion
                ? undefined
                : FadeIn.duration(140).withInitialValues({
                    opacity: 0,
                    transform: [{ translateY: direction * 8 }],
                  })
            }
            style={styles.stepValue}
          >
            {value}
          </Animated.Text>
        </View>
        {button(1)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { ...type.sectionTitle, color: text.primary, marginTop: space.section },

  summary: { marginTop: space.lg },
  total: {
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1.6,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },
  totalUnit: { fontSize: 18, letterSpacing: -0.2, fontWeight: "500", color: text.secondary },
  totalMeta: { ...type.supporting, color: text.secondary, marginTop: 2 },
  bar: { flexDirection: "row", height: 8, gap: 3, marginTop: space.md },
  barPart: { height: "100%", borderRadius: 4 },

  groupTitle: { ...type.supporting, fontWeight: "700", color: text.secondary, marginTop: space.xl },
  groupTitleInline: { marginTop: 0 },
  treatHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xl,
  },
  treatCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 30,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  treatCountText: { ...type.caption, fontWeight: "700", color: text.primary },
  treatChips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  treatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    maxWidth: "100%",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  treatAdd: { backgroundColor: bg.canvas, borderWidth: 1, borderStyle: "dashed", borderColor: border.strong },
  treatChipText: { ...type.caption, fontWeight: "600", color: text.primary, flexShrink: 1 },
  food: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.sm,
    paddingVertical: space.sm,
  },
  foodThumb: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: bg.canvas,
    borderWidth: 1,
    borderColor: border.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  foodThumbAdd: { backgroundColor: accent.deep, borderColor: accent.deep },
  foodName: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },
  foodNameEmpty: { color: text.secondary },
  link: { ...type.supporting, fontWeight: "600", color: text.secondary },

  list: {
    marginTop: space.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.soft,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 58 },
  rowRule: { borderTopWidth: 1, borderTopColor: border.soft },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  swatchTreat: { backgroundColor: bg.canvas, borderWidth: 2, borderColor: border.strong },
  rowTime: {
    ...type.supporting,
    width: 64,
    color: text.secondary,
    fontVariant: ["tabular-nums"],
  },
  rowName: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowHint: { ...type.supporting, color: text.tertiary, flexShrink: 1 },
  rowValue: { ...type.cardTitle, fontWeight: "700", color: text.primary, fontVariant: ["tabular-nums"] },
  fed: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },

  addMeal: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: space.md,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
  },
  addMealText: { ...type.supporting, fontWeight: "600", color: text.primary },

  sheetRoot: { flex: 1, justifyContent: "flex-end" },
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
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  sheetTitle: { fontSize: 26, lineHeight: 30, letterSpacing: -0.6, fontWeight: "700", color: text.primary },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: bg.subtle,
    alignItems: "center",
    justifyContent: "center",
  },

  stepper: { marginTop: space.lg },
  stepLabel: { ...type.supporting, fontWeight: "600", color: text.secondary },
  stepRow: { flexDirection: "row", alignItems: "center", marginTop: space.sm },
  stepButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValueWrap: { flex: 1, alignItems: "center", overflow: "hidden" },
  stepValue: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1.2,
    fontWeight: "700",
    color: text.primary,
    fontVariant: ["tabular-nums"],
  },

  sheetNote: { ...type.supporting, color: text.secondary, marginTop: space.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    maxWidth: "100%",
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
  },
  chipAdd: { borderStyle: "dashed", borderColor: border.strong },
  chipText: { ...type.caption, fontWeight: "600", color: text.primary, flexShrink: 1 },

  save: {
    height: layout.controlHeight,
    marginTop: space.xl,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { ...type.cardTitle, fontSize: 17, fontWeight: "700", color: text.primary },
  remove: { alignSelf: "center", paddingVertical: space.sm, paddingHorizontal: space.xl, marginTop: space.lg },
  undo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.md,
    height: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
  },
  undoText: { ...type.supporting, color: text.inverse },
  undoAction: { ...type.supporting, fontWeight: "700", color: accent.deep },
  removeText: { ...type.supporting, fontWeight: "600", color: text.secondary },
});
