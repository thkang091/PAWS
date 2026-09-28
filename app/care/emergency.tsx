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
import * as Haptics from "expo-haptics";
import {
  ArrowUpIcon,
  ArrowUpRightIcon,
  CaretLeftIcon,
  FirstAidKitIcon,
  MapPinIcon,
  PhoneIcon,
  SkullIcon,
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
import { useProfileDraft } from "@/features/profile/state/profileDraft";
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
  | { id: string; from: "bot"; kind: "brief"; situation: Situation; at: string };

const ER_QUERY = "emergency vet open 24 hours";
const NONE = "None recorded";

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
  const draft = useProfileDraft();
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

  const conditions = draft.resolve("health", "Known conditions", NONE);
  const allergies = draft.resolve("health", "Allergies", NONE);

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

  const respond = (situation: Situation, spoken: string) => {
    void Haptics.impactAsync(situation.urgency === "watch" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy);
    setThread((current) => [...current, { id: nextId(), from: "me", text: spoken }]);
    const followUps: Message[] = [
      { id: nextId(), from: "bot", kind: "plan", situation },
      { id: nextId(), from: "bot", kind: "brief", situation, at: clock() },
    ];
    if (!place && situation.urgency !== "watch") followUps.push({ id: nextId(), from: "bot", kind: "place" });
    say(followUps);
  };

  const send = () => {
    const spoken = composer.trim();
    if (!spoken) return;
    setComposer("");
    const situation = matchSituation(spoken);
    if (situation) {
      respond(situation, spoken);
      return;
    }
    setThread((current) => [...current, { id: nextId(), from: "me", text: spoken }]);
    say([
      {
        id: nextId(),
        from: "bot",
        kind: "text",
        text: `I could not tell what is happening from that. If ${name} is struggling to breathe, has collapsed, is bleeding heavily or is in a lot of pain, go now. Otherwise pick the closest match below.`,
      },
    ]);
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
            ) : (
              <BriefCard
                name={name}
                breed={dog.data?.breed ?? null}
                age={dog.data?.ageYears ?? null}
                weight={weight}
                conditions={conditions === NONE ? null : conditions}
                allergies={allergies === NONE ? null : allergies}
                situation={message.situation}
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

const BriefCard = ({
  name,
  breed,
  age,
  weight,
  conditions,
  allergies,
  situation,
  at,
}: {
  name: string;
  breed: string | null;
  age: number | null;
  weight: string | null;
  conditions: string | null;
  allergies: string | null;
  situation: Situation;
  at: string;
}) => {
  const rows: [string, string][] = [
    ["Dog", [name, breed, age != null ? `${age} yr` : null].filter(Boolean).join(", ")],
    ["Weight", weight ?? "Not logged, estimate it"],
    ["Happened", `${situation.label}, noticed ${at}`],
    ["Conditions", conditions ?? "None on file"],
    ["Allergies", allergies ?? "None on file"],
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
