import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  LinearTransition,
  useReducedMotion,
  ZoomIn,
} from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  CaretLeftIcon,
  CheckCircleIcon,
  CheckIcon,
  ProhibitIcon,
  QuestionIcon,
  ScalesIcon,
  WarningIcon,
} from "phosphor-react-native";

import { goBack } from "@/features/care/components/DetailShell";
import { CoachComposer } from "@/features/train/components/coach/CoachComposer";
import { CoachMark, CoachThinking } from "@/features/train/components/coach/CoachReply";
import { UserBubble } from "@/features/train/components/coach/UserBubble";
import { PressScale } from "@/components/ui/PressScale";
import { useCareProfile } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useAddFoodRule, useFoodChecks, useFoodRules, useSaveFoodCheck } from "@/hooks/useFood";
import { useWeightLogs } from "@/hooks/useWeightLogs";
import { askFood, type FoodAnswer, type FoodTurn } from "@/services/foodCheck";
import type { FoodVerdict } from "@/services/foodService";
import { transcribe, type ChatImage, type VoiceClip } from "@/services/trainerChat";
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

type Turn =
  | { id: string; role: "user"; text: string; image?: ChatImage }
  | { id: string; role: "paws"; answer: FoodAnswer; question: string };

const SUGGESTIONS = ["Grapes", "Peanut butter", "Cooked chicken bone", "Carrot", "Cheese"];

const VERDICT: Record<
  FoodVerdict,
  { label: string; icon: typeof CheckCircleIcon; card: object; pill: object; ink: string; soft: string }
> = {
  safe: {
    label: "Fine to share",
    icon: CheckCircleIcon,
    card: { backgroundColor: accent.primary },
    pill: { backgroundColor: bg.canvas },
    ink: text.primary,
    soft: text.secondary,
  },
  caution: {
    label: "Small amounts only",
    icon: WarningIcon,
    card: { backgroundColor: accent.soft, borderWidth: 1, borderColor: accent.deep },
    pill: { backgroundColor: accent.deep },
    ink: text.primary,
    soft: text.secondary,
  },
  avoid: {
    label: "Don't give",
    icon: ProhibitIcon,
    card: { backgroundColor: text.primary },
    pill: { backgroundColor: accent.deep },
    ink: text.inverse,
    soft: "rgba(255,255,255,0.72)",
  },
  unknown: {
    label: "Not sure yet",
    icon: QuestionIcon,
    card: { backgroundColor: bg.canvas, borderWidth: 1, borderColor: border.default },
    pill: { backgroundColor: bg.subtle },
    ink: text.primary,
    soft: text.secondary,
  },
};

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
};

const ageFrom = (birthday: string | null, ageYears: number | null) => {
  if (birthday) {
    const years = (Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 3600 * 1000);
    return Math.max(0, Math.round(years * 10) / 10);
  }
  return ageYears;
};

