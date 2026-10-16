import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { VACCINE_SCHEDULE } from "@/constants/careHealth";
import { Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  BandaidsIcon,
  BoneIcon,
  CaretRightIcon,
  FilePdfIcon,
  SealCheckIcon,
  SparkleIcon,
  DropHalfIcon,
  FirstAidKitIcon,
  HeartbeatIcon,
  PawPrintIcon,
  PillIcon,
  PlusIcon,
  ScissorsIcon,
  SyringeIcon,
  ToothIcon,
  WarningCircleIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { KIND_GLYPH, shortDay } from "@/features/care/components/careLogParts";
import { enter } from "@/features/care/food/enter";
import { CARE_LABEL, MOBILITY_NOUN, entriesFor } from "@/features/care/intel/careIntel";
import { useDogContext } from "@/features/care/intel/useDogContext";
import { insightFor } from "@/services/recordInsight";
import { FACTS, useVetRecord } from "@/features/profile/state/useVetRecord";
import { useCareIntel } from "@/features/care/intel/useCareIntel";
import { VISIT_KINDS } from "@/features/care/state/careDose";
import { SUGGESTIONS, addRecordItem, removeRecordItem, setRecordInsight, updateRecordItem, useHealthRecord, type RecordItem, type RecordKind } from "@/features/care/state/healthRecord";
import { FACT_LABEL, FACT_OPTIONS, factText, saveFact, saveVetReview, useMedicalFacts, type FactKey } from "@/features/profile/state/medicalFacts";
import { PressScale } from "@/components/ui/PressScale";
import { useMedications, useVaccinations } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { accent, bg, border, icon as iconSize, layout, motion, radius, space, text, type } from "@/constants/design";

const FACT_GLYPH: Record<FactKey, PhosphorIcon> = {
  sensitivities: DropHalfIcon,
  surgeries: ScissorsIcon,
  injuries: BandaidsIcon,
  mobility: BoneIcon,
  dental: ToothIcon,
  skin: PawPrintIcon,
};
const FACT_HINT: Record<FactKey, string> = {
  sensitivities: "What upsets the stomach, skin or mood",
  surgeries: "When and where, for example 2023 at City Vet",
  injuries: "What happened and when",
  mobility: "Anything the vet should know about movement",
  dental: "Last cleaning, extractions, what the vet said",
  skin: "Anything recurring",
};
const KIND_WORD: Record<RecordKind, { one: string; many: string; add: string }> = {
  condition: { one: "condition", many: "Conditions", add: "Add a condition" },
  allergy: { one: "allergy", many: "Allergies", add: "Add an allergy" },
};

type Sheet = { type: "fact"; key: FactKey } | { type: "item"; kind: RecordKind; item: RecordItem | null } | { type: "review" } | null;


const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / DAY);

/**
 * The medical record: what a new vet would ask for, kept in one place. Conditions and allergies are the lists that
 * change food and care advice; body and history are short facts picked from common answers; vaccines, medications and
 * visits come live from where they are already logged. Every edit happens in one sheet that slides up over the page.
 */
