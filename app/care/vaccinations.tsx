import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { CalendarPlusIcon, CheckIcon, MagnifyingGlassIcon, PlusIcon, SparkleIcon, SyringeIcon, TrashIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { FieldLabel, FlowSheet } from "@/features/care/components/FlowSheet";
import { MonthPicker } from "@/features/care/components/MonthPicker";
import { addDays, fromKey, todayKey } from "@/features/care/health/medPlan";
import { useCareLocations } from "@/features/care/state/careLocations";
import { PressScale } from "@/components/ui/PressScale";
import { VACCINE_SCHEDULE } from "@/constants/careHealth";
import { ageInMonths } from "@/constants/carePlanByAge";
import { useDeleteVaccination, useSaveVaccination, useVaccinations } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import type { Vaccination } from "@/services/careHealthService";
import { VACCINE_KEYS, quickRead, readVaccine, searchKeys, type VaccineKey, type VaccineRead } from "@/services/vaccineReader";
import { accent, bg, border, icon as iconSize, motion, radius, space, text, type } from "@/constants/design";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const longDate = (key: string) => {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};
const monthYear = (key: string) => {
  const d = fromKey(key);
  return `${MONTH[d.getMonth()]} ${d.getFullYear()}`;
};

const daysFrom = (key: string) => Math.round((fromKey(key).getTime() - fromKey(todayKey()).getTime()) / 86_400_000);

const inWords = (days: number) => {
  const n = Math.abs(days);
  if (n < 45) return `${n} ${n === 1 ? "day" : "days"}`;
  if (n < 540) return `${Math.round(n / 30)} months`;
  return `${Math.round(n / 365)} ${Math.round(n / 365) === 1 ? "year" : "years"}`;
};

const addMonths = (given: string, months: number) => {
  const d = fromKey(given);
  // Under a month is a puppy series gap, counted in days (0.7 is three weeks).
  if (months < 1) d.setDate(d.getDate() + Math.round(months * 30));
  else d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const monthsBetween = (a: string, b: string) => Math.max(1, Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / (30.44 * 86_400_000)));

/** A puppy's series: core shots every 3 to 4 weeks until about 16 weeks, then the first booster a year on. */
const PUPPY_SERIES = new Set(["dhpp", "leptospirosis", "lyme", "influenza"]);
const puppyMonths = (key: string, ageMonths: number | null): number | null => {
  if (ageMonths == null || ageMonths >= 5) return null;
  return PUPPY_SERIES.has(key) && ageMonths < 4 ? 0.7 : 12;
};

const REPEATS: readonly { label: string; months: number | null }[] = [
  { label: "Every year", months: 12 },
  { label: "Every 3 years", months: 36 },
  { label: "Every 6 months", months: 6 },
  { label: "Doesn't repeat", months: null },
];

const WHO_FOR: Record<string, string> = {
  bordetella: "Daycare, boarding and groomers usually ask for it",
  lyme: "For walks in woods or long grass in tick country",
  influenza: "For dogs who mix with lots of other dogs",
};

type State = "overdue" | "missing" | "soon" | "ok" | "once";

type Row = {
  key: string;
  name: string;
  short: string;
  core: boolean;
  known: boolean;
  months: number | null;
  description: string;
  records: Vaccination[];
  latest: Vaccination | null;
  days: number | null;
  state: State;
  elapsed: number;
};

const RANK: Record<State, number> = { overdue: 0, missing: 1, soon: 2, ok: 3, once: 4 };

const STATUS_LABEL: Record<State, string> = {
  overdue: "Overdue",
  missing: "No record",
  soon: "Due soon",
  ok: "Covered",
  once: "Given",
};

const statusText = (row: Row) =>
  row.state === "overdue"
    ? `Overdue by ${inWords(row.days ?? 0)}`
    : row.state === "missing"
      ? "Not on record yet"
      : row.state === "soon"
        ? `Due in ${inWords(row.days ?? 0)}`
        : row.state === "once"
          ? `Given ${longDate(row.latest!.dateGiven)}`
          : `Covered until ${longDate(row.latest!.nextDueDate!)}`;

const cycle = (months: number | null) =>
  months == null ? "One-off" : months < 1 ? "Every 3 weeks" : months >= 12 ? `Every ${months === 12 ? "year" : `${months / 12} years`}` : `Every ${months} months`;

export default function VaccinationsScreen() {
  const reduceMotion = useReducedMotion();
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const dogName = dog.data?.name ?? "your dog";
  const ageMonths = ageInMonths(dog.data?.birthday ?? null, dog.data?.ageYears ?? null);
  const puppy = ageMonths != null && ageMonths < 5;
  const vaccinations = useVaccinations(dogId);
  const saveVacc = useSaveVaccination(dogId);
  const deleteVacc = useDeleteVaccination(dogId);
  const { clinics } = useCareLocations();

  const rows = useMemo<Row[]>(() => {
    const all = vaccinations.data ?? [];
    const build = (key: string, name: string, core: boolean, known: boolean, fallbackMonths: number | null, description: string): Row => {
      const records = all.filter((record) => record.vaccineKey === key);
      const latest = records[0] ?? null;
      const months = latest?.nextDueDate ? monthsBetween(latest.dateGiven, latest.nextDueDate) : latest ? null : fallbackMonths;
      const days = latest?.nextDueDate ? daysFrom(latest.nextDueDate) : null;
      const state: State = !latest ? "missing" : days === null ? "once" : days < 0 ? "overdue" : days <= 45 ? "soon" : "ok";
      const span = latest?.nextDueDate ? daysFrom(latest.nextDueDate) - daysFrom(latest.dateGiven) : 1;
      return {
        key,
        name,
        short: name.replace(/\s*\(.*\)$/, ""),
        core,
        known,
        months,
        description,
        records,
        latest,
        days,
        state,
        elapsed: days === null ? (latest ? 1 : 0) : Math.min(1, Math.max(0, (span - days) / Math.max(1, span))),
      };
    };
    const scheduled = VACCINE_SCHEDULE.map((item) =>
      build(item.key, item.name, item.required, true, puppyMonths(item.key, ageMonths) ?? item.intervalMonths, item.description),
    );
    const customKeys = [...new Set(all.map((record) => record.vaccineKey))].filter((key) => !VACCINE_SCHEDULE.some((item) => item.key === key));
    const custom = customKeys.map((key) => {
      const first = all.find((record) => record.vaccineKey === key)!;
      return build(key, first.vaccineName, false, false, null, "Added by you.");
    });
    return [...scheduled, ...custom];
  }, [vaccinations.data, ageMonths]);

  const core = rows.filter((row) => row.core);
  const given = rows.filter((row) => !row.core && row.latest);
  const worthAsking = rows.filter((row) => !row.core && !row.latest && row.known);

  const needs = core.filter((row) => row.state === "overdue" || row.state === "missing");
  const soon = rows.filter((row) => row.state === "soon").sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  const focus = [...core, ...given].sort((a, b) => RANK[a.state] - RANK[b.state] || (a.days ?? 0) - (b.days ?? 0))[0] ?? null;

  const headline =
    needs.length === 0 && soon.length === 0
      ? `${dogName} is protected`
      : needs.length > 0
        ? needs.length === 1
          ? `${needs[0].short} ${needs[0].state === "overdue" ? "is overdue" : "needs a record"}`
          : `${needs.length} core shots need you`
        : `${soon[0].short} is due soon`;

  const subline =
    needs.length > 0
      ? "Log it if the vet already gave it. Otherwise book a visit."
      : soon.length > 0
        ? `Aim for ${longDate(soon[0].latest!.nextDueDate!)}.`
        : "Every core shot is current.";

  const [flowOpen, setFlowOpen] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [preselect, setPreselect] = useState<string | null>(null);

  const openLog = (key: string | null) => {
    const wasOpen = Boolean(detail);
    setDetail(null);
    setPreselect(key);
    setTimeout(() => setFlowOpen(true), wasOpen ? 380 : 0);
  };

  const book = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/care/book-visit?reason=Vaccines" as never);
  };

  const remove = (record: Vaccination, row: Row) => {
    Alert.alert("Remove this record?", `${row.short}, given ${longDate(record.dateGiven)}.`, [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setDetail(null);
          deleteVacc.mutate(record.id);
        },
      },
    ]);
  };

  const enter = (order: number) =>
    reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).delay(order * 70).easing(motion.easing.out);

  const needsVisit = focus && (focus.state === "overdue" || focus.state === "missing" || focus.state === "soon");

  return (
    <DetailShell
      title="Vaccinations"
      glyph={<SyringeIcon size={iconSize.standard} color={text.primary} weight="regular" />}
      action={{
        label: "Log a vaccine",
        icon: <PlusIcon size={iconSize.button} color={text.primary} weight="bold" />,
        onPress: () => openLog(null),
      }}
    >
      <Animated.View entering={enter(0)}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subline}>{subline}</Text>
        {needsVisit ? (
          <View style={styles.heroActions}>
            <PressScale accessibilityRole="button" accessibilityLabel="Book a visit" scaleTo={0.97} style={styles.primary} onPress={book}>
              <CalendarPlusIcon size={iconSize.inline} color={text.inverse} weight="bold" />
              <Text style={styles.primaryText}>Book a visit</Text>
            </PressScale>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Log ${focus.short}`}
              scaleTo={0.97}
              style={styles.secondary}
              onPress={() => openLog(focus.key)}
            >
              <Text style={styles.secondaryText}>{`Log ${focus.short}`}</Text>
            </PressScale>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View entering={enter(1)}>
        <SectionHead title="Core" note="Every dog needs these" />
        <View style={styles.list}>
          {core.map((row, index) => (
            <CoverageRow key={row.key} row={row} order={index} ruled={index > 0} onPress={() => setDetail(row)} onLog={() => openLog(row.key)} />
          ))}
        </View>
      </Animated.View>

      {given.length > 0 ? (
        <Animated.View entering={enter(2)} layout={reduceMotion ? undefined : LinearTransition.duration(motion.duration.select)}>
          <SectionHead title="Also given" note={`${given.length} on record`} />
          <View style={styles.list}>
            {given.map((row, index) => (
              <CoverageRow key={row.key} row={row} order={index} ruled={index > 0} onPress={() => setDetail(row)} onLog={() => openLog(row.key)} />
            ))}
          </View>
        </Animated.View>
      ) : null}

      {worthAsking.length > 0 ? (
        <Animated.View entering={enter(3)}>
          <SectionHead title="Worth asking your vet" note="" />
          <View style={styles.list}>
            {worthAsking.map((row, index) => (
              <PressScale
                key={row.key}
                accessibilityRole="button"
                accessibilityLabel={`${row.short}. ${WHO_FOR[row.key] ?? row.description}`}
                scaleTo={0.985}
                style={[styles.askRow, index > 0 && styles.ruled]}
                onPress={() => setDetail(row)}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{row.short}</Text>
                  <Text style={styles.askWhy}>{WHO_FOR[row.key] ?? row.description}</Text>
                </View>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${row.short}`}
                  hitSlop={8}
                  scaleTo={0.94}
                  style={styles.logChip}
                  onPress={() => openLog(row.key)}
                >
                  <PlusIcon size={12} color={text.primary} weight="bold" />
                  <Text style={styles.logChipText}>Log</Text>
                </PressScale>
              </PressScale>
            ))}
          </View>
        </Animated.View>
      ) : null}

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Log a vaccine that is not listed"
        scaleTo={0.98}
        style={styles.other}
        onPress={() => openLog("other")}
      >
        <PlusIcon size={iconSize.inline} color={text.primary} weight="bold" />
        <Text style={styles.otherText}>Log a vaccine not listed here</Text>
      </PressScale>

      <VaccineDetail row={detail} onClose={() => setDetail(null)} onLog={(key) => openLog(key)} onRemove={remove} onBook={book} />

      <LogFlow
        puppy={puppy}
        open={flowOpen}
        rows={rows}
        preselect={preselect}
        clinics={clinics.map((clinic) => clinic.name)}
        busy={saveVacc.isPending}
        onClose={() => setFlowOpen(false)}
        onSave={(inputs) => {
          // One shot can count for several vaccines; each gets its own record so each schedule moves forward.
          void (async () => {
            try {
              for (const input of inputs) await saveVacc.mutateAsync(input);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setFlowOpen(false);
            } catch {
              Alert.alert("Not saved", "Check the connection and try again.");
            }
          })();
        }}
      />
    </DetailShell>
  );
}

