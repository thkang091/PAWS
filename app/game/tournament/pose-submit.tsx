import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { ArrowCounterClockwiseIcon, CameraIcon, ImagesIcon, LockSimpleIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { CriteriaList, PoseImage } from "@/features/photoPose/components/PoseParts";
import { ENTRY_TEXT, HELD_TEXT, poseError } from "@/features/photoPose/copy";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { poseKeys, usePhotoChallenges, useReferenceUrl } from "@/hooks/usePhotoPose";
import { requestReview, submitEntry, type SubmitResult } from "@/services/mediaService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";
import { criteriaFor } from "../../../supabase/functions/media/entryCheck";

const PICK: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [4, 5], quality: 0.85, exif: false };

/**
 * Take or choose your photo, compare it with the reference, and send it. No tutorial: the reference and the three
 * things that make it count are on the same screen as the camera button.
 */
export default function PoseSubmitScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId: string }>();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const dog = useCurrentDog();
  const challenges = usePhotoChallenges();
  const c = (challenges.data ?? []).find((x) => x.challengeId === challengeId) ?? null;
  const ref = useReferenceUrl(c?.referencePath);
  const [uri, setUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSettings, setNeedsSettings] = useState(false);
  const [result, setResult] = useState<SubmitResult["entry"] | null>(null);
  const [asked, setAsked] = useState(false);

  const criteria = c ? criteriaFor(c.instructions?.criteria ?? [], c.requiresOwner) : [];

  const pick = async (from: "camera" | "library") => {
    setError(null);
    setNeedsSettings(false);
    try {
      const perm = from === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError(from === "camera" ? "PAWS needs the camera to take your photo." : "PAWS needs your photos to choose one.");
        setNeedsSettings(!perm.canAskAgain);
        return;
      }
      const res = from === "camera" ? await ImagePicker.launchCameraAsync(PICK) : await ImagePicker.launchImageLibraryAsync(PICK);
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.mimeType && !/jpe?g/i.test(a.mimeType)) {
        setError("Use a JPEG photo. Most phone photos are, once cropped here.");
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setUri(a.uri);
      setResult(null);
    } catch {
      setError(from === "camera" ? "The camera isn't available on this device. Choose a photo instead." : "Couldn't open your photos.");
    }
  };

  const send = async () => {
    if (!c || !uri) return;
    setSending(true);
    setError(null);
    try {
      const r = await submitEntry(c.challengeId, dog.data?.id ?? null, uri);
      setResult(r.entry);
      void Haptics.notificationAsync(r.entry.status === "approved" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      await Promise.all([queryClient.invalidateQueries({ queryKey: poseKeys.challenges }), queryClient.invalidateQueries({ queryKey: poseKeys.seasonal })]);
    } catch (e) {
      setError(poseError((e as { code?: string }).code));
    } finally {
      setSending(false);
    }
  };

  const askPerson = async () => {
    if (!result) return;
    setError(null);
    try {
      await requestReview(result.id);
      setAsked(true);
      await Promise.all([queryClient.invalidateQueries({ queryKey: poseKeys.challenges }), queryClient.invalidateQueries({ queryKey: poseKeys.seasonal })]);
    } catch (e) {
      setError(poseError((e as { code?: string }).code));
    }
  };

  const done = result && result.status !== "held";
  const copy = result && result.status !== "withdrawn" ? ENTRY_TEXT[result.status] : null;

  return (
    <View style={styles.flex}>
      <DetailShell title="Your photo" glyph={<CameraIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament/photo-pose">
        {c ? <Text style={styles.title}>{c.title}</Text> : null}

        <View style={styles.pair}>
          <View style={styles.side}>
            <PoseImage url={ref.data} loading={ref.isPending && !!c?.referencePath} failed={ref.isError} rounded={20} accessibilityLabel="Reference pose" />
            <Text style={styles.label}>Reference</Text>
          </View>
          <View style={styles.side}>
            <PressScale accessibilityRole="button" accessibilityLabel={uri ? "Your photo. Take another" : "Take a photo"} disabled={sending || !!done} onPress={() => void pick("camera")} scaleTo={0.98}>
              {uri ? (
                <Animated.View key={uri} entering={reduceMotion ? FadeIn.duration(motion.duration.select) : ZoomIn.duration(motion.duration.enter).easing(motion.easing.out).withInitialValues({ transform: [{ scale: 0.94 }] })}>
                  <PoseImage url={uri} rounded={20} accessibilityLabel="Your photo" />
                </Animated.View>
              ) : (
                <View style={styles.slot}>
                  <View style={styles.slotDisc}>
                    <CameraIcon size={24} color={text.primary} weight="fill" />
                  </View>
                  <Text style={styles.slotText}>Tap to take it</Text>
                </View>
              )}
            </PressScale>
            <Text style={styles.label}>Your photo</Text>
          </View>
        </View>

        {result && copy ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)} style={[styles.result, result.status === "approved" && styles.resultOk]}>
            <Text style={styles.resultTitle}>{asked ? ENTRY_TEXT.pending_review.title : copy.title}</Text>
            <Text style={styles.resultLine}>{asked ? ENTRY_TEXT.pending_review.line : result.status === "held" && result.heldReason ? `${HELD_TEXT[result.heldReason]} ${copy.line}` : copy.line}</Text>
          </Animated.View>
        ) : (
          <View style={styles.check}>
            <Text style={styles.checkTitle}>Before you send it</Text>
            <CriteriaList criteria={criteria} compact />
          </View>
        )}

        {uri && !done ? (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)} exiting={FadeOut.duration(motion.duration.exit)} style={styles.again}>
            <PressScale accessibilityRole="button" style={styles.againButton} disabled={sending} onPress={() => void pick("camera")}>
              <ArrowCounterClockwiseIcon size={16} color={text.primary} weight="bold" />
              <Text style={styles.againText}>Retake</Text>
            </PressScale>
            <PressScale accessibilityRole="button" style={styles.againButton} disabled={sending} onPress={() => void pick("library")}>
              <ImagesIcon size={16} color={text.primary} weight="bold" />
              <Text style={styles.againText}>Choose another</Text>
            </PressScale>
          </Animated.View>
        ) : null}

        <View style={styles.privacy}>
          <LockSimpleIcon size={14} color={text.tertiary} weight="fill" />
          <Text style={styles.privacyText}>Other players see your photo when voting opens. Location and camera details are removed before anyone does.</Text>
        </View>
        <View style={{ height: 180 + insets.bottom }} />
      </DetailShell>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        {error ? (
          <Animated.Text
            entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.select)}
            style={styles.error}
            accessibilityRole={needsSettings ? "link" : "alert"}
            onPress={needsSettings ? () => void Linking.openSettings() : undefined}
          >
            {error}
            {needsSettings ? " " : null}
            {needsSettings ? <Text style={styles.errorLink}>Open Settings</Text> : null}
          </Animated.Text>
        ) : null}
        {done ? (
          <RaisedButton label="Done" tone="yellow" onPress={() => router.back()} />
        ) : result?.status === "held" ? (
          <View style={{ gap: space.sm }}>
            <RaisedButton label="Retake" tone="yellow" onPress={() => void pick("camera")} />
            <RaisedButton label={asked ? "A person will look" : "Ask a person to look"} tone="white" disabled={asked} onPress={() => void askPerson()} />
          </View>
        ) : uri ? (
          <RaisedButton label="Send photo" sub={sending ? "Checking it" : undefined} tone="yellow" busy={sending} onPress={() => void send()} />
        ) : (
          <View style={{ gap: space.sm }}>
            <RaisedButton label="Take photo" tone="yellow" icon={<CameraIcon size={20} color={text.primary} weight="fill" />} onPress={() => void pick("camera")} />
            <RaisedButton label="Choose from photos" tone="white" icon={<ImagesIcon size={20} color={text.primary} weight="bold" />} onPress={() => void pick("library")} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  title: { ...type.sectionTitle, fontWeight: "800", color: text.primary, marginTop: space.xs },
  pair: { flexDirection: "row", gap: space.md, marginTop: space.lg },
  side: { flex: 1 },
  label: { ...type.caption, fontWeight: "700", color: text.secondary, marginTop: space.sm, textAlign: "center" },
  slot: { aspectRatio: 4 / 5, borderRadius: 20, borderWidth: 2, borderStyle: "dashed", borderColor: border.strong, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", gap: space.sm },
  slotDisc: { width: 52, height: 52, borderRadius: 26, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  slotText: { ...type.caption, fontWeight: "700", color: text.secondary },
  check: { marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle, gap: space.md },
  checkTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  result: { marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle, gap: 4 },
  resultOk: { backgroundColor: accent.soft },
  resultTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  resultLine: { ...type.supporting, color: text.secondary },
  again: { flexDirection: "row", gap: space.sm, marginTop: space.lg },
  againButton: { flex: 1, height: 44, borderRadius: radius.pill, borderWidth: 1.5, borderColor: border.soft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  againText: { fontSize: 14, fontWeight: "700", color: text.primary },
  privacy: { flexDirection: "row", gap: 6, marginTop: space.xl, paddingHorizontal: space.xs },
  privacyText: { ...type.caption, color: text.tertiary, flex: 1 },
  error: { ...type.supporting, color: "#B4432F", marginBottom: space.md, textAlign: "center" },
  errorLink: { fontWeight: "800", textDecorationLine: "underline" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
