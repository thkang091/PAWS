import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  CaretLeftIcon,
  FirstAidKitIcon,
  MapPinIcon,
  BellIcon,
  CalendarPlusIcon,
  CheckIcon,
  PhoneIcon,
  SkullIcon,
  SparkleIcon,
} from "phosphor-react-native";

import { goBack } from "@/features/care/components/DetailShell";
import { PlaceField } from "@/features/care/components/PlaceField";
import {
  POISON_CONTROL,
  SITUATIONS,
  URGENCY,
  matchSituation,
  type Situation,
} from "@/features/care/components/emergencyGuide";
import { saveHome, useCareLocations, type SavedPlace } from "@/features/care/state/careLocations";
import { useHealthRecord } from "@/features/care/state/healthRecord";
import { useDogContext } from "@/features/care/intel/useDogContext";
import { useProfileDraft } from "@/features/profile/state/profileDraft";
import { useMedications } from "@/hooks/useCareHealth";
import { LEVEL_RANK, triage, type Triage, type TriageLevel } from "@/services/triage";
import { PressScale } from "@/components/ui/PressScale";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import { openLink } from "@/lib/openLink";
import { directionsUrl, mapsSearchUrl } from "@/services/placeSearch";
import type { Feed } from "@/services/serpApi";
import { findClinics, type Clinic } from "@/services/vetDirectory";
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

type Message =
  | { id: string; from: "me"; text: string }
  | { id: string; from: "bot"; kind: "text"; text: string }
  | { id: string; from: "bot"; kind: "place" }
  | { id: string; from: "bot"; kind: "er" }
  | { id: string; from: "bot"; kind: "plan"; situation: Situation }
  | { id: string; from: "bot"; kind: "triage"; result: Triage | null }
  | { id: string; from: "bot"; kind: "brief"; what: string; at: string };

/** The least a tapped situation can be. Typed words only get the red-flag rules, so "limping a bit" is not an ER trip. */
const TAPPED_FLOOR: Record<string, TriageLevel> = {
  collapse: "now",
  breathing: "now",
  choking: "now",
  seizure: "now",
  heat: "now",
  bleeding: "call",
  toxin: "call",
  injury: "call",
  stomach: "watch",
};
/** Situations where first aid cannot wait for anything: their scripted steps show at once. */
const INSTANT = new Set(["collapse", "breathing", "choking", "seizure", "heat"]);

const ER_QUERY = "emergency vet open 24 hours";

let counter = 0;
const nextId = () => `m${++counter}`;