const SectionHead = ({ title, note }: { title: string; note: string }) => (
  <View style={styles.sectionHead}>
    <Text style={styles.section}>{title}</Text>
    <Text style={styles.sectionNote}>{note}</Text>
  </View>
);

const Badge = ({ state }: { state: State }) => (
  <View
    style={[
      styles.badge,
      state === "ok" && styles.badgeOk,
      state === "once" && styles.badgeOk,
      state === "soon" && styles.badgeSoon,
      state === "overdue" && styles.badgeLate,
    ]}
  >
    {state === "ok" || state === "once" ? <CheckIcon size={11} color={text.primary} weight="bold" /> : null}
    <Text style={[styles.badgeText, state === "overdue" && styles.badgeTextLate]}>{STATUS_LABEL[state]}</Text>
  </View>
);

const CoverageRow = ({
  row,
  order,
  ruled,
  onPress,
  onLog,
}: {
  row: Row;
  order: number;
  ruled: boolean;
  onPress: () => void;
  onLog: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const remaining = 1 - row.elapsed;
  const grow = useDerivedValue(
    () =>
      reduceMotion
        ? remaining
        : withDelay(motion.duration.enter + order * 70, withTiming(remaining, { duration: motion.duration.flourish, easing: motion.easing.out })),
    [remaining, order, reduceMotion],
  );
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0.02, grow.value) * 100}%` }));

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={`${row.name}. ${statusText(row)}`}
      scaleTo={0.985}
      style={[styles.row, ruled && styles.ruled]}
      onPress={onPress}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {row.short}
        </Text>
        {row.latest ? (
          <Badge state={row.state} />
        ) : (
          <PressScale accessibilityRole="button" accessibilityLabel={`Log ${row.short}`} hitSlop={8} scaleTo={0.94} style={styles.logChip} onPress={onLog}>
            <PlusIcon size={12} color={text.primary} weight="bold" />
            <Text style={styles.logChipText}>Log</Text>
          </PressScale>
        )}
      </View>

      {row.latest && row.latest.nextDueDate ? (
        <>
          <View style={styles.track}>
            <Animated.View style={[styles.trackFill, row.state === "soon" && styles.trackSoon, row.state === "overdue" && styles.trackLate, fill]} />
          </View>
          <View style={styles.dates}>
            <Text style={styles.dateText}>{`Given ${monthYear(row.latest.dateGiven)}`}</Text>
            <Text style={[styles.dateText, (row.state === "overdue" || row.state === "soon") && styles.dateStrong]}>
              {`${row.state === "overdue" ? "Was due" : "Due"} ${monthYear(row.latest.nextDueDate)}`}
            </Text>
          </View>
        </>
      ) : row.latest ? (
        <Text style={styles.rowMeta}>{`Given ${longDate(row.latest.dateGiven)}. No repeat set.`}</Text>
      ) : (
        <Text style={[styles.rowMeta, styles.missingMeta]}>
          {row.months != null && row.months < 1 ? "Not on record. Puppy shots every 3 to 4 weeks until 16 weeks." : `Not on record. ${cycle(row.months)}, from the date on the vaccine card.`}
        </Text>
      )}
    </PressScale>
  );
};

const VaccineDetail = ({
  row,
  onClose,
  onLog,
  onRemove,
  onBook,
}: {
  row: Row | null;
  onClose: () => void;
  onLog: (key: string) => void;
  onRemove: (record: Vaccination, row: Row) => void;
  onBook: () => void;
}) => {
  const [shown, setShown] = useState<Row | null>(row);
  useEffect(() => {
    if (row) setShown(row);
  }, [row]);
  if (!shown) return null;

  return (
    <FlowSheet
      open={Boolean(row)}
      title={shown.short}
      lede={`${shown.description} ${cycle(shown.months)}.`}
      step={0}
      total={1}
      direction={1}
      primary={{ label: shown.latest ? "Log a new dose" : "Log it", onPress: () => onLog(shown.key) }}
      onBack={onClose}
      onClose={onClose}
    >
      <View style={styles.detailStatus}>
        <Badge state={shown.state} />
        <Text style={styles.detailStatusText}>{statusText(shown)}</Text>
      </View>

      {shown.state !== "ok" && shown.state !== "once" ? (
        <PressScale accessibilityRole="button" accessibilityLabel="Book a visit" scaleTo={0.97} style={[styles.secondary, styles.detailBook]} onPress={onBook}>
          <CalendarPlusIcon size={iconSize.inline} color={text.primary} weight="bold" />
          <Text style={styles.secondaryText}>Book a visit for it</Text>
        </PressScale>
      ) : null}

      <FieldLabel>{shown.records.length > 0 ? "History" : "No doses logged"}</FieldLabel>
      {shown.records.length === 0 ? (
        <Text style={styles.rowMeta}>The date is on the vaccine card or the vet's invoice. PAWS counts the next one from there.</Text>
      ) : (
        shown.records.map((record, index) => (
          <View key={record.id} style={[styles.historyRow, index > 0 && styles.ruled]}>
            <View style={[styles.historyDot, index === 0 && styles.historyDotLatest]} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{longDate(record.dateGiven)}</Text>
              <Text style={styles.rowMeta}>
                {[record.vetName, record.nextDueDate ? `next due ${longDate(record.nextDueDate)}` : "no repeat"].filter(Boolean).join(", ")}
              </Text>
            </View>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={`Remove the record from ${longDate(record.dateGiven)}`}
              scaleTo={0.9}
              style={styles.trash}
              onPress={() => onRemove(record, shown)}
            >
              <TrashIcon size={iconSize.inline} color={text.tertiary} weight="regular" />
            </PressScale>
          </View>
        ))
      )}
    </FlowSheet>
  );
};

const WHEN = [
  { label: "Today", offset: 0 },
  { label: "Yesterday", offset: -1 },
  { label: "Last week", offset: -7 },
  { label: "Last month", offset: -30 },
] as const;

const slug = (name: string) => `other-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

