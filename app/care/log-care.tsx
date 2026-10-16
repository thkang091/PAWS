import { useEffect, useMemo, useState } from "react";
import { Dimensions, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  BellSimpleIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  CookieIcon,
  DropIcon,
  HourglassMediumIcon,
  PillIcon,
  PlusIcon,
  QuestionIcon,
  StethoscopeIcon,
  SyringeIcon,
  WarningCircleIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import { SetupShell, setupText } from "@/features/care/components/SetupShell";
import { Pill, WhenPicker } from "@/features/care/components/DayPicker";
import { goBack } from "@/features/care/components/DetailShell";
import { KIND_GLYPH, shortDay } from "@/features/care/components/careLogParts";
import { enter } from "@/features/care/food/enter";
import { CARE_LABEL, entriesFor, usualEvery, type CareKind } from "@/features/care/intel/careIntel";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import {
  COVER_WORD,
  FORM_LABEL,
  LASTS,
  isPreventiveKind,
  lastsLabel,
  preventivesFor,
  type DoseForm,
  type Preventive,
} from "@/features/care/intel/preventives";
import { daysBetween, nextDueAfter, saveDose, VISIT_KINDS } from "@/features/care/state/careDose";
import { PressScale } from "@/components/ui/PressScale";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

type Screen = "kind" | "product" | "start" | "when" | "next" | "result" | "note";

/** Record types offered by "Add a record", grouped the way people think about them. */
const KIND_GROUPS: readonly { title: string; kinds: readonly CareKind[] }[] = [
  { title: "Prevention", kinds: ["flea_tick", "heartworm_prev", "deworm"] },
  { title: "Visits and tests", kinds: ["wellness_exam", "bloodwork", "urinalysis", "fecal", "heartworm_test", "dental_cleaning"] },
  { title: "Other records", kinds: ["dental_procedure", "imaging", "vaccine_cert", "vet_note"] },
];

const NOTE_TITLE: Partial<Record<CareKind, string>> = {
  vet_note: "What did the vet say?",
  imaging: "What was it for?",
  dental_procedure: "What was done?",
  vaccine_cert: "Which vaccine?",
};

const FORM_GLYPH: Record<DoseForm, PhosphorIcon> = { chew: CookieIcon, topical: DropIcon, collar: CircleIcon, injection: SyringeIcon, tablet: PillIcon };

const QUESTION: Partial<Record<CareKind, string>> = {
  flea_tick: "fleas and ticks",
  heartworm_prev: "heartworm",
  deworm: "worms",
};

const RESULTS = [
  { key: "All clear", Glyph: CheckCircleIcon },
  { key: "Needs a follow-up", Glyph: WarningCircleIcon },
  { key: "Waiting on results", Glyph: HourglassMediumIcon },
] as const;

const TILE_W = (Dimensions.get("window").width - layout.gutter * 2 - space.md) / 2;

/**
 * Logging a preventive dose or a vet check, one question per screen in the Care setup frame. Doses: which product (it
 * sets how long protection lasts and what else it covers), which day, then the next due date with a reminder.
 * Checks: which day, then how it went.
 */
export default function LogCareScreen() {
  const params = useLocalSearchParams<{ kind?: string; pick?: string }>();
  // "Add a record" starts by asking what it is; the Care plan rows already know.
  const picking = params.pick === "1";
  const [picked, setPicked] = useState<CareKind | null>((params.kind as CareKind | undefined) ?? null);
  const kind = picked ?? "flea_tick";
  const intel = useCareIntel();
  const reduceMotion = useReducedMotion();
  const dose = isPreventiveKind(kind);
  const history = useMemo(() => entriesFor(kind, intel.log), [kind, intel.log]);
  const last = history[0] ?? null;
  const products = useMemo(() => preventivesFor(kind), [kind]);
  const lastProduct = last?.product ? products.find((p) => p.name === last.product) ?? null : null;

  const [notStarted, setNotStarted] = useState(false);
  const flow: Screen[] = dose
    ? notStarted
      ? ["product", "start"]
      : ["product", "when", "next"]
    : VISIT_KINDS.includes(kind)
      ? ["when", "result"]
      : NOTE_TITLE[kind]
        ? ["when", "note"]
        : ["when", "next"];
  const screens: Screen[] = picking ? ["kind", ...(picked ? flow : (["when"] as Screen[]))] : flow;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const screen = screens[step];

  const [product, setProduct] = useState<Preventive | "other" | null>(lastProduct ?? (last?.product ? "other" : null));
  const [otherName, setOtherName] = useState(lastProduct ? "" : last?.product ?? "");
  const [otherDays, setOtherDays] = useState<number | null>(lastProduct ? usualEvery(kind, intel.stage) : last?.everyDays ?? usualEvery(kind, intel.stage));
  const [date, setDate] = useState(intel.today);
  const [result, setResult] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [remind, setRemind] = useState(last?.remind ?? true);

  // A new kind picked from "Add a record" starts from that kind's own history.
  useEffect(() => {
    if (!picking || !picked) return;
    setProduct(lastProduct ?? (last?.product ? "other" : null));
    setOtherName(lastProduct ? "" : last?.product ?? "");
    setOtherDays(lastProduct ? usualEvery(picked, intel.stage) : last?.everyDays ?? usualEvery(picked, intel.stage));
    setRemind(last?.remind ?? true);
    setResult(null);
    setNote("");
    setNotStarted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const chosen = product === "other" ? { name: otherName.trim() || null, everyDays: otherDays, covers: [kind] as CareKind[] } : product ? { name: product.name, everyDays: product.everyDays, covers: [...product.covers] } : null;
  const next = nextDueAfter(kind, date, dose ? chosen?.everyDays : undefined, intel.stage);

  const go = (to: number) => {
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };

  const save = () => {
    saveDose({
      kind,
      date,
      stage: intel.stage,
      dogName: intel.name,
      product: chosen?.name ?? null,
      everyDays: dose ? chosen?.everyDays ?? null : null,
      covers: dose && chosen && chosen.covers.length > 1 ? chosen.covers : null,
      result,
      note: note.trim() || null,
      remind,
    });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goBack("/(tabs)/care");
  };

  const lastStep = step === screens.length - 1;
  const primary =
    screen === "start"
      ? { label: "Find a vet", onPress: () => router.replace("/care/find-vet" as never) }
      : screen === "kind"
        ? { label: "Next", disabled: !picked, onPress: () => go(step + 1) }
        : screen === "product"
        ? { label: "Next", disabled: !product, onPress: () => go(step + 1) }
        : lastStep
          ? { label: "Save", done: true, onPress: save }
          : { label: "Next", onPress: () => go(step + 1) };

  const eyebrow = screen === "kind" ? "HEALTH RECORDS" : CARE_LABEL[kind].toUpperCase();

  return (
    <SetupShell step={step} total={screens.length} direction={direction} closing={step === 0} onBack={() => (step === 0 ? goBack("/(tabs)/care") : go(step - 1))} primary={primary}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      {screen === "kind" ? (
        <>
          <Text style={setupText.title}>What are you adding?</Text>
          {KIND_GROUPS.map((group, g) => (
            <View key={group.title}>
              <Text style={styles.group}>{group.title}</Text>
              <View style={styles.kindGrid}>
                {group.kinds.map((k, i) => (
                  <KindTile
                    key={k}
                    order={g * 3 + i}
                    kind={k}
                    on={picked === k}
                    reduceMotion={reduceMotion}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setPicked(k);
                      // One choice, so move on once the tick has landed.
                      setTimeout(() => {
                        setDirection(1);
                        setStep(1);
                      }, 220);
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {screen === "note" ? (
        <>
          <Text style={setupText.title}>{NOTE_TITLE[kind]}</Text>
          <TextInput
            style={[styles.input, styles.noteBig]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={text.tertiary}
            accessibilityLabel={NOTE_TITLE[kind]}
            multiline
            autoFocus
          />
        </>
      ) : null}

      {screen === "product" ? (
        <>
          <Text style={setupText.title}>{`What does ${intel.name} take for ${QUESTION[kind] ?? "this"}?`}</Text>
          <View style={styles.grid}>
            {products.map((p, i) => (
              <ProductTile
                key={p.id}
                order={i}
                product={p}
                kind={kind}
                on={product !== "other" && product?.id === p.id}
                lastTime={lastProduct?.id === p.id}
                reduceMotion={reduceMotion}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setNotStarted(false);
                  setProduct(p);
                }}
              />
            ))}
            <OtherTile
              order={products.length}
              on={product === "other"}
              reduceMotion={reduceMotion}
              onPress={() => {
                void Haptics.selectionAsync();
                setNotStarted(false);
                setProduct("other");
              }}
            />
            {history.length === 0 ? (
              <OtherTile
                order={products.length + 1}
                on={false}
                label="Not started yet"
                meta="Ask your vet"
                Glyph={QuestionIcon}
                reduceMotion={reduceMotion}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setNotStarted(true);
                  setProduct(null);
                  setDirection(1);
                  setStep(step + 1);
                }}
              />
            ) : null}
          </View>

          {product === "other" ? (
            <Animated.View entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.other}>
              <TextInput
                style={styles.input}
                value={otherName}
                onChangeText={setOtherName}
                placeholder="Name (optional)"
                placeholderTextColor={text.tertiary}
                accessibilityLabel="Product name"
                returnKeyType="done"
              />
              <Text style={styles.label}>One dose lasts</Text>
              <View style={styles.chips}>
                {LASTS.map((l) => (
                  <Pill key={l.label} label={l.label} on={otherDays === l.days} onPress={() => setOtherDays(l.days)} />
                ))}
              </View>
            </Animated.View>
          ) : null}

        </>
      ) : null}

      {screen === "start" ? (
        <>
          <Text style={setupText.title}>Your vet can pick the right one</Text>
          <Text style={setupText.note}>{`Most dogs take it all year. Ask at ${intel.name}'s next visit, then log the first dose here.`}</Text>
          <View style={styles.startArt}>
            <View style={styles.startDisc}>
              <StethoscopeIcon size={40} color={text.primary} weight="regular" />
            </View>
          </View>
        </>
      ) : null}

      {screen === "when" ? (
        <>
          <Text style={setupText.title}>{dose ? `When did ${intel.name} get it?` : "When was it?"}</Text>
          <WhenPicker today={intel.today} value={date} onChange={setDate} reduceMotion={reduceMotion} />
        </>
      ) : null}

      {screen === "next" ? (
        <>
          <Text style={setupText.title}>{next && daysBetween(intel.today, next) < 0 ? "The next one is already due" : "You're all set"}</Text>
          <NextCard given={date} next={next} today={intel.today} dose={dose} reduceMotion={reduceMotion} />
          {dose && chosen && chosen.covers.length > 1 ? (
            <View style={styles.covers}>
              <Text style={styles.label}>One dose covers</Text>
              <View style={styles.chips}>
                {chosen.covers.map((k) => (
                  <View key={k} style={styles.cover}>
                    <CheckIcon size={13} color={text.primary} weight="bold" />
                    <Text style={styles.coverText}>{CARE_LABEL[k]}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {next ? <RemindRow next={next} today={intel.today} on={remind} onChange={setRemind} /> : null}
        </>
      ) : null}

      {screen === "result" ? (
        <>
          <Text style={setupText.title}>How did it go?</Text>
          <View style={styles.results}>
            {RESULTS.map((r, i) => {
              const on = result === r.key;
              return (
                <PressScale
                  key={r.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={r.key}
                  scaleTo={0.985}
                  style={[styles.resultRow, i > 0 && styles.resultRuled, on && styles.resultOn]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setResult((now) => (now === r.key ? null : r.key));
                  }}
                >
                  <r.Glyph size={22} color={text.primary} weight={on ? "fill" : "regular"} />
                  <Text style={styles.resultText}>{r.key}</Text>
                  <Radio on={on} reduceMotion={reduceMotion} />
                </PressScale>
              );
            })}
          </View>
          <TextInput
            style={[styles.input, styles.note]}
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={text.tertiary}
            accessibilityLabel="Note"
            multiline
          />
          {next ? <RemindRow next={next} today={intel.today} on={remind} onChange={setRemind} around /> : null}
        </>
      ) : null}
    </SetupShell>
  );
}

// ---------- Product ----------

const ProductTile = ({
  order,
  product,
  kind,
  on,
  lastTime,
  reduceMotion,
  onPress,
}: {
  order: number;
  product: Preventive;
  kind: CareKind;
  on: boolean;
  lastTime: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) => {
  const Glyph = FORM_GLYPH[product.form];
  const also = product.covers.filter((k) => k !== kind).map((k) => COVER_WORD[k]);
  const lasts = product.everyDays ? lastsLabel(product.everyDays) : "One course";
  return (
    <Animated.View style={styles.cell} entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: Math.min(order, 8) * 30, duration: motion.duration.enter })}>
      <PressScale
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={[product.name, FORM_LABEL[product.form], `lasts ${lasts}`, also.length ? `also covers ${also.join(" and ")}` : null, lastTime ? "used last time" : null].filter(Boolean).join(", ")}
        scaleTo={0.96}
        style={[styles.tile, on && styles.tileOn]}
        onPress={onPress}
      >
        <View style={styles.tileTop}>
          <View style={[styles.tileDisc, on && styles.tileDiscOn]}>
            <Glyph size={18} color={text.primary} weight={on ? "fill" : "regular"} />
          </View>
          {lastTime ? <Text style={styles.lastTime}>Last time</Text> : null}
          <Radio on={on} reduceMotion={reduceMotion} />
        </View>
        <Text style={styles.tileName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.tileMeta} numberOfLines={1}>{`${FORM_LABEL[product.form]} · ${lasts}`}</Text>
        {also.length ? (
          <Text style={styles.tileAlso} numberOfLines={1}>
            {`+ ${also.join(", ")}`}
          </Text>
        ) : null}
      </PressScale>
    </Animated.View>
  );
};

const OtherTile = ({
  order,
  on,
  label = "Something else",
  meta = "Any brand",
  Glyph = PlusIcon,
  reduceMotion,
  onPress,
}: {
  order: number;
  on: boolean;
  label?: string;
  meta?: string;
  Glyph?: PhosphorIcon;
  reduceMotion: boolean;
  onPress: () => void;
}) => (
  <Animated.View style={styles.cell} entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: Math.min(order, 8) * 30, duration: motion.duration.enter })}>
    <PressScale accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={label} scaleTo={0.96} style={[styles.tile, styles.tileOther, on && styles.tileOn]} onPress={onPress}>
      <View style={styles.tileTop}>
        <View style={[styles.tileDisc, on && styles.tileDiscOn]}>
          <Glyph size={18} color={text.primary} weight="bold" />
        </View>
        <Radio on={on} reduceMotion={reduceMotion} />
      </View>
      <Text style={styles.tileName}>{label}</Text>
      <Text style={styles.tileMeta}>{meta}</Text>
    </PressScale>
  </Animated.View>
);

const KindTile = ({ order, kind, on, reduceMotion, onPress }: { order: number; kind: CareKind; on: boolean; reduceMotion: boolean; onPress: () => void }) => {
  const Glyph = KIND_GLYPH[kind];
  return (
    <Animated.View style={styles.cell} entering={reduceMotion ? undefined : enter({ y: 10 }, { delay: Math.min(order, 10) * 25, duration: motion.duration.enter })}>
      <PressScale accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={CARE_LABEL[kind]} scaleTo={0.96} style={[styles.kindTile, on && styles.tileOn]} onPress={onPress}>
        <View style={[styles.tileDisc, on && styles.tileDiscOn]}>
          <Glyph size={18} color={text.primary} weight={on ? "fill" : "regular"} />
        </View>
        <Text style={styles.kindName} numberOfLines={2}>
          {CARE_LABEL[kind]}
        </Text>
      </PressScale>
    </Animated.View>
  );
};

const Radio = ({ on, reduceMotion }: { on: boolean; reduceMotion: boolean }) => {
  const pop = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    pop.value = reduceMotion ? (on ? 1 : 0) : withSpring(on ? 1 : 0, { duration: 320, dampingRatio: 0.7 });
  }, [on, pop, reduceMotion]);
  const tick = useAnimatedStyle(() => ({ opacity: pop.value, transform: [{ scale: 0.6 + pop.value * 0.4 }] }));
  return (
    <View style={[styles.radio, on && styles.radioOn]}>
      <Animated.View style={tick}>
        <CheckIcon size={12} color={text.primary} weight="bold" />
      </Animated.View>
    </View>
  );
};


// ---------- Next ----------

/** The next due date, big, over a bar from the day it was given to the day it runs out with today pinned on it. */
const NextCard = ({ given, next, today, dose, reduceMotion }: { given: string; next: string | null; today: string; dose: boolean; reduceMotion: boolean }) => {
  const fill = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) fill.value = withDelay(120, withTiming(1, { duration: motion.duration.flourish, easing: motion.easing.out }));
  }, [fill, reduceMotion]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }));
  const pin = useAnimatedStyle(() => ({ opacity: fill.value }));

  if (!next) {
    return (
      <View style={styles.nextCard}>
        <Text style={styles.nextEyebrow}>LOGGED FOR</Text>
        <Text style={styles.nextDate}>{shortDay(given)}</Text>
      </View>
    );
  }

  const span = Math.max(1, daysBetween(given, next));
  const left = daysBetween(today, next);
  const at = Math.max(0, Math.min(1, daysBetween(given, today) / span));
  const late = left < 0;

  return (
    <View style={styles.nextCard}>
      <Text style={styles.nextEyebrow}>{dose ? "NEXT DOSE" : "NEXT ONE"}</Text>
      <Text style={styles.nextDate}>{shortDay(next)}</Text>
      <Text style={[styles.nextIn, late && styles.nextLate]}>{late ? `Due ${-left} ${left === -1 ? "day" : "days"} ago` : left === 0 ? "Due today" : left === 1 ? "Tomorrow" : `In ${left} days`}</Text>

      <View style={styles.bar}>
        <View style={styles.track} />
        <Animated.View style={[styles.barFill, late && styles.barFillLate, grow]} />
        <Animated.View style={[styles.barUsed, { width: `${at * 100}%` }, pin]} />
        <Animated.View style={[styles.pin, { left: `${at * 100}%` }, pin]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{shortDay(given)}</Text>
        <Text style={styles.barLabel}>{shortDay(next)}</Text>
      </View>
    </View>
  );
};

const RemindRow = ({ next, today, on, onChange, around = false }: { next: string; today: string; on: boolean; onChange: (on: boolean) => void; around?: boolean }) => {
  const future = daysBetween(today, next) > 0;
  return (
    <View style={styles.remind}>
      <View style={styles.remindDisc}>
        <BellSimpleIcon size={20} color={text.primary} weight={on ? "fill" : "regular"} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.remindTitle}>Remind me</Text>
        <Text style={styles.remindSub}>{around ? `Next one around ${shortDay(next)}` : future ? `Morning of ${shortDay(next)}` : "When the next one is due"}</Text>
      </View>
      <Switch
        accessibilityLabel="Remind me"
        value={on}
        onValueChange={(v) => {
          void Haptics.selectionAsync();
          onChange(v);
        }}
        trackColor={{ false: border.default, true: accent.deep }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  eyebrow: { ...type.eyebrow, color: accent.band, marginBottom: space.sm },
  label: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginTop: space.xl, marginBottom: space.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginTop: space.xl },
  cell: { width: TILE_W },
  tile: { flex: 1, padding: space.md, borderRadius: radius.card, borderWidth: 1.5, borderColor: border.soft, backgroundColor: bg.canvas },
  tileOther: { borderStyle: "dashed", borderColor: border.default },
  tileOn: { borderColor: accent.deep, backgroundColor: accent.soft, borderStyle: "solid" },
  tileTop: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm },
  tileDisc: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  tileDiscOn: { backgroundColor: accent.primary },
  lastTime: { ...type.caption, fontSize: 11, fontWeight: "600", color: text.primary, backgroundColor: accent.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: "hidden", marginLeft: "auto" },
  radio: { marginLeft: "auto", width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: border.strong, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: accent.deep, backgroundColor: accent.deep },
  tileName: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  tileMeta: { ...type.caption, color: text.tertiary, marginTop: 2 },
  tileAlso: { ...type.caption, color: text.secondary, fontWeight: "600", marginTop: 4 },

  other: { marginTop: space.lg },
  group: { ...type.caption, fontWeight: "600", color: text.tertiary, marginTop: space.xl, marginBottom: space.sm },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  kindTile: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 60, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.card, borderWidth: 1.5, borderColor: border.soft, backgroundColor: bg.canvas },
  kindName: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },
  noteBig: { height: 160, paddingTop: space.md, marginTop: space.xl, textAlignVertical: "top" },
  input: { height: 52, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.default, ...type.body, color: text.primary },
  note: { height: 76, paddingTop: space.md, marginTop: space.md, textAlignVertical: "top" },

  startArt: { alignItems: "center", marginTop: space.sectionLg },
  startDisc: { width: 120, height: 120, borderRadius: 60, backgroundColor: accent.soft, alignItems: "center", justifyContent: "center" },


  nextCard: { marginTop: space.xl, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  nextEyebrow: { ...type.eyebrow, color: text.secondary },
  nextDate: { fontSize: 44, lineHeight: 48, letterSpacing: -1, fontWeight: "600", color: text.primary, marginTop: space.sm },
  nextIn: { ...type.body, color: text.secondary },
  nextLate: { color: accent.band, fontWeight: "600" },
  bar: { height: 14, marginTop: space.xl, justifyContent: "center" },
  track: { position: "absolute", left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: bg.canvas },
  barFill: { position: "absolute", left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: accent.deep, transformOrigin: "left" },
  barFillLate: { backgroundColor: accent.band },
  barUsed: { position: "absolute", left: 0, height: 8, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, backgroundColor: accent.primary },
  pin: { position: "absolute", width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: text.primary, borderWidth: 3, borderColor: bg.canvas },
  barLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: space.sm },
  barLabel: { ...type.caption, color: text.tertiary },

  covers: { marginTop: space.sm },
  cover: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: bg.subtle },
  coverText: { ...type.supporting, color: text.primary },

  remind: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  remindDisc: { width: 40, height: 40, borderRadius: 20, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  remindTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  remindSub: { ...type.caption, color: text.tertiary, marginTop: 2 },

  results: { marginTop: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 58, paddingHorizontal: space.lg, backgroundColor: bg.canvas },
  resultRuled: { borderTopWidth: 1, borderTopColor: border.soft },
  resultOn: { backgroundColor: accent.soft },
  resultText: { ...type.cardTitle, fontWeight: "600", color: text.primary, flex: 1 },
});