const clock = () => {
  const now = new Date();
  const hour = now.getHours() % 12 || 12;
  return `${hour}:${String(now.getMinutes()).padStart(2, "0")} ${now.getHours() < 12 ? "am" : "pm"}`;
};

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const scroll = useRef<ScrollView>(null);

  const dog = useCurrentDog();
  const name = dog.data?.name ?? "your dog";
  const weights = useWeightLogs(dog.data?.id);
  const { home, hydrated } = useCareLocations();

  const [place, setPlace] = useState<SavedPlace | null>(home);
  const [er, setEr] = useState<Feed<Clinic>>({ state: "idle" });
  const [thread, setThread] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [composer, setComposer] = useState("");
  const started = useRef(false);

  const weight = useMemo(() => {
    const latest = (weights.data ?? [])[0];
    return latest ? `${latest.weightValue} ${latest.weightUnit}` : null;
  }, [weights.data]);

  // The emergency summary reads the real medical record, not a copy.
  const record = useHealthRecord();
  const meds = useMedications(dog.data?.id);
  const context = useDogContext();
  const conditions = record.items.filter((i) => i.kind === "condition").map((i) => i.insight?.name ?? i.name).join(", ") || null;
  const allergies = record.items.filter((i) => i.kind === "allergy").map((i) => i.name).join(", ") || null;
  const medicines = (meds.data ?? []).filter((m) => m.isActive).map((m) => [m.medicationName, m.dosage].filter(Boolean).join(" ")).join(", ") || null;

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    if (home) setPlace(home);
    setThread([
      { id: nextId(), from: "bot", kind: "text", text: `Tell me what is happening with ${name}. Tap the closest match or type it.` },
      home
        ? { id: nextId(), from: "bot", kind: "er" }
        : { id: nextId(), from: "bot", kind: "place" },
    ]);
  }, [hydrated, home, name]);

  useEffect(() => {
    if (!place) return;
    let live = true;
    setEr({ state: "loading" });
    void findClinics(place, ER_QUERY).then((result) => live && setEr(result));
    return () => {
      live = false;
    };
  }, [place]);

  const nearest = er.state === "ready" ? er.items[0] ?? null : null;

  const say = (messages: Message[]) => {
    setTyping(true);
    setTimeout(
      () => {
        setTyping(false);
        setThread((current) => [...current, ...messages]);
      },
      reduceMotion ? 0 : 520,
    );
  };

  // Each triage keeps what was described and the answers given, so a follow-up question can refine it.
  const [results, setResults] = useState<Record<string, Triage>>({});
  const asked = useRef<{ description: string; floor: TriageLevel; situation: Situation | null; answers: { question: string; answer: string }[] } | null>(null);

  const assess = (id: string) => {
    const now = asked.current;
    if (!now) return;
    void triage(now.description, now.answers, { name, weightKg: context.weightKg, stage: context.stage, brief: context.brief }, now.floor).then((result) => {
      let fitted = result;
      // Without Gemini, the situation's own first aid beats generic steps, and something eaten always gets the poison line.
      if (result.source === "rules" && now.situation) fitted = { ...fitted, steps: now.situation.steps(name) };
      if (now.situation?.poison && !fitted.toxin) fitted = { ...fitted, toxin: { risk: "unknown", note: `Depends on what it was, how much, and ${name}'s weight.` } };
      // Kept by card id, so an answer that arrives before its card is on screen is not lost.
      setResults((current) => ({ ...current, [id]: fitted }));
    });
  };

  const start = (description: string, floor: TriageLevel, situation: Situation | null) => {
    asked.current = { description, floor, situation, answers: [] };
    const triageId = nextId();
    const messages: Message[] = [
      ...(situation && INSTANT.has(situation.key) ? [{ id: nextId(), from: "bot" as const, kind: "plan" as const, situation }] : []),
      { id: triageId, from: "bot", kind: "triage", result: null },
      { id: nextId(), from: "bot", kind: "brief", what: situation?.label ?? description.slice(0, 60), at: clock() },
    ];
    const askedPlace = thread.some((m) => m.from === "bot" && m.kind === "place");
    if (!place && !askedPlace && LEVEL_RANK[floor] >= LEVEL_RANK.call) messages.push({ id: nextId(), from: "bot", kind: "place" });
    say(messages);
    assess(triageId);
  };

  const respond = (situation: Situation, spoken: string) => {
    const floor = TAPPED_FLOOR[situation.key] ?? "watch";
    void Haptics.impactAsync(floor === "now" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
    setThread((current) => [...current, { id: nextId(), from: "me", text: spoken }]);
    start(spoken, floor, situation);
  };

  const send = () => {
    const spoken = composer.trim();
    if (!spoken) return;
    setComposer("");
    void Haptics.selectionAsync();
    setThread((current) => [...current, { id: nextId(), from: "me", text: spoken }]);
    // Typed words are read for red flags, then graded for this dog; a matched situation only lends its first aid.
    start(spoken, "watch", matchSituation(spoken));
  };

  const answer = (question: string, reply: string) => {
    if (!asked.current) return;
    void Haptics.selectionAsync();
    asked.current = { ...asked.current, answers: [...asked.current.answers, { question, answer: reply }] };
    const triageId = nextId();
    // The question is answered, so its chips go away.
    setResults((current) => Object.fromEntries(Object.entries(current).map(([id, r]) => [id, r.ask?.question === question ? { ...r, ask: null } : r])));
    setThread((current) => [...current, { id: nextId(), from: "me", text: reply }]);
    say([{ id: triageId, from: "bot", kind: "triage", result: null }]);
    assess(triageId);
  };

  const onPlace = (next: SavedPlace) => {
    setPlace(next);
    saveHome(next);
    setThread((current) =>
      current.some((message) => message.from === "bot" && message.kind === "er")
        ? current
        : [...current, { id: nextId(), from: "bot", kind: "er" }],
    );
  };

  const callEr = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (nearest?.phone) void openLink(`tel:${nearest.phone}`);
    else void openLink(mapsSearchUrl("emergency vet", place));
  };

  const callPoison = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    void openLink(`tel:${POISON_CONTROL.number}`);
  };

  const enter = reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter).easing(motion.easing.out);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale accessibilityRole="button" accessibilityLabel="Back" style={styles.round} onPress={() => goBack("/(tabs)/care")}>
          <CaretLeftIcon size={iconSize.nav} color={text.primary} weight="bold" />
        </PressScale>
        <View style={styles.titleWrap}>
          <FirstAidKitIcon size={iconSize.standard} color={text.primary} weight="regular" />
          <Text style={styles.title}>Emergency</Text>
        </View>
        <View style={styles.round} />
      </View>

      <View style={styles.lifeline}>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={nearest ? `Call ${nearest.name}` : "Find an emergency vet in Maps"}
          scaleTo={0.97}
          style={styles.callEr}
          onPress={callEr}
        >
          <PhoneIcon size={iconSize.standard} color={text.inverse} weight="fill" />
          <View style={styles.callCopy}>
            <Text style={styles.callTitle}>Call ER vet</Text>
            <Text style={styles.callSub} numberOfLines={1}>
              {nearest ? `${nearest.name}${nearest.distance ? `, ${nearest.distance}` : ""}` : "Nearest one open now"}
            </Text>
          </View>
        </PressScale>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={`Call ${POISON_CONTROL.label}, ${POISON_CONTROL.display}`}
          scaleTo={0.97}
          style={styles.callPoison}
          onPress={callPoison}
        >
          <SkullIcon size={iconSize.standard} color={text.primary} weight="regular" />
          <Text style={styles.poisonTitle}>Poison line</Text>
        </PressScale>
      </View>

      <ScrollView
        ref={scroll}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: !reduceMotion })}
      >
        {thread.map((message) => (
          <Animated.View key={message.id} entering={enter} style={message.from === "me" ? styles.mineRow : styles.botRow}>
            {message.from === "me" ? (
              <View style={styles.mine}>
                <Text style={styles.mineText}>{message.text}</Text>
              </View>
            ) : message.kind === "text" ? (
              <View style={styles.bot}>
                <Text style={styles.botText}>{message.text}</Text>
              </View>
            ) : message.kind === "place" ? (
              <View style={[styles.bot, styles.botWide]}>
                <Text style={styles.botText}>Where are you right now? I will find the closest emergency vet and keep it for next time.</Text>
                <View style={styles.embed}>
                  <PlaceField value={place} home={home} onResolve={onPlace} />
                </View>
              </View>
            ) : message.kind === "er" ? (
              <ErCard feed={er} place={place} onChangePlace={() => setThread((current) => [...current, { id: nextId(), from: "bot", kind: "place" }])} />
            ) : message.kind === "plan" ? (
              <PlanCard situation={message.situation} name={name} onCallEr={callEr} onPoison={callPoison} nearest={nearest} />
            ) : message.kind === "triage" ? (
              <TriageCard result={results[message.id] ?? message.result} name={name} nearest={nearest} onCallEr={callEr} onPoison={callPoison} onAnswer={answer} />
            ) : (
              <BriefCard
                name={name}
                breed={dog.data?.breed ?? null}
                age={dog.data?.ageYears ?? null}
                weight={weight}
                conditions={conditions}
                allergies={allergies}
                medicines={medicines}
                what={message.what}
                at={message.at}
              />
            )}
          </Animated.View>
        ))}
        {typing ? <Typing /> : null}
        <Text style={styles.disclaimer}>
          PAWS gives first aid pointers, not a diagnosis. When in doubt, call the vet and go in.
        </Text>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.sm }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.replies}>
          {SITUATIONS.map((situation) => (
            <PressScale
              key={situation.key}
              accessibilityRole="button"
              accessibilityLabel={situation.label}
              scaleTo={0.95}
              style={[styles.reply, situation.urgency === "go" && styles.replyUrgent]}
              onPress={() => respond(situation, situation.label)}
            >
              <Text style={styles.replyText}>{situation.label}</Text>
            </PressScale>
          ))}
        </ScrollView>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={composer}
            onChangeText={setComposer}
            onSubmitEditing={send}
            placeholder={`Describe what ${name} is doing`}
            placeholderTextColor={text.tertiary}
            returnKeyType="send"
            accessibilityLabel="Describe what is happening"
          />
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Send"
            scaleTo={0.9}
            disabled={!composer.trim()}
            style={[styles.send, !composer.trim() && styles.sendOff]}
            onPress={send}
          >
            <ArrowUpIcon size={iconSize.standard} color={composer.trim() ? text.primary : text.disabled} weight="bold" />
          </PressScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const ErCard = ({
  feed,
  place,
  onChangePlace,
}: {
  feed: Feed<Clinic>;
  place: SavedPlace | null;
  onChangePlace: () => void;
}) => {
  const nearest = feed.state === "ready" ? feed.items[0] ?? null : null;
  const others = feed.state === "ready" ? feed.items.slice(1, 3) : [];
  return (
    <View style={[styles.bot, styles.botWide]}>
      <View style={styles.erHead}>
        <MapPinIcon size={iconSize.inline} color={text.secondary} weight="fill" />
        <Text style={styles.erNear} numberOfLines={1}>
          {place ? `Near ${place.label}` : "No address yet"}
        </Text>
        <PressScale accessibilityRole="button" accessibilityLabel="Change address" scaleTo={0.95} onPress={onChangePlace}>
          <Text style={styles.link}>Change</Text>
        </PressScale>
      </View>

      {feed.state === "loading" ? (
        <Text style={styles.botText}>Finding the closest emergency vet</Text>
      ) : nearest ? (
        <>
          <Text style={styles.erName}>{nearest.name}</Text>
          <Text style={styles.erMeta}>
            {[nearest.distance, nearest.openState].filter(Boolean).join(" · ") || nearest.address}
          </Text>
          <View style={styles.actions}>
            {nearest.phone ? (
              <ActionPill primary label="Call" icon={<PhoneIcon size={14} color={text.inverse} weight="fill" />} onPress={() => void openLink(`tel:${nearest.phone}`)} />
            ) : null}
            {nearest.address ? (
              <ActionPill label="Directions" icon={<ArrowUpRightIcon size={14} color={text.primary} weight="bold" />} onPress={() => void openLink(directionsUrl(nearest.address))} />
            ) : null}
          </View>
          {others.length > 0 ? (
            <Text style={styles.erOthers}>{`Also close: ${others.map((item) => item.name).join(", ")}`}</Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.botText}>
            The vet directory is not answering right now. Maps will show emergency vets open near you.
          </Text>
          <View style={styles.actions}>
            <ActionPill
              primary
              label="Open Maps"
              icon={<ArrowUpRightIcon size={14} color={text.inverse} weight="bold" />}
              onPress={() => void openLink(mapsSearchUrl("emergency vet", place))}
            />
          </View>
        </>
      )}
    </View>
  );
};

const PlanCard = ({
  situation,
  name,
  nearest,
  onCallEr,
  onPoison,
}: {
  situation: Situation;
  name: string;
  nearest: Clinic | null;
  onCallEr: () => void;
  onPoison: () => void;
}) => {
  const urgency = URGENCY[situation.urgency];
  return (
    <View style={[styles.bot, styles.botWide]}>
      <View style={[styles.badge, situation.urgency === "go" && styles.badgeGo, situation.urgency === "watch" && styles.badgeWatch]}>
        <Text style={[styles.badgeText, situation.urgency === "go" && styles.badgeTextGo]}>{urgency.label}</Text>
      </View>
      <Text style={styles.planLine}>{urgency.line}</Text>
      <View style={styles.steps}>
        {situation.steps(name).map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepIndex}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        {situation.poison ? (
          <ActionPill primary label="Poison line" icon={<PhoneIcon size={14} color={text.inverse} weight="fill" />} onPress={onPoison} />
        ) : null}
        {situation.urgency !== "watch" ? (
          <ActionPill
            primary={!situation.poison}
            label={nearest ? `Call ${nearest.name}` : "Call ER vet"}
            icon={<PhoneIcon size={14} color={situation.poison ? text.primary : text.inverse} weight="fill" />}
            onPress={onCallEr}
          />
        ) : null}
      </View>
    </View>
  );
};

const LEVEL_COPY: Record<TriageLevel, string> = { now: "Go now", call: "Call now", today: "Vet today", watch: "Watch at home" };

/**
 * What to do, fitted to this dog: the level, one line on why (naming the detail that decided it), the steps, and the
 * right next action for that level. A toxin shows its risk at this dog's weight. When one answer would change the
 * advice, the question sits at the bottom with answers to tap.
 */
const TriageCard = ({
  result,
  name,
  nearest,
  onCallEr,
  onPoison,
  onAnswer,
}: {
  result: Triage | null;
  name: string;
  nearest: Clinic | null;
  onCallEr: () => void;
  onPoison: () => void;
  onAnswer: (question: string, answer: string) => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [reminded, setReminded] = useState<string | null>(null);

  if (!result) {
    return (
      <View style={[styles.bot, styles.botWide]} accessibilityLabel={`Reading ${name}'s profile`}>
        <View style={styles.forHead}>
          <SparkleIcon size={14} color={accent.band} weight="fill" />
          <Text style={styles.forText}>{`Reading ${name}'s profile`}</Text>
        </View>
        <View style={[styles.bar, { width: "70%" }]} />
        <View style={[styles.bar, { width: "92%" }]} />
        <View style={[styles.bar, { width: "55%" }]} />
      </View>
    );
  }

  const remind = async () => {
    void Haptics.selectionAsync();
    const at = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
      await Notifications.scheduleNotificationAsync({
        content: { title: `Check on ${name}`, body: "Is it better, the same or worse? If worse, open Emergency.", sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      }).catch(() => undefined);
    }
    setReminded(`${at.getHours() % 12 || 12}:${String(at.getMinutes()).padStart(2, "0")} ${at.getHours() < 12 ? "am" : "pm"}`);
  };

  const urgent = result.level === "now" || result.level === "call";
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(motion.duration.enter)} style={[styles.bot, styles.botWide]}>
      <View style={styles.forRow}>
        <View style={[styles.badge, result.level === "now" && styles.badgeGo, result.level === "watch" && styles.badgeWatch, result.level === "today" && styles.badgeToday]}>
          <Text style={[styles.badgeText, result.level === "now" && styles.badgeTextGo]}>{LEVEL_COPY[result.level]}</Text>
        </View>
        {result.source === "gemini" ? (
          <View style={styles.forHead}>
            <SparkleIcon size={12} color={accent.band} weight="fill" />
            <Text style={styles.forText}>{`For ${name}`}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.planLine}>{result.headline}</Text>
      <Text style={styles.why}>{result.why}</Text>

      {result.toxin ? (
        <View style={[styles.toxin, result.toxin.risk === "high" && styles.toxinHigh]}>
          <Text style={[styles.toxinRisk, result.toxin.risk === "high" && styles.toxinRiskHigh]}>{`Risk: ${result.toxin.risk}`}</Text>
          {result.toxin.note ? <Text style={[styles.toxinNote, result.toxin.risk === "high" && styles.toxinNoteHigh]}>{result.toxin.note}</Text> : null}
        </View>
      ) : null}

      <View style={styles.steps}>
        {result.steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepIndex}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {result.avoid.length ? <Small title="Don't" lines={result.avoid} /> : null}
      {urgent || result.level === "today" ? (result.tell.length ? <Small title="When you call, say" lines={result.tell} /> : null) : null}
      {result.watch.length ? <Small title={result.level === "watch" ? "Call the vet if" : "Go in sooner if"} lines={result.watch} /> : null}

      {result.ask ? (
        <View style={styles.ask}>
          <Text style={styles.askText}>{result.ask.question}</Text>
          <View style={styles.askChips}>
            {result.ask.options.map((option) => (
              <PressScale key={option} accessibilityRole="button" accessibilityLabel={option} scaleTo={0.95} style={styles.askChip} onPress={() => onAnswer(result.ask!.question, option)}>
                <Text style={styles.askChipText}>{option}</Text>
              </PressScale>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {result.toxin ? <ActionPill primary label="Poison line" icon={<PhoneIcon size={14} color={text.inverse} weight="fill" />} onPress={onPoison} /> : null}
        {urgent ? (
          <ActionPill
            primary={!result.toxin}
            label={nearest ? `Call ${nearest.name}` : "Call ER vet"}
            icon={<PhoneIcon size={14} color={result.toxin ? text.primary : text.inverse} weight="fill" />}
            onPress={onCallEr}
          />
        ) : null}
        {result.level === "today" ? (
          <ActionPill
            primary
            label="Book a visit"
            icon={<CalendarPlusIcon size={14} color={text.inverse} weight="bold" />}
            onPress={() => router.push("/care/book-visit?reason=Feeling%20unwell" as never)}
          />
        ) : null}
        {result.level === "watch" || result.level === "today" ? (
          <ActionPill
            label={reminded ? `Reminder at ${reminded}` : "Check again in 2 hours"}
            icon={reminded ? <CheckIcon size={14} color={text.primary} weight="bold" /> : <BellIcon size={14} color={text.primary} weight="bold" />}
            onPress={() => (reminded ? undefined : void remind())}
          />
        ) : null}
      </View>
    </Animated.View>
  );
};

const Small = ({ title, lines }: { title: string; lines: readonly string[] }) => (
  <View style={styles.small}>
    <Text style={styles.smallTitle}>{title}</Text>
    {lines.map((line) => (
      <Text key={line} style={styles.smallLine}>{`· ${line}`}</Text>
    ))}
  </View>
);

const BriefCard = ({
  name,
  breed,
  age,
  weight,
  conditions,
  allergies,
  medicines,
  what,
  at,
}: {
  name: string;
  breed: string | null;
  age: number | null;
  weight: string | null;
  conditions: string | null;
  allergies: string | null;
  medicines: string | null;
  what: string;
  at: string;
}) => {
  // Identification lives on Profile; the emergency brief reads it so the vet hears the chip and who to call.
  const draft = useProfileDraft();
  // Only what the guardian actually entered; nothing is filled in for them.
  const known = (label: string) => {
    if (!draft.isEdited("about", label)) return null;
    const value = draft.resolve("about", label, "").trim();
    return value && value !== "Not recorded" && value !== "Not added" ? value : null;
  };
  const chip = known("Microchip number");
  const contact = known("Emergency contact");
  const rows: [string, string][] = [
    ["Dog", [name, breed, age != null ? `${age} yr` : null].filter(Boolean).join(", ")],
    ...(chip ? ([["Microchip", chip]] as [string, string][]) : []),
    ...(contact ? ([["Contact", contact]] as [string, string][]) : []),
    ["Weight", weight ?? "Not logged, estimate it"],
    ["Happened", `${what}, noticed ${at}`],
    ["Conditions", conditions ?? "None on file"],
    ["Allergies", allergies ?? "None on file"],
    ["Medicines", medicines ?? "None on file"],
  ];
  return (
    <View style={[styles.bot, styles.botWide, styles.brief]}>
      <Text style={styles.briefTitle}>Read this to the vet</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.briefRow}>
          <Text style={styles.briefLabel}>{label}</Text>
          <Text style={styles.briefValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
};

const ActionPill = ({
  label,
  icon,
  primary = false,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  onPress: () => void;
}) => (
  <PressScale
    accessibilityRole="button"
    accessibilityLabel={label}
    scaleTo={0.96}
    style={[styles.pill, primary && styles.pillPrimary]}
    onPress={onPress}
  >
    {icon}
    <Text style={[styles.pillText, primary && styles.pillTextPrimary]} numberOfLines={1}>
      {label}
    </Text>
  </PressScale>
);

const Dot = ({ delay }: { delay: number }) => {
  const opacity = useSharedValue(0.25);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 280 }), withTiming(0.25, { duration: 280 })), -1),
    );
  }, [delay, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, style]} />;
};