const SHORT_NAME: Record<VaccineKey, string> = Object.fromEntries(VACCINE_SCHEDULE.map((v) => [v.key, v.name.replace(/\s*\(.*\)$/, "")])) as Record<VaccineKey, string>;
const CHIP: Record<VaccineKey, string> = { rabies: "Rabies", dhpp: "DHPP", leptospirosis: "Lepto", bordetella: "Bordetella", lyme: "Lyme", influenza: "Flu" };
const FULL_NAME: Record<VaccineKey, string> = Object.fromEntries(VACCINE_SCHEDULE.map((v) => [v.key, v.name])) as Record<VaccineKey, string>;

const listWords = (items: readonly string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

type SaveInput = { vaccineKey: string; vaccineName: string; dateGiven: string; nextDueDate: string | null; vetName: string | null; notes: string | null };

/** A name typed from the card, read into what it covers. The local reading shows at once; Gemini's replaces it. */
type Typed = { text: string; read: VaccineRead; reading: boolean; covers: VaccineKey[]; edited: boolean };

const LogFlow = ({
  puppy,
  open,
  rows,
  preselect,
  clinics,
  busy,
  onClose,
  onSave,
}: {
  puppy: boolean;
  open: boolean;
  rows: readonly Row[];
  preselect: string | null;
  clinics: readonly string[];
  busy: boolean;
  onClose: () => void;
  onSave: (inputs: SaveInput[]) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [key, setKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState<Typed | null>(null);
  const [given, setGiven] = useState(todayKey());
  const [calendar, setCalendar] = useState(false);
  const [vet, setVet] = useState("");
  const [months, setMonths] = useState<number | null>(12);
  const latest = useRef(typed);
  latest.current = typed;

  const pastVets = useMemo(() => {
    const names = rows.flatMap((row) => row.records.map((record) => record.vetName)).filter((name): name is string => Boolean(name));
    return [...new Set([...clinics, ...names])].slice(0, 4);
  }, [rows, clinics]);

  const row = key && key !== "other" ? rows.find((item) => item.key === key) ?? null : null;
  const isOther = key === "other" && typed != null;
  const name = isOther ? typed.read.name : row?.short ?? "";

  // Listed vaccines match their other names too ("parvo" finds DHPP); ones added before match by name.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const listed = new Set<string>(searchKeys(q));
    return rows.filter((item) => (item.known ? listed.has(item.key) : !q || item.name.toLowerCase().includes(q)));
  }, [rows, query]);
  const exact = shown.some((item) => item.short.toLowerCase() === query.trim().toLowerCase());
  const canUseTyped = query.trim().length >= 2 && !exact;

  useEffect(() => {
    if (!open) return;
    const pre = preselect && preselect !== "other" ? rows.find((item) => item.key === preselect) : null;
    setKey(pre ? pre.key : null);
    setQuery("");
    setTyped(null);
    setStep(pre ? 1 : 0);
    setDirection(1);
    setGiven(todayKey());
    setCalendar(false);
    setVet(pastVets[0] ?? "");
    setMonths(pre ? pre.months : 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const chooseTyped = () => {
    const text = query.trim();
    void Haptics.selectionAsync();
    const local = quickRead(text);
    setKey("other");
    setTyped({ text, read: local, reading: true, covers: local.covers, edited: false });
    setMonths(local.months);
    void readVaccine(text).then((ai) => {
      setTyped((now) => (!now || now.text !== text ? now : !ai ? { ...now, reading: false } : { ...now, read: ai, reading: false, covers: now.edited ? now.covers : ai.covers }));
      if (ai && latest.current?.text === text && !latest.current.edited) setMonths(ai.months);
    });
  };

  const toggleCover = (cover: VaccineKey) => {
    void Haptics.selectionAsync();
    setTyped((now) =>
      now ? { ...now, edited: true, covers: now.covers.includes(cover) ? now.covers.filter((c) => c !== cover) : [...now.covers, cover] } : now,
    );
  };

  const next = months == null ? null : addMonths(given, months);
  const preset = WHEN.find((item) => addDays(todayKey(), item.offset) === given);
  const base = puppy ? [{ label: "In 3 weeks", months: 0.7 }, ...REPEATS] : REPEATS;
  const repeats = months != null && !base.some((r) => r.months === months) ? [...base, { label: `Every ${months} months`, months }] : base;
  const covered = isOther ? typed.covers.map((c) => SHORT_NAME[c]) : [];

  const go = (to: number) => {
    void Haptics.selectionAsync();
    setDirection(to > step ? 1 : -1);
    setStep(to);
  };

  const pickKey = (to: string) => {
    void Haptics.selectionAsync();
    setKey(to);
    setTyped(null);
    const target = rows.find((item) => item.key === to);
    setMonths(target ? target.months : 12);
  };

  const save = () => {
    const base = { dateGiven: given, nextDueDate: next, vetName: vet.trim() || null };
    if (!isOther) return onSave([{ ...base, vaccineKey: key as string, vaccineName: row!.name, notes: null }]);
    const product = typed.read.name;
    // A combo counts for every vaccine it covers, so DHPP and Leptospirosis both move forward from one shot.
    if (typed.covers.length) {
      return onSave(typed.covers.map((cover) => ({ ...base, vaccineKey: cover, vaccineName: FULL_NAME[cover], notes: `Given as ${product}` })));
    }
    onSave([{ ...base, vaccineKey: slug(product), vaccineName: product, notes: null }]);
  };

  return (
    <FlowSheet
      open={open}
      title={step === 0 ? "Which vaccine?" : `When was ${name || "it"} given?`}
      lede={step === 0 ? "Search, or type the name on the card." : undefined}
      step={step}
      total={2}
      direction={direction}
      primary={
        step === 0
          ? { label: "Next", disabled: !name || name.length < 2 || Boolean(isOther && typed.reading), busy: Boolean(isOther && typed.reading), onPress: () => go(1) }
          : { label: covered.length > 1 ? `Save for ${covered.length} vaccines` : "Save record", busy, onPress: save }
      }
      onBack={() => go(step - 1)}
      onClose={onClose}
    >
      {step === 0 ? (
        <>
          <View style={styles.search}>
            <MagnifyingGlassIcon size={18} color={text.tertiary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                if (key === "other") {
                  setKey(null);
                  setTyped(null);
                }
              }}
              placeholder="Nobivac DAPPv+L4, kennel cough"
              placeholderTextColor={text.tertiary}
              autoFocus={preselect === "other"}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => canUseTyped && chooseTyped()}
              accessibilityLabel="Vaccine name"
            />
          </View>

          {isOther ? (
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter)} style={[styles.readCard, !typed.read.isVaccine && styles.readCardWarn]}>
              <View style={styles.readHead}>
                {typed.reading ? <ActivityIndicator size="small" color={text.secondary} /> : <SparkleIcon size={16} color={text.primary} weight="fill" />}
                <Text style={styles.readName} numberOfLines={2}>
                  {typed.read.name}
                </Text>
              </View>
              <Text style={styles.readNote}>
                {typed.reading
                  ? "Reading the name"
                  : typed.read.note ??
                    (typed.covers.length ? `Counts for ${listWords(covered)}.` : "Kept as its own vaccine. Pick what it covers if any apply.")}
              </Text>
              {typed.read.isVaccine ? (
                <>
                  <Text style={styles.readLabel}>Covers</Text>
                  <View style={styles.chips}>
                    {VACCINE_KEYS.map((cover) => {
                      const on = typed.covers.includes(cover);
                      return (
                        <PressScale
                          key={cover}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }}
                          accessibilityLabel={SHORT_NAME[cover]}
                          scaleTo={0.95}
                          style={[styles.coverChip, on && styles.coverChipOn]}
                          onPress={() => toggleCover(cover)}
                        >
                          {on ? <CheckIcon size={12} color={text.primary} weight="bold" /> : null}
                          <Text style={[styles.pillText, on && styles.pillTextOn]}>{CHIP[cover]}</Text>
                        </PressScale>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </Animated.View>
          ) : null}

          {isOther ? null : (
          <View style={[styles.list, styles.pickList]}>
            {canUseTyped ? (
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={`Use ${query.trim()}`}
                scaleTo={0.985}
                style={[styles.pickRow, styles.useRow]}
                onPress={chooseTyped}
              >
                <View style={styles.useMark}>
                  <SparkleIcon size={14} color={text.primary} weight="fill" />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{`Use "${query.trim()}"`}</Text>
                  <Text style={styles.rowMeta}>PAWS works out what it covers</Text>
                </View>
              </PressScale>
            ) : null}
            {shown.map((item, index) => {
              const on = item.key === key;
              return (
                <PressScale
                  key={item.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${item.short}. ${statusText(item)}`}
                  scaleTo={0.985}
                  style={[styles.pickRow, (index > 0 || canUseTyped) && styles.ruled, on && styles.pickOn]}
                  onPress={() => pickKey(item.key)}
                >
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <CheckIcon size={12} color={text.primary} weight="bold" /> : null}</View>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{item.short}</Text>
                    <Text style={styles.rowMeta}>{statusText(item)}</Text>
                  </View>
                  {item.core ? <Text style={styles.coreTag}>Core</Text> : null}
                </PressScale>
              );
            })}
          </View>
          )}
        </>
      ) : null}

      {step === 1 ? (
        <>
          <FieldLabel>Date given</FieldLabel>
          <View style={styles.chips}>
            {WHEN.map((item) => {
              const on = preset?.label === item.label && !calendar;
              return (
                <PressScale
                  key={item.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={item.label}
                  scaleTo={0.95}
                  style={[styles.pill, on && styles.pillOn]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setCalendar(false);
                    setGiven(addDays(todayKey(), item.offset));
                  }}
                >
                  <Text style={[styles.pillText, on && styles.pillTextOn]}>{item.label}</Text>
                </PressScale>
              );
            })}
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Pick a date"
              scaleTo={0.95}
              style={[styles.pill, (calendar || !preset) && styles.pillOn]}
              onPress={() => setCalendar((value) => !value)}
            >
              <Text style={[styles.pillText, (calendar || !preset) && styles.pillTextOn]}>{preset ? "Pick a date" : longDate(given)}</Text>
            </PressScale>
          </View>
          {calendar ? (
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.select)} style={styles.calendar}>
              <MonthPicker
                range="past"
                selected={given}
                reduceMotion={reduceMotion}
                onPick={(day) => {
                  setGiven(day.key);
                  setCalendar(false);
                }}
              />
            </Animated.View>
          ) : null}

          <FieldLabel>How often</FieldLabel>
          <View style={styles.chips}>
            {repeats.map((item) => {
              const on = item.months === months;
              return (
                <PressScale
                  key={item.label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={item.label}
                  scaleTo={0.95}
                  style={[styles.pill, on && styles.pillOn]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setMonths(item.months);
                  }}
                >
                  <Text style={[styles.pillText, on && styles.pillTextOn]}>{item.label}</Text>
                </PressScale>
              );
            })}
          </View>
          {key === "rabies" ? <Text style={styles.hint}>Rabies shots last one or three years depending on the product. It is on the certificate.</Text> : null}

          <FieldLabel>Where</FieldLabel>
          {pastVets.length > 0 ? (
            <View style={[styles.chips, styles.chipsGap]}>
              {pastVets.map((clinic) => {
                const on = clinic === vet;
                return (
                  <PressScale
                    key={clinic}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={clinic}
                    scaleTo={0.95}
                    style={[styles.pill, on && styles.pillOn]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setVet(on ? "" : clinic);
                    }}
                  >
                    <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>
                      {clinic}
                    </Text>
                  </PressScale>
                );
              })}
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            value={vet}
            onChangeText={setVet}
            placeholder="Clinic or vet, optional"
            placeholderTextColor={text.tertiary}
            accessibilityLabel="Clinic or vet"
          />

          <Animated.View key={`${next}-${months}`} entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} style={styles.preview}>
            <Text style={styles.previewLabel}>{next ? `Next ${name}` : "No repeat"}</Text>
            <Text style={styles.previewDate}>{next ? longDate(next) : "Just this one"}</Text>
            <Text style={styles.previewNote}>
              {covered.length > 1
                ? `Counts for ${listWords(covered)}.`
                : !next
                ? "PAWS keeps it on record and will not remind you."
                : daysFrom(next) < 0
                  ? `That date has passed, so ${name} will show as overdue.`
                  : "PAWS flags it six weeks ahead."}
            </Text>
          </Animated.View>
        </>
      ) : null}
    </FlowSheet>
  );
};

const styles = StyleSheet.create({
  headline: { ...type.hero, fontSize: 34, lineHeight: 38, color: text.primary, marginTop: space.md },
  subline: { ...type.body, color: text.secondary, marginTop: space.sm },
  heroActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
  },
  primaryText: { ...type.supporting, fontWeight: "700", color: text.inverse },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  secondaryText: { ...type.supporting, fontWeight: "700", color: text.primary },

  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.section, marginBottom: space.md },
  section: { ...type.sectionTitle, color: text.primary },
  sectionNote: { ...type.caption, color: text.tertiary },

  list: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, overflow: "hidden", backgroundColor: bg.canvas },
  ruled: { borderTopWidth: 1, borderTopColor: border.soft },
  row: { paddingHorizontal: space.lg, paddingVertical: space.lg },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  rowCopy: { flex: 1 },
  rowTitle: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary, flexShrink: 1 },
  rowMeta: { ...type.caption, color: text.tertiary, marginTop: 4, lineHeight: 17, flexShrink: 1 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  badgeOk: { backgroundColor: accent.primary },
  badgeSoon: { backgroundColor: accent.deep },
  badgeLate: { backgroundColor: text.primary },
  badgeText: { ...type.caption, fontWeight: "700", color: text.primary },
  badgeTextLate: { color: text.inverse },

  track: { height: 6, borderRadius: radius.pill, backgroundColor: bg.subtle, overflow: "hidden", marginTop: space.md },
  trackFill: { height: "100%", borderRadius: radius.pill, backgroundColor: accent.deep },
  trackSoon: { backgroundColor: accent.band },
  trackLate: { backgroundColor: text.primary },
  dates: { flexDirection: "row", justifyContent: "space-between", marginTop: space.sm },
  dateText: { ...type.caption, color: text.tertiary, fontVariant: ["tabular-nums"] },
  dateStrong: { color: text.primary, fontWeight: "700" },
  missingMeta: { color: text.secondary },

  askRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.lg },
  askWhy: { ...type.supporting, color: text.secondary, marginTop: 2 },
  logChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
  },
  logChipText: { ...type.caption, fontWeight: "700", color: text.primary },

  other: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.lg,
    paddingVertical: space.lg,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: border.default,
  },
  otherText: { ...type.supporting, fontWeight: "600", color: text.primary },

  detailStatus: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  detailStatusText: { ...type.cardTitle, fontWeight: "600", color: text.primary, flex: 1 },
  detailBook: { alignSelf: "flex-start", marginTop: space.lg },
  historyRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
  historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: border.default },
  historyDotLatest: { backgroundColor: accent.deep },
  trash: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: bg.subtle },

  pickList: { marginTop: space.xl },
  pickRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, backgroundColor: bg.canvas },
  pickOn: { backgroundColor: accent.soft },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: border.strong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: accent.deep, backgroundColor: accent.deep },
  coreTag: {
    ...type.caption,
    fontWeight: "700",
    color: text.primary,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: accent.primary,
    overflow: "hidden",
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chipsGap: { marginTop: space.sm, marginBottom: space.sm },
  pill: { paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.soft, maxWidth: "100%" },
  pillOn: { backgroundColor: accent.primary, borderColor: accent.deep },
  pillText: { ...type.supporting, color: text.secondary },
  pillTextOn: { color: text.primary, fontWeight: "600" },
  hint: { ...type.caption, color: text.secondary, marginTop: space.sm, lineHeight: 17 },
  calendar: { marginTop: space.md, padding: space.sm, borderRadius: radius.card, backgroundColor: bg.subtle },
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

  search: { flexDirection: "row", alignItems: "center", gap: space.sm, height: 52, marginTop: space.xl, paddingHorizontal: space.lg, borderRadius: radius.input, backgroundColor: bg.subtle },
  searchInput: { flex: 1, height: 52, ...type.body, color: text.primary },
  useRow: { backgroundColor: accent.soft },
  useMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: accent.primary, alignItems: "center", justifyContent: "center" },
  readCard: { marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  readCardWarn: { backgroundColor: bg.subtle },
  readHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  readName: { ...type.cardTitle, fontSize: 17, fontWeight: "600", color: text.primary, flex: 1 },
  readNote: { ...type.supporting, color: text.secondary, marginTop: 6 },
  readLabel: { ...type.caption, fontWeight: "700", color: text.secondary, marginTop: space.lg, marginBottom: space.sm },
  coverChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.soft, backgroundColor: bg.canvas },
  coverChipOn: { backgroundColor: accent.primary, borderColor: accent.deep },
  preview: { marginTop: space.xxl, padding: space.xl, borderRadius: radius.card + 4, backgroundColor: accent.primary },
  previewLabel: { ...type.supporting, fontWeight: "600", color: text.secondary },
  previewDate: { ...type.pageTitle, color: text.primary, marginTop: 4 },
  previewNote: { ...type.caption, color: text.secondary, marginTop: space.sm, lineHeight: 17 },
});