export default function FoodCheckScreen() {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ start?: string }>();

  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const name = dog.data?.name ?? "your dog";
  const careProfile = useCareProfile(dogId);
  const weights = useWeightLogs(dogId);
  const rules = useFoodRules(dogId);
  const checks = useFoodChecks(dogId);
  const addRule = useAddFoodRule(dogId);
  const saveCheck = useSaveFoodCheck(dogId);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const started = useRef(false);

  const ruleNames = useMemo(
    () => new Set((rules.data ?? []).map((rule) => rule.name.toLowerCase())),
    [rules.data],
  );

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const latestKg = useMemo(() => {
    const entry = (weights.data ?? [])[0];
    if (!entry) return null;
    const kg = entry.weightUnit === "kg" ? entry.weightValue : entry.weightValue * 0.4536;
    return Math.round(kg * 10) / 10;
  }, [weights.data]);

  const send = async (message: { text: string; image?: ChatImage }) => {
    if (busy) return;
    const question = message.text.trim();
    if (!question && !message.image) return;

    setNotice(null);
    const userTurn: Turn = { id: `u${Date.now()}`, role: "user", text: question, image: message.image };
    const history: FoodTurn[] = turns.map((turn) =>
      turn.role === "user"
        ? { role: "user", text: turn.text || "A photo of a food." }
        : { role: "paws", text: `${turn.answer.headline}. ${turn.answer.reason}` },
    );
    setTurns((current) => [...current, userTurn]);
    setBusy(message.image ? "Looking at the photo" : `Checking ${question.toLowerCase()}`);

    const reply = await askFood(
      {
        name,
        breed: dog.data?.breed ?? null,
        ageYears: dog.data ? ageFrom(dog.data.birthday, dog.data.ageYears) : null,
        weightKg: latestKg,
        currentFood: careProfile.data?.foodBrand ?? null,
        rules: rules.data ?? [],
      },
      history,
      { text: question, image: message.image },
    );
    setBusy(null);

    if (reply.state !== "ready") {
      setTurns((current) => current.filter((turn) => turn.id !== userTurn.id));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setNotice({
        text:
          reply.state === "unconfigured"
            ? "Food checks need the Gemini key in this build."
            : reply.state === "offline"
              ? "Could not reach the checker. Check your connection and try again."
              : "That did not come back clearly. Try again, or type the food's name.",
        action: reply.state === "unconfigured" ? undefined : { label: "Try again", run: () => void send(message) },
      });
      return;
    }

    const answer = reply.answer;
    void Haptics.notificationAsync(
      answer.verdict === "avoid"
        ? Haptics.NotificationFeedbackType.Warning
        : answer.verdict === "safe"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
    );
    setTurns((current) => [
      ...current,
      { id: `p${Date.now()}`, role: "paws", answer, question: question || "Photo" },
    ]);
    if (answer.verdict !== "unknown") {
      saveCheck.mutate({
        question: question || "Photo",
        foodName: answer.food,
        verdict: answer.verdict,
        headline: answer.headline,
        answer: answer.reason,
        hadPhoto: Boolean(message.image),
      });
    }
  };

  const sendVoice = async (clip: VoiceClip) => {
    setBusy("Listening back");
    const heard = await transcribe(clip);
    setBusy(null);
    if (heard.state === "ready") {
      void send({ text: heard.text });
      return;
    }
    setNotice({
      text:
        heard.state === "silent"
          ? "Could not hear a food name. Try again, or type it."
          : "Voice is not available right now. Type the food instead.",
    });
  };

  const snap = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setNotice({
        text: "PAWS needs the camera to check a food by photo.",
        action: permission.canAskAgain ? undefined : { label: "Open Settings", run: () => void Linking.openSettings() },
      });
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.5,
        base64: true,
        exif: false,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (asset?.base64) {
        void send({
          text: "",
          image: { base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg", uri: asset.uri },
        });
      }
    } catch {
      setNotice({ text: "The camera is not available here. Use the photo button to choose one instead." });
    }
  };

  useEffect(() => {
    if (params.start === "camera" && !started.current && dogId) {
      started.current = true;
      void snap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.start, dogId]);

  const addToList = (food: string) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addRule.mutate({ name: food, kind: "never" });
  };

  const settle = reduceMotion ? undefined : LinearTransition.duration(motion.duration.enter);
  const ruleCount = rules.data?.length ?? 0;
  const recent = (checks.data ?? []).slice(0, 5);

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
          accessibilityLabel={`What ${name} can't eat, ${ruleCount} on the list`}
          scaleTo={0.95}
          style={styles.listChip}
          onPress={() => router.push("/care/food-rules")}
        >
          <ProhibitIcon size={iconSize.inline} color={text.primary} weight="bold" />
          <Text style={styles.listChipText}>
            {ruleCount > 0 ? `${ruleCount} can't eat` : "Can't-eat list"}
          </Text>
        </PressScale>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + space.sm}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: !reduceMotion })}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}>
            <CoachMark breathing={false} reduceMotion={reduceMotion} size={40} />
            <Text style={styles.title}>Can {name} eat this?</Text>
            <Text style={styles.lede}>
              Send a photo or type a food. PAWS checks it against {name}&rsquo;s
              {ruleCount > 0
                ? ` size, age and the ${ruleCount} ${ruleCount === 1 ? "food" : "foods"} on the can't-eat list.`
                : " size and age."}
            </Text>
          </Animated.View>

          {turns.length === 0 ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter).delay(120)}
              style={styles.suggestions}
            >
              {SUGGESTIONS.map((item) => (
                <PressScale
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask about ${item}`}
                  scaleTo={0.94}
                  style={styles.suggestion}
                  onPress={() => void send({ text: item })}
                >
                  <Text style={styles.suggestionText}>{item}</Text>
                </PressScale>
              ))}
            </Animated.View>
          ) : null}

          {turns.length === 0 && recent.length > 0 ? (
            <View style={styles.recent}>
              <Text style={styles.recentTitle}>Checked before</Text>
              {recent.map((check, index) => {
                const look = VERDICT[check.verdict];
                const Icon = look.icon;
                return (
                  <View key={check.id} style={[styles.recentRow, index > 0 && styles.recentRule]}>
                    <View style={[styles.recentBadge, look.card]}>
                      <Icon size={14} color={look.ink} weight="bold" />
                    </View>
                    <Text style={styles.recentText} numberOfLines={1}>
                      {check.headline}
                    </Text>
                    <Text style={styles.recentWhen}>{ago(check.createdAt)}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {turns.map((turn) => (
            <Animated.View key={turn.id} layout={settle} style={styles.turn}>
              {turn.role === "user" ? (
                <UserBubble
                  turn={{ text: turn.text, imageUri: turn.image?.uri }}
                  animate
                  reduceMotion={reduceMotion}
                />
              ) : (
                <Verdict
                  answer={turn.answer}
                  name={name}
                  reduceMotion={reduceMotion}
                  onList={Boolean(turn.answer.food && ruleNames.has(turn.answer.food.toLowerCase()))}
                  onAdd={() => turn.answer.food && addToList(turn.answer.food)}
                  onRetake={() => void snap()}
                />
              )}
            </Animated.View>
          ))}

          {busy ? (
            <Animated.View layout={settle} style={styles.turn}>
              <CoachThinking label={busy} reduceMotion={reduceMotion} />
            </Animated.View>
          ) : null}

          {notice ? (
            <Animated.View
              entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}
              layout={settle}
              style={styles.note}
            >
              <Text style={styles.noteText}>{notice.text}</Text>
              {notice.action ? (
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={notice.action.label}
                  scaleTo={0.96}
                  style={styles.noteAction}
                  onPress={notice.action.run}
                >
                  <Text style={styles.noteActionText}>{notice.action.label}</Text>
                </PressScale>
              ) : null}
            </Animated.View>
          ) : null}

          <Text style={styles.privacy}>
            Photos go to Google Gemini to answer and are not kept. Not a substitute for your vet.
          </Text>
        </ScrollView>

        <CoachComposer
          placeholder="A food, a snack, a brand"
          busy={Boolean(busy)}
          reduceMotion={reduceMotion}
          bottomInset={keyboardUp ? 0 : insets.bottom}
          inputRef={inputRef}
          onSend={(message) => void send(message)}
          onVoice={(clip) => void sendVoice(clip)}
          onNotice={(message, action) => setNotice(message ? { text: message, action } : null)}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const Verdict = ({
  answer,
  name,
  reduceMotion,
  onList,
  onAdd,
  onRetake,
}: {
  answer: FoodAnswer;
  name: string;
  reduceMotion: boolean;
  onList: boolean;
  onAdd: () => void;
  onRetake: () => void;
}) => {
  const look = VERDICT[answer.verdict];
  const Icon = look.icon;
  const inverted = answer.verdict === "avoid";

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : FadeIn.duration(280)
              .easing(motion.easing.out)
              .withInitialValues({ transform: [{ scale: 0.96 }, { translateY: 10 }] })
      }
      style={[styles.card, look.card]}
      accessibilityRole="summary"
      accessibilityLabel={`${look.label}. ${answer.headline}. ${answer.reason}`}
    >
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.duration(motion.duration.enter).delay(140).easing(motion.easing.out)}
        style={[styles.pill, look.pill]}
      >
        <Icon size={16} color={text.primary} weight="bold" />
        <Text style={styles.pillText}>{look.label}</Text>
      </Animated.View>

      <Text style={[styles.headline, { color: look.ink }]}>{answer.headline}</Text>
      {answer.reason ? <Text style={[styles.reason, { color: look.soft }]}>{answer.reason}</Text> : null}

      {answer.amount && (answer.verdict === "safe" || answer.verdict === "caution") ? (
        <View style={[styles.amount, inverted && styles.amountInverted]}>
          <ScalesIcon size={iconSize.inline} color={look.ink} weight="bold" />
          <Text style={[styles.amountText, { color: look.ink }]}>
            For {name}: {answer.amount}
          </Text>
        </View>
      ) : null}

      {answer.watchFor.length > 0 ? (
        <View style={styles.watch}>
          <Text style={[styles.watchTitle, { color: look.ink }]}>Watch for</Text>
          {answer.watchFor.map((sign) => (
            <View key={sign} style={styles.watchRow}>
              <View style={[styles.watchDot, { backgroundColor: inverted ? accent.deep : text.primary }]} />
              <Text style={[styles.watchText, { color: look.soft }]}>{sign}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {answer.verdict === "avoid" && answer.food ? (
        onList ? (
          <View style={styles.onList}>
            <CheckIcon size={iconSize.inline} color={accent.deep} weight="bold" />
            <Text style={styles.onListText}>On {name}&rsquo;s can&rsquo;t-eat list</Text>
          </View>
        ) : (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={`Add ${answer.food} to ${name}'s can't-eat list`}
            scaleTo={0.97}
            style={styles.addRule}
            onPress={onAdd}
          >
            <ProhibitIcon size={iconSize.inline} color={text.primary} weight="bold" />
            <Text style={styles.addRuleText}>Add {answer.food.toLowerCase()} to the list</Text>
          </PressScale>
        )
      ) : null}

      {answer.verdict === "unknown" ? (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Take a closer photo"
          scaleTo={0.97}
          style={styles.retake}
          onPress={onRetake}
        >
          <Text style={styles.retakeText}>Take a closer photo</Text>
        </PressScale>
      ) : null}
    </Animated.View>
  );
};

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
  listChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
  },
  listChipText: { ...type.supporting, fontWeight: "600", color: text.primary },

  thread: { paddingHorizontal: layout.gutter, paddingTop: space.xl, paddingBottom: space.xl },
  title: {
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.9,
    fontWeight: "700",
    color: text.primary,
    marginTop: space.lg,
  },
  lede: { ...type.body, color: text.secondary, marginTop: space.sm },

  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xl },
  suggestion: {
    height: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.default,
    justifyContent: "center",
  },
  suggestionText: { ...type.supporting, fontWeight: "600", color: text.primary },

  recent: { marginTop: space.section },
  recentTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary, marginBottom: space.sm },
  recentRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  recentRule: { borderTopWidth: 1, borderTopColor: border.soft },
  recentBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  recentText: { ...type.supporting, color: text.primary, flex: 1 },
  recentWhen: { ...type.caption, color: text.tertiary },

  turn: { marginTop: space.xl },

  card: { borderRadius: 26, padding: space.xl },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    height: 30,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  pillText: { ...type.supporting, fontWeight: "700", color: text.primary },
  headline: {
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.5,
    fontWeight: "700",
    marginTop: space.lg,
  },
  reason: { ...type.body, marginTop: space.sm },
  amount: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(28,27,26,0.12)",
  },
  amountInverted: { borderTopColor: "rgba(255,255,255,0.18)" },
  amountText: { ...type.supporting, fontWeight: "600", flex: 1 },
  watch: { marginTop: space.lg, gap: 6 },
  watchTitle: { ...type.supporting, fontWeight: "700" },
  watchRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  watchDot: { width: 5, height: 5, borderRadius: 3 },
  watchText: { ...type.supporting, flex: 1 },
  addRule: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.sm,
    height: 44,
    marginTop: space.xl,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: accent.deep,
  },
  addRuleText: { ...type.supporting, fontWeight: "700", color: text.primary },
  onList: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xl },
  onListText: { ...type.supporting, fontWeight: "600", color: text.inverse },
  retake: {
    alignSelf: "flex-start",
    height: 44,
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    justifyContent: "center",
  },
  retakeText: { ...type.supporting, fontWeight: "700", color: text.inverse },

  note: {
    marginTop: space.xl,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: border.default,
    gap: space.md,
  },
  noteText: { ...type.supporting, color: text.primary },
  noteAction: {
    alignSelf: "flex-start",
    height: 36,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: text.primary,
    justifyContent: "center",
  },
  noteActionText: { ...type.supporting, fontWeight: "700", color: text.inverse },
  privacy: { ...type.caption, color: text.tertiary, marginTop: space.section },
});