const Typing = () => (
  <View style={styles.botRow}>
    <View style={[styles.bot, styles.typing]} accessibilityLabel="PAWS is typing">
      <Dot delay={0} />
      <Dot delay={120} />
      <Dot delay={240} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
    paddingBottom: space.sm,
  },
  round: {
    width: layout.iconButton,
    height: layout.iconButton,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flexDirection: "row", alignItems: "center", gap: space.sm },
  title: { ...type.sectionTitle, color: text.primary },

  lifeline: { flexDirection: "row", gap: space.sm, paddingHorizontal: layout.gutter, paddingBottom: space.md },
  callEr: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    height: 60,
    borderRadius: radius.card,
    backgroundColor: text.primary,
  },
  callCopy: { flex: 1 },
  callTitle: { ...type.cardTitle, fontWeight: "700", color: text.inverse },
  callSub: { ...type.caption, color: "rgba(255,255,255,0.72)", marginTop: 1 },
  callPoison: {
    width: 96,
    height: 60,
    borderRadius: radius.card,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  poisonTitle: { ...type.caption, fontWeight: "700", color: text.primary },

  thread: { flex: 1, backgroundColor: bg.stage, borderTopWidth: 1, borderTopColor: border.soft },
  threadContent: { paddingHorizontal: layout.gutter, paddingTop: space.lg, paddingBottom: space.xl, gap: space.md },

  botRow: { alignItems: "flex-start" },
  mineRow: { alignItems: "flex-end" },
  bot: {
    maxWidth: "86%",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    backgroundColor: bg.canvas,
    borderWidth: 1,
    borderColor: border.soft,
  },
  botWide: { maxWidth: "100%", width: "100%" },
  botText: { ...type.body, color: text.primary },
  mine: {
    maxWidth: "80%",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    backgroundColor: text.primary,
  },
  mineText: { ...type.body, color: text.inverse },
  embed: { marginTop: space.md },

  erHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space.sm },
  erNear: { ...type.caption, color: text.secondary, flex: 1 },
  link: { ...type.caption, fontWeight: "700", color: text.primary, textDecorationLine: "underline" },
  erName: { ...type.sectionTitle, color: text.primary, marginTop: space.sm },
  erMeta: { ...type.supporting, color: text.secondary, marginTop: 2 },
  erOthers: { ...type.caption, color: text.tertiary, marginTop: space.md },

  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  badgeGo: { backgroundColor: text.primary },
  badgeWatch: { backgroundColor: accent.primary },
  badgeToday: { backgroundColor: accent.band },
  forRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  forHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  forText: { ...type.caption, fontWeight: "600", color: text.secondary },
  bar: { height: 12, borderRadius: 6, backgroundColor: bg.subtle, marginTop: space.md },
  why: { ...type.supporting, color: text.secondary, marginTop: 4, lineHeight: 21 },
  toxin: { marginTop: space.md, padding: space.md, borderRadius: radius.control, backgroundColor: accent.soft },
  toxinHigh: { backgroundColor: text.primary },
  toxinRisk: { ...type.supporting, fontWeight: "700", color: text.primary, textTransform: "capitalize" },
  toxinRiskHigh: { color: text.inverse },
  toxinNote: { ...type.caption, color: text.secondary, marginTop: 2, lineHeight: 17 },
  toxinNoteHigh: { color: "rgba(255,255,255,0.78)" },
  small: { marginTop: space.lg },
  smallTitle: { ...type.caption, fontWeight: "700", color: text.secondary, marginBottom: 2 },
  smallLine: { ...type.caption, color: text.secondary, lineHeight: 18 },
  ask: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: border.soft },
  askText: { ...type.supporting, fontWeight: "600", color: text.primary },
  askChips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  askChip: { paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: accent.primary },
  askChipText: { ...type.supporting, fontWeight: "600", color: text.primary },
  badgeText: { ...type.caption, fontWeight: "700", color: text.primary },
  badgeTextGo: { color: text.inverse },
  planLine: { ...type.body, fontWeight: "600", color: text.primary, marginTop: space.md },
  steps: { marginTop: space.md, gap: space.md },
  step: { flexDirection: "row", gap: space.md },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: "hidden",
    textAlign: "center",
    ...type.caption,
    lineHeight: 22,
    fontWeight: "700",
    color: text.primary,
    backgroundColor: accent.primary,
  },
  stepText: { ...type.supporting, color: text.secondary, flex: 1, lineHeight: 21 },

  brief: { backgroundColor: accent.soft, borderColor: accent.primary },
  briefTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary, marginBottom: space.sm },
  briefRow: { flexDirection: "row", gap: space.md, paddingVertical: 6 },
  briefLabel: { ...type.caption, color: text.secondary, width: 76, paddingTop: 2 },
  briefValue: { ...type.supporting, fontWeight: "600", color: text.primary, flex: 1 },

  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  pillPrimary: { backgroundColor: text.primary },
  pillText: { ...type.supporting, fontWeight: "700", color: text.primary, flexShrink: 1 },
  pillTextPrimary: { color: text.inverse },

  typing: { flexDirection: "row", gap: 5, paddingVertical: 14 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: text.secondary },

  disclaimer: { ...type.caption, color: text.tertiary, textAlign: "center", marginTop: space.lg, lineHeight: 17 },

  dock: { backgroundColor: bg.canvas, borderTopWidth: 1, borderTopColor: border.soft, paddingTop: space.sm },
  replies: { gap: space.sm, paddingHorizontal: layout.gutter, paddingBottom: space.sm },
  reply: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: border.soft,
  },
  replyUrgent: { borderColor: accent.deep },
  replyText: { ...type.supporting, fontWeight: "600", color: text.primary },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginHorizontal: layout.gutter,
    paddingLeft: space.lg,
    paddingRight: 6,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: bg.subtle,
  },
  input: { flex: 1, ...type.body, color: text.primary, paddingVertical: 0 },
  send: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  sendOff: { backgroundColor: bg.canvas },
});