export const MedicalRecord = () => {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const name = dog.data?.name ?? "your dog";
  const intel = useCareIntel();
  const record = useHealthRecord();
  const facts = useMedicalFacts();
  const vaccinations = useVaccinations(dog.data?.id);
  const medications = useMedications(dog.data?.id);
  const [sheet, setSheet] = useState<Sheet>(null);
  const context = useDogContext();

  // Every condition and allergy gets a plain explanation from Gemini, including ones typed in the guardian's own words.
  const asking = useRef(new Set<string>());
  const [pending, setPending] = useState<readonly string[]>([]);
  useEffect(() => {
    const next = record.items.find((i) => i.insight === undefined && !asking.current.has(i.id));
    if (!next) return;
    asking.current.add(next.id);
    setPending((p) => [...p, next.id]);
    void insightFor(next.kind, next, { name, breed: dog.data?.breed ?? null, ageYears: dog.data?.ageYears ?? null, stage: intel.stage, brief: context.brief })
      .then((insight) => setRecordInsight(next.id, insight))
      .finally(() => {
        asking.current.delete(next.id);
        setPending((p) => p.filter((id) => id !== next.id));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.items, name, dog.data?.breed, dog.data?.ageYears, intel.stage]);

  const conditions = record.items.filter((i) => i.kind === "condition");
  const allergies = record.items.filter((i) => i.kind === "allergy");

  const vaccines = useMemo(() => {
    const latest = new Map<string, NonNullable<typeof vaccinations.data>[number]>();
    (vaccinations.data ?? []).forEach((v) => {
      const seen = latest.get(v.vaccineKey);
      if (!seen || v.dateGiven > seen.dateGiven) latest.set(v.vaccineKey, v);
    });
    return [...latest.values()].sort((a, b) => (a.nextDueDate ?? "9999") .localeCompare(b.nextDueDate ?? "9999"));
  }, [vaccinations.data]);
  const nextVaccine = vaccines.find((v) => v.nextDueDate);
  // Core shots with no record at all matter more than the next date: a vet should not read "none due" for them.
  const missingCore = VACCINE_SCHEDULE.filter((v) => v.required && !vaccines.some((r) => r.vaccineKey === v.key));
  const vaccineStat = missingCore.length
    ? `${missingCore.length} not on file`
    : nextVaccine?.nextDueDate
      ? monthYear(nextVaccine.nextDueDate)
      : "None due";
  const meds = (medications.data ?? []).filter((m) => m.isActive);
  const visits = intel.log.filter((e) => VISIT_KINDS.includes(e.kind) || e.kind === "vet_note").sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

  // What the app already knows, shown when the guardian has not written anything for that field.
  const derived: Partial<Record<FactKey, string>> = {
    mobility:
      intel.mobility.status === "unknown"
        ? undefined
        : intel.mobility.streak && intel.mobility.status !== "normal"
          ? `Check-ins: ${MOBILITY_NOUN[intel.mobility.streak.sign]} lately`
          : "Check-ins: no concerns this week",
    dental: (() => {
      const cleaning = entriesFor("dental_cleaning", intel.log)[0];
      return cleaning ? `Cleaned ${shortDay(cleaning.date)}` : undefined;
    })(),
  };

  const lastChange = Math.max(
    0,
    ...record.items.map((i) => i.updatedAt ?? i.addedAt),
    ...FACTS.map((k) => facts[k]?.updatedAt ?? 0),
  );
  const changedSince = (at: number) => lastChange > at;

  // The PDF is built in one place, shared with Health records, so both always send the same document.
  const vet = useVetRecord();
  const exporting = vet.exporting;
  const exportPdf = vet.share;

  const open = (next: Sheet) => {
    void Haptics.selectionAsync();
    setSheet(next);
  };

  return (
    <>
      <DetailShell
        title="Medical record"
        glyph={<FirstAidKitIcon size={iconSize.standard} color={accent.band} weight="bold" />}
        back="/(tabs)/profile"
        action={{
          label: exporting ? "Making the PDF" : "Share PDF with your vet",
          icon: <FilePdfIcon size={iconSize.button} color={text.primary} weight="bold" />,
          onPress: () => void exportPdf(),
          disabled: exporting,
        }}
      >
        <Animated.View entering={reduceMotion ? undefined : enter({ y: 8 }, { duration: motion.duration.enter })} style={styles.hero}>
          <Text style={styles.heroTitle}>{`What a vet needs to know about ${name}`}</Text>
          <View style={styles.stats}>
            <Stat label="Conditions" value={conditions.length ? conditions.map((c) => c.name).join(", ") : "None"} />
            <View style={styles.statRule} />
            <Stat label="Allergies" value={allergies.length ? allergies.map((c) => c.name).join(", ") : "None"} flag={allergies.length > 0} />
            <View style={styles.statRule} />
            <Stat label={missingCore.length ? "Core shots" : "Next vaccine"} value={vaccineStat} />
          </View>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={facts.review ? `Reviewed by ${facts.review.vet}. Change` : "Mark as reviewed by a vet"}
            scaleTo={0.98}
            style={styles.review}
            onPress={() => open({ type: "review" })}
          >
            <SealCheckIcon size={20} color={facts.review ? text.primary : text.tertiary} weight={facts.review ? "fill" : "regular"} />
            <Text style={[styles.reviewText, !facts.review && styles.reviewTextOff]} numberOfLines={2}>
              {facts.review
                ? `Reviewed by ${facts.review.vet}${facts.review.clinic ? `, ${facts.review.clinic}` : ""} on ${shortDay(facts.review.date)}${changedSince(facts.review.at) ? ". Changed since" : ""}`
                : "Not reviewed by a vet yet"}
            </Text>
            <CaretRightIcon size={12} color={text.tertiary} weight="bold" />
          </PressScale>
        </Animated.View>

        {(["condition", "allergy"] as const).map((kind) => {
          const items = kind === "condition" ? conditions : allergies;
          return (
            <Section key={kind} title={KIND_WORD[kind].many}>
              <View style={styles.list}>
                {items.map((item, i) => (
                  <Row
                    key={item.id}
                    Glyph={kind === "allergy" ? WarningCircleIcon : HeartbeatIcon}
                    title={item.name}
                    sub={item.note || item.insight?.plain || (pending.includes(item.id) ? "Looking this up" : null)}
                    muted={!item.note && pending.includes(item.id)}
                    trailing={item.insight?.seeVetSoon ? "Call vet" : undefined}
                    trailingFlag
                    ruled={i > 0}
                    wrap
                    onPress={() => open({ type: "item", kind, item })}
                  />
                ))}
                <AddRow label={items.length ? KIND_WORD[kind].add : `None recorded. ${KIND_WORD[kind].add}`} ruled={items.length > 0} onPress={() => open({ type: "item", kind, item: null })} />
              </View>
            </Section>
          );
        })}

        <Section title="Body and history">
          <View style={styles.list}>
            {FACTS.map((key, i) => {
              const written = factText(facts[key]);
              return (
                <Row
                  key={key}
                  Glyph={FACT_GLYPH[key]}
                  title={FACT_LABEL[key]}
                  sub={written ?? derived[key] ?? "Not recorded"}
                  muted={!written}
                  ruled={i > 0}
                  wrap
                  onPress={() => open({ type: "fact", key })}
                />
              );
            })}
          </View>
        </Section>

        <Section title="Vaccinations" action={{ label: "Manage", onPress: () => router.push("/care/vaccinations" as never) }}>
          <View style={styles.list}>
            {vaccines.length ? (
              vaccines.map((v, i) => {
                const left = v.nextDueDate ? daysUntil(v.nextDueDate) : null;
                return (
                  <Row
                    key={v.id}
                    Glyph={SyringeIcon}
                    title={v.vaccineName}
                    sub={v.nextDueDate ? `Due ${monthYear(v.nextDueDate)}` : `Given ${shortDay(v.dateGiven.slice(0, 10))}`}
                    trailing={left == null ? undefined : left < 0 ? "Overdue" : left <= 60 ? `In ${left} days` : undefined}
                    trailingFlag
                    ruled={i > 0}
                    onPress={() => router.push("/care/vaccinations" as never)}
                  />
                );
              })
            ) : (
              <AddRow label="No vaccines recorded. Add one" onPress={() => router.push("/care/vaccinations" as never)} />
            )}
          </View>
        </Section>

        <Section title="Medications" action={{ label: "Manage", onPress: () => router.push("/care/medications" as never) }}>
          <View style={styles.list}>
            {meds.length ? (
              meds.map((m, i) => (
                <Row
                  key={m.id}
                  Glyph={PillIcon}
                  title={m.medicationName}
                  sub={[m.dosage, m.frequency.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                  ruled={i > 0}
                  onPress={() => router.push("/care/medications" as never)}
                />
              ))
            ) : (
              <AddRow label="None right now. Add a medication" onPress={() => router.push("/care/medications" as never)} />
            )}
          </View>
        </Section>

        <Section title="Vet visits and tests" action={{ label: "All records", onPress: () => router.push("/care/records" as never) }}>
          <View style={styles.list}>
            {visits.length ? (
              visits.map((e, i) => (
                <Row
                  key={e.id}
                  Glyph={KIND_GLYPH[e.kind]}
                  title={CARE_LABEL[e.kind]}
                  sub={[shortDay(e.date), e.result].filter(Boolean).join(" · ")}
                  ruled={i > 0}
                  onPress={() => router.push(`/care/record?id=${encodeURIComponent(e.id)}` as never)}
                />
              ))
            ) : (
              <AddRow label="No visits yet. Add one" onPress={() => router.push("/care/log-care?pick=1" as never)} />
            )}
          </View>
        </Section>
      </DetailShell>

      <EditSheet sheet={sheet} name={name} derived={derived} onClose={() => setSheet(null)} />
    </>
  );
};

const Stat = ({ label, value, flag = false }: { label: string; value: string; flag?: boolean }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, flag && styles.statValueFlag]} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

const Section = ({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode }) => (
  <View style={styles.section}>
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? (
        <PressScale accessibilityRole="button" accessibilityLabel={`${action.label} ${title.toLowerCase()}`} hitSlop={8} scaleTo={0.95} onPress={action.onPress}>
          <Text style={styles.sectionAction}>{action.label}</Text>
        </PressScale>
      ) : null}
    </View>
    {children}
  </View>
);

const Row = ({
  Glyph,
  title,
  sub,
  trailing,
  trailingFlag = false,
  muted = false,
  wrap = false,
  ruled,
  onPress,
}: {
  Glyph: PhosphorIcon;
  title: string;
  sub?: string | null;
  trailing?: string;
  trailingFlag?: boolean;
  muted?: boolean;
  wrap?: boolean;
  ruled: boolean;
  onPress: () => void;
}) => (
  <PressScale accessibilityRole="button" accessibilityLabel={[title, sub, trailing].filter(Boolean).join(", ")} scaleTo={0.985} style={[styles.row, ruled && styles.ruled]} onPress={onPress}>
    <View style={styles.disc}>
      <Glyph size={iconSize.standard} color={text.primary} weight="regular" />
    </View>
    <View style={styles.flex}>
      <Text style={styles.rowTitle} numberOfLines={2}>
        {title}
      </Text>
      {sub ? (
        <Text style={[styles.rowSub, muted && styles.rowSubMuted]} numberOfLines={wrap ? 3 : 1}>
          {sub}
        </Text>
      ) : null}
    </View>
    {trailing ? (
      <View style={[styles.trailing, trailingFlag && styles.trailingFlag]}>
        <Text style={styles.trailingText}>{trailing}</Text>
      </View>
    ) : null}
    <CaretRightIcon size={14} color={text.tertiary} weight="bold" />
  </PressScale>
);

const AddRow = ({ label, ruled = false, onPress }: { label: string; ruled?: boolean; onPress: () => void }) => (
  <PressScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.985} style={[styles.row, styles.addRow, ruled && styles.ruled]} onPress={onPress}>
    <View style={[styles.disc, styles.addDisc]}>
      <PlusIcon size={16} color={text.primary} weight="bold" />
    </View>
    <Text style={styles.addText}>{label}</Text>
  </PressScale>
);

// ---------- The one editing sheet ----------

const SCREEN_H = Dimensions.get("window").height;

/**
 * Slides up from the bottom on the iOS drawer curve; drag it down (or flick) to dismiss, tap outside to cancel. Fields
 * pick from common answers first and take free text second, so most edits are two taps.
 */
const EditSheet = ({ sheet, name, derived, onClose }: { sheet: Sheet; name: string; derived: Partial<Record<FactKey, string>>; onClose: () => void }) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const y = useSharedValue(SCREEN_H);
  const scrim = useSharedValue(0);
  const [shown, setShown] = useState<Sheet>(null);

  useEffect(() => {
    if (!sheet) return;
    setShown(sheet);
    y.value = SCREEN_H;
    y.value = reduceMotion ? 0 : withTiming(0, { duration: 380, easing: motion.easing.drawer });
    scrim.value = withTiming(1, { duration: motion.duration.enter });
  }, [sheet, y, scrim, reduceMotion]);

  const finish = () => {
    setShown(null);
    onClose();
  };
  const close = () => {
    scrim.value = withTiming(0, { duration: 200 });
    if (reduceMotion) return finish();
    y.value = withTiming(SCREEN_H * 0.7, { duration: 220, easing: motion.easing.out }, (done) => {
      if (done) runOnJS(finish)();
    });
  };

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      // Down follows the finger; up resists, so the sheet never detaches from the bottom.
      y.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15;
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 700) {
        scrim.value = withTiming(0, { duration: 200 });
        y.value = withTiming(SCREEN_H * 0.7, { duration: 200 }, (done) => {
          if (done) runOnJS(finish)();
        });
      } else y.value = withSpring(0, { duration: 380, dampingRatio: 0.8 });
    });

  const panel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const dim = useAnimatedStyle(() => ({ opacity: scrim.value }));

  if (!shown) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, dim]}>
          <Pressable style={styles.flex} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.lift} pointerEvents="box-none">
          <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }, panel]}>
            <GestureDetector gesture={drag}>
              <View style={styles.grabZone} accessibilityLabel="Drag down to close">
                <View style={styles.grabber} />
              </View>
            </GestureDetector>
            {shown.type === "fact" ? (
              <FactEditor key={shown.key} factKey={shown.key} derived={derived[shown.key]} onDone={close} />
            ) : shown.type === "review" ? (
              <ReviewEditor onDone={close} />
            ) : (
              <ItemEditor key={shown.item?.id ?? shown.kind} kind={shown.kind} item={shown.item} name={name} onDone={close} />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const FactEditor = ({ factKey, derived, onDone }: { factKey: FactKey; derived?: string; onDone: () => void }) => {
  const facts = useMedicalFacts();
  const saved = facts[factKey];
  const [picks, setPicks] = useState<readonly string[]>(saved?.picks ?? []);
  const [detail, setDetail] = useState(saved?.detail ?? "");
  const options = FACT_OPTIONS[factKey];
  const clear = options[0];
  const changed = JSON.stringify(picks) !== JSON.stringify(saved?.picks ?? []) || detail.trim() !== (saved?.detail ?? "");

  const toggle = (option: string) => {
    void Haptics.selectionAsync();
    setPicks((now) => {
      if (option === clear) return now.includes(clear) ? [] : [clear];
      const rest = now.filter((p) => p !== clear);
      return rest.includes(option) ? rest.filter((p) => p !== option) : [...rest, option];
    });
  };

  return (
    <View>
      <Text style={styles.sheetTitle}>{FACT_LABEL[factKey]}</Text>
      {derived ? <Text style={styles.sheetNote}>{derived}</Text> : null}
      <View style={styles.chips}>
        {options.map((option) => (
          <Choice key={option} label={option} on={picks.includes(option)} onPress={() => toggle(option)} />
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={detail}
        onChangeText={setDetail}
        placeholder={FACT_HINT[factKey]}
        placeholderTextColor={text.tertiary}
        accessibilityLabel={`${FACT_LABEL[factKey]} details`}
        multiline
      />
      <SheetActions
        secondary={saved ? { label: "Clear", onPress: () => (saveFact(factKey, [], ""), onDone()) } : undefined}
        primary={{
          label: "Save",
          disabled: !changed,
          onPress: () => {
            saveFact(factKey, picks, detail);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDone();
          },
        }}
      />
    </View>
  );
};

const ItemEditor = ({ kind, item, name, onDone }: { kind: RecordKind; item: RecordItem | null; name: string; onDone: () => void }) => {
  const record = useHealthRecord();
  // The explanation can arrive while the sheet is open; read the live item so it appears in place.
  const live = item ? (record.items.find((i) => i.id === item.id) ?? item) : null;
  const have = new Set(record.items.filter((i) => i.kind === kind).map((i) => i.name.toLowerCase()));
  const suggestions = SUGGESTIONS[kind].filter((s) => !have.has(s.toLowerCase()));
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [typed, setTyped] = useState(item?.name ?? "");
  const [note, setNote] = useState(item?.note ?? "");

  if (item) {
    const changed = typed.trim() !== item.name || note.trim() !== item.note;
    return (
      <View>
        <Text style={styles.sheetTitle}>{item.name}</Text>
        <Text style={styles.sheetNote}>{kind === "allergy" ? `PAWS checks every food and treat for this.` : `Care and food advice take this into account.`}</Text>
        {live?.insight ? (
          <Insight
            insight={live.insight}
            rename={live.insight.name.toLowerCase() !== item.name.toLowerCase() && live.insight.name.toLowerCase() !== typed.trim().toLowerCase() ? live.insight.name : null}
            onRename={(n) => setTyped(n)}
          />
        ) : null}
        <TextInput style={[styles.input, styles.inputSingle]} value={typed} onChangeText={setTyped} placeholder="Name" placeholderTextColor={text.tertiary} accessibilityLabel="Name" />
        <TextInput
          style={styles.input}
          value={note}
          onChangeText={setNote}
          placeholder={kind === "allergy" ? "What happens, e.g. itchy paws" : "Diagnosed when, how it is managed"}
          placeholderTextColor={text.tertiary}
          accessibilityLabel="Notes"
          multiline
        />
        <SheetActions
          secondary={{
            label: "Remove",
            onPress: () =>
              Alert.alert(`Remove ${item.name}?`, `It will no longer be part of ${name}'s record.`, [
                { text: "Keep", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => {
                    removeRecordItem(item.id);
                    onDone();
                  },
                },
              ]),
          }}
          primary={{
            label: "Save",
            disabled: !changed || !typed.trim(),
            onPress: () => {
              updateRecordItem(item.id, { name: typed, note: note.trim() });
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onDone();
            },
          }}
        />
      </View>
    );
  }

  const count = picked.length + (typed.trim() ? 1 : 0);
  return (
    <View>
      <Text style={styles.sheetTitle}>{KIND_WORD[kind].add}</Text>
      <Text style={styles.sheetNote}>Pick any that apply, or type your own.</Text>
      {suggestions.length ? (
        <View style={styles.chips}>
          {suggestions.map((s) => (
            <Choice
              key={s}
              label={s}
              on={picked.includes(s)}
              onPress={() => {
                void Haptics.selectionAsync();
                setPicked((now) => (now.includes(s) ? now.filter((x) => x !== s) : [...now, s]));
              }}
            />
          ))}
        </View>
      ) : null}
      <TextInput
        style={[styles.input, styles.inputSingle]}
        value={typed}
        onChangeText={setTyped}
        placeholder={kind === "allergy" ? "Something else" : "Another condition"}
        placeholderTextColor={text.tertiary}
        accessibilityLabel={kind === "allergy" ? "Another allergy" : "Another condition"}
        returnKeyType="done"
      />
      <SheetActions
        primary={{
          label: count > 1 ? `Add ${count}` : "Add",
          disabled: count === 0,
          onPress: () => {
            [...picked, typed].forEach((n) => addRecordItem(kind, n));
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDone();
          },
        }}
      />
    </View>
  );
};

/** Gemini's reading of a condition or allergy: what it is, what changes, what to ask. */
const Insight = ({ insight, rename, onRename }: { insight: NonNullable<RecordItem["insight"]>; rename: string | null; onRename: (name: string) => void }) => (
  <View style={styles.insight}>
    <View style={styles.insightHead}>
      <SparkleIcon size={14} color={accent.band} weight="fill" />
      <Text style={styles.insightLabel}>What this means</Text>
    </View>
    <Text style={styles.insightPlain}>{insight.plain}</Text>
    {insight.seeVetSoon ? <Text style={styles.insightUrgent}>This sounds worth a vet call this week.</Text> : null}
    {insight.care.map((c) => (
      <View key={c} style={styles.insightRow}>
        <View style={styles.insightDot} />
        <Text style={styles.insightText}>{c}</Text>
      </View>
    ))}
    {insight.alsoListedAs.length ? <Text style={styles.insightAka}>{`On labels also as ${insight.alsoListedAs.join(", ")}`}</Text> : null}
    {insight.askVet.length ? (
      <>
        <Text style={styles.insightAsk}>Ask your vet</Text>
        {insight.askVet.map((q) => (
          <Text key={q} style={styles.insightQuestion}>
            {q}
          </Text>
        ))}
      </>
    ) : null}
    {rename ? (
      <PressScale accessibilityRole="button" accessibilityLabel={`Use the name ${rename}`} scaleTo={0.96} style={styles.rename} onPress={() => onRename(rename)}>
        <Text style={styles.renameText}>{`Use "${rename}"`}</Text>
      </PressScale>
    ) : null}
  </View>
);

/** After a visit: who looked over the printed record. PAWS cannot approve it; this records that a vet did. */
const ReviewEditor = ({ onDone }: { onDone: () => void }) => {
  const facts = useMedicalFacts();
  const [vet, setVet] = useState(facts.review?.vet ?? "");
  const [clinic, setClinic] = useState(facts.review?.clinic ?? "");
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return (
    <View>
      <Text style={styles.sheetTitle}>Vet review</Text>
      <Text style={styles.sheetNote}>Share the PDF at the visit. Once your vet has checked and signed it, note it here.</Text>
      <TextInput style={[styles.input, styles.inputSingle]} value={vet} onChangeText={setVet} placeholder="Vet's name, e.g. Dr. Han" placeholderTextColor={text.tertiary} accessibilityLabel="Vet's name" />
      <TextInput style={[styles.input, styles.inputSingle, styles.inputTight]} value={clinic} onChangeText={setClinic} placeholder="Clinic (optional)" placeholderTextColor={text.tertiary} accessibilityLabel="Clinic" />
      <SheetActions
        secondary={facts.review ? { label: "Remove", onPress: () => (saveVetReview(null), onDone()) } : undefined}
        primary={{
          label: "Reviewed today",
          disabled: !vet.trim(),
          onPress: () => {
            saveVetReview({ vet: vet.trim(), clinic: clinic.trim(), date: iso });
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDone();
          },
        }}
      />
    </View>
  );
};

const Choice = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} scaleTo={0.95} style={[styles.choice, on && styles.choiceOn]} onPress={onPress}>
    <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{label}</Text>
  </PressScale>
);

const SheetActions = ({ primary, secondary }: { primary: { label: string; disabled?: boolean; onPress: () => void }; secondary?: { label: string; onPress: () => void } }) => (
  <View style={styles.actions}>
    {secondary ? (
      <PressScale accessibilityRole="button" accessibilityLabel={secondary.label} scaleTo={0.95} style={styles.secondary} onPress={secondary.onPress}>
        <Text style={styles.secondaryText}>{secondary.label}</Text>
      </PressScale>
    ) : null}
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={primary.label}
      accessibilityState={{ disabled: primary.disabled }}
      disabled={primary.disabled}
      scaleTo={0.97}
      style={[styles.primary, primary.disabled && styles.primaryOff]}
      onPress={primary.onPress}
    >
      <Text style={[styles.primaryText, primary.disabled && styles.primaryTextOff]}>{primary.label}</Text>
    </PressScale>
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { marginTop: space.lg, padding: space.xl, borderRadius: radius.card + 8, backgroundColor: accent.soft },
  heroTitle: { ...type.sectionTitle, color: text.primary },
  stats: { flexDirection: "row", marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.canvas },
  stat: { flex: 1 },
  statRule: { width: 1, marginHorizontal: space.md, backgroundColor: border.soft },
  statLabel: { ...type.caption, color: text.tertiary },
  statValue: { ...type.supporting, fontWeight: "600", color: text.primary, marginTop: 2 },
  statValueFlag: { color: accent.band },

  review: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.md, paddingVertical: space.sm },
  reviewText: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },
  reviewTextOff: { color: text.secondary, fontWeight: "500" },
  insight: { marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft, gap: 6 },
  insightHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  insightLabel: { ...type.caption, fontWeight: "700", color: text.primary },
  insightPlain: { ...type.supporting, color: text.primary },
  insightUrgent: { ...type.supporting, fontWeight: "600", color: accent.band },
  insightRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  insightDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 8, backgroundColor: text.primary },
  insightText: { ...type.supporting, color: text.secondary, flex: 1 },
  insightQuestion: { ...type.supporting, color: text.secondary },
  insightAka: { ...type.caption, color: text.secondary },
  insightAsk: { ...type.caption, fontWeight: "700", color: text.primary, marginTop: 4 },
  rename: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: space.md, height: 32, justifyContent: "center", borderRadius: radius.pill, backgroundColor: bg.canvas },
  renameText: { ...type.caption, fontWeight: "600", color: text.primary },
  inputTight: { marginTop: space.sm },
  section: { marginTop: space.section },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: space.md },
  sectionTitle: { ...type.sectionTitle, fontSize: 22, lineHeight: 27, color: text.primary },
  sectionAction: { ...type.supporting, fontWeight: "600", color: text.secondary },
  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  disc: { width: 40, height: 40, borderRadius: 20, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  rowSub: { ...type.supporting, color: text.secondary, marginTop: 2 },
  rowSubMuted: { color: text.tertiary },
  trailing: { paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: bg.subtle },
  trailingFlag: { backgroundColor: accent.primary },
  trailingText: { ...type.caption, fontWeight: "600", color: text.primary },
  addRow: { minHeight: 56 },
  addDisc: { backgroundColor: accent.primary },
  addText: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },

  scrim: { backgroundColor: "rgba(28,27,26,0.32)" },
  lift: { flex: 1, justifyContent: "flex-end" },
  sheet: { paddingHorizontal: layout.gutter, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.canvas },
  grabZone: { alignItems: "center", paddingTop: space.md, paddingBottom: space.lg },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: border.default },
  sheetTitle: { ...type.pageTitle, color: text.primary },
  sheetNote: { ...type.supporting, color: text.secondary, marginTop: space.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  choice: { height: 38, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, justifyContent: "center" },
  choiceOn: { backgroundColor: text.primary, borderColor: text.primary },
  choiceText: { ...type.supporting, color: text.primary },
  choiceTextOn: { color: text.inverse, fontWeight: "600" },
  input: { minHeight: 84, marginTop: space.lg, padding: space.lg, paddingTop: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.default, ...type.body, color: text.primary, textAlignVertical: "top" },
  inputSingle: { minHeight: 52 },
  actions: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  secondary: { height: layout.controlHeight, paddingHorizontal: space.lg, justifyContent: "center" },
  secondaryText: { ...type.cardTitle, fontWeight: "600", color: text.secondary },
  primary: { flex: 1, height: layout.controlHeight, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  primaryOff: { backgroundColor: bg.subtle },
  primaryText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  primaryTextOff: { color: text.disabled },
});
