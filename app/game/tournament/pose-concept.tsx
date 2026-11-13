import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { CheckCircleIcon, ImageIcon, QuestionIcon, SparkleIcon, WarningIcon, XCircleIcon } from "phosphor-react-native";

import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { Chip, CriteriaList, PoseFacts, PoseImage, SectionTitle, Segments, chooseFrom } from "@/features/photoPose/components/PoseParts";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, poseError } from "@/features/photoPose/copy";
import { OrganizerGate } from "@/features/rooms/components/OrganizerGate";
import { poseKeys, useConcept, useReferenceUrl } from "@/hooks/usePhotoPose";
import { DogPhotoPoseDiscoveryService, type PoseConceptRow } from "@/services/mediaService";
import { accent, bg, border, radius, space, text, type } from "@/constants/design";
import { criteriaFor } from "../../../supabase/functions/media/entryCheck";
import { POSE_CATEGORIES, screenSafety, validateEdit, validatePose, type PoseCategory, type PoseDifficulty } from "../../../supabase/functions/media/poses";

const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const day = (d: Date) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

/** One pose idea, for organizers: its reference image, its words, its safety notes, approval and publishing. */
export default function PoseConceptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <OrganizerGate explain={poseError} body="Pose ideas are written, checked and published by PAWS organizers.">
      {id === "new" ? <NewConcept /> : <Review id={id} />}
    </OrganizerGate>
  );
}

const Review = ({ id }: { id: string }) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const concept = useConcept(id);
  const c = concept.data;
  const ref = useReferenceUrl(c?.reference_media_path);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [safetyRead, setSafetyRead] = useState(false);
  const [license, setLicense] = useState("");
  const [draft, setDraft] = useState({ title: "", description: "", framing: "", steps: "", safety: "" });
  const [name, setName] = useState("");
  const [start, setStart] = useState<"now" | "tomorrow">("tomorrow");
  const [entryDays, setEntryDays] = useState<"3" | "5" | "7">("5");
  const [voteDays, setVoteDays] = useState<"2" | "3">("2");

  useEffect(() => {
    if (!c) return;
    setDraft({ title: c.title, description: c.description, framing: c.framing, steps: c.instructions.join("\n"), safety: c.safety_notes.join("\n") });
    setName((n) => n || c.title);
  }, [c?.id, c?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = c?.review_status === "suggested" || c?.review_status === "approved";
  const dirty = !!c && (draft.title !== c.title || draft.description !== c.description || draft.framing !== c.framing || draft.steps !== c.instructions.join("\n") || draft.safety !== c.safety_notes.join("\n"));
  const plan = useMemo(() => {
    const now = new Date();
    const s = start === "now" ? new Date(now.getTime() + 60_000) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
    const close = new Date(s.getTime() + Number(entryDays) * 86_400_000);
    const end = new Date(close.getTime() + Number(voteDays) * 86_400_000);
    return { registrationOpensAt: now.toISOString(), startsAt: s.toISOString(), entriesCloseAt: close.toISOString(), endsAt: end.toISOString(), s, close, end };
  }, [start, entryDays, voteDays]);

  const run = async (key: string, fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([queryClient.invalidateQueries({ queryKey: poseKeys.concept(id) }), queryClient.invalidateQueries({ queryKey: poseKeys.concepts })]);
      after?.();
    } catch (e) {
      setError(poseError((e as { code?: string }).code));
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    const edit = { title: draft.title.trim(), description: draft.description.trim(), framing: draft.framing.trim(), instructions: lines(draft.steps), safetyNotes: lines(draft.safety) };
    const bad = validateEdit(edit);
    if (bad.length) return setError(`Check: ${bad.join(", ")}.`);
    void run("save", () => DogPhotoPoseDiscoveryService.revise(id, edit));
  };

  const upload = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setError("PAWS needs your photos to choose one.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 5], quality: 0.9, exif: false });
    if (res.canceled || !res.assets?.[0]) return;
    void run("upload", () => DogPhotoPoseDiscoveryService.uploadReference(id, res.assets[0].uri, license.trim()), () => setLicense(""));
  };

  const reject = () =>
    chooseFrom(
      "Why reject it?",
      [["unsafe", "Not safe for dogs"], ["unclear", "Hard to understand"], ["repeat", "Too close to another pose"], ["dull", "Not fun enough"]],
      (why) => void run("reject", () => DogPhotoPoseDiscoveryService.review(id, "reject", { reason: why })),
      true,
    );

  if (concept.isPending) return <Centered />;
  if (!c) return <Centered text={poseError((concept.error as { code?: string } | null)?.code ?? "pose_not_found")} />;
  const check = c.reference_check;
  const flags = c.safety_flags ?? [];

  return (
    <DetailShell title="Review pose" glyph={<SparkleIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament/pose-studio">
      <View style={styles.status}>
        <Text style={styles.statusText}>{STATUS[c.review_status]}</Text>
        <Text style={styles.statusMeta}>{c.ai_model ? `Suggested by ${c.ai_model}. Viral-inspired, not a verified trend.` : "Written by an organizer."}</Text>
      </View>

      <SectionTitle style={styles.firstSection}>Reference image</SectionTitle>
      <View style={styles.refRow}>
        <PoseImage url={ref.data} loading={ref.isPending && !!c.reference_media_path} failed={ref.isError} rounded={20} style={styles.refImage} empty={<ImageIcon size={28} color={text.tertiary} weight="duotone" />} />
        <View style={styles.refSide}>
          <Text style={styles.refState}>{REF[c.reference_status]}</Text>
          {c.reference_source ? <Text style={styles.small}>{c.reference_source === "generated" ? "Drafted by the image model" : `Uploaded. ${c.reference_license ?? ""}`}</Text> : null}
          {check?.answers?.length ? (
            <View style={styles.answers}>
              {check.answers.map((a) => {
                const label = check.criteria?.find((x) => x.id === a.id)?.label ?? a.id;
                const Icon = a.answer === "yes" ? CheckCircleIcon : a.answer === "no" ? XCircleIcon : QuestionIcon;
                return (
                  <View key={a.id} style={styles.answer}>
                    <Icon size={14} color={a.answer === "yes" ? "#2F8F4E" : a.answer === "no" ? "#B4432F" : text.tertiary} weight="fill" />
                    <Text style={styles.answerText} numberOfLines={2}>
                      {label}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : c.reference_media_path ? (
            <Text style={styles.small}>The automatic check didn't run. Look closely yourself.</Text>
          ) : null}
        </View>
      </View>
      {c.reference_status === "pending" ? (
        <View style={styles.pair}>
          <RaisedButton label="Use this image" height={50} busy={busy === "refok"} onPress={() => void run("refok", () => DogPhotoPoseDiscoveryService.reviewReference(id, true))} style={styles.half} />
          <RaisedButton label="Not right" tone="white" height={50} busy={busy === "refno"} onPress={() => void run("refno", () => DogPhotoPoseDiscoveryService.reviewReference(id, false))} style={styles.half} />
        </View>
      ) : null}
      {editable ? (
        <View style={styles.refTools}>
          <RaisedButton label={c.reference_media_path ? "Draft another with AI" : "Draft with AI"} tone="white" height={50} busy={busy === "draft"} onPress={() => void run("draft", () => DogPhotoPoseDiscoveryService.draftReference(id))} />
          <Field value={license} onChangeText={setLicense} placeholder="Where it is from, and its licence" />
          <RaisedButton label="Upload a licensed photo" tone="white" height={50} disabled={license.trim().length < 3} busy={busy === "upload"} onPress={() => void upload()} />
        </View>
      ) : null}

      <SectionTitle>The pose</SectionTitle>
      <PoseFacts difficulty={c.difficulty} minutes={c.setup_minutes} objects={c.required_objects} category={c.category} />
      {editable ? (
        <View style={styles.form}>
          <Label text="Title" />
          <Field value={draft.title} onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))} maxLength={48} />
          <Label text="Description" />
          <Field value={draft.description} onChangeText={(v) => setDraft((d) => ({ ...d, description: v }))} multiline maxLength={200} />
          <Label text="Steps, one per line" />
          <Field value={draft.steps} onChangeText={(v) => setDraft((d) => ({ ...d, steps: v }))} multiline />
          <Label text="Framing" />
          <Field value={draft.framing} onChangeText={(v) => setDraft((d) => ({ ...d, framing: v }))} multiline maxLength={200} />
          <Label text="Safety notes, one per line" />
          <Field value={draft.safety} onChangeText={(v) => setDraft((d) => ({ ...d, safety: v }))} multiline />
          {dirty ? <RaisedButton label="Save changes" height={50} busy={busy === "save"} onPress={save} style={styles.save} /> : null}
        </View>
      ) : (
        <Text style={styles.body}>{c.instructions.map((s, i) => `${i + 1}. ${s}`).join("\n")}</Text>
      )}

      <View style={styles.details}>
        <Detail label="Owner" value={c.owner_position} />
        <Detail label="Dog" value={c.dog_position} />
        <Detail label="Camera" value={c.camera_angle} />
        {c.dog_requirements.length ? <Detail label="The dog should" value={c.dog_requirements.join(", ")} /> : null}
        {c.shareability ? <Detail label="Why it works" value={c.shareability} /> : null}
      </View>

      <SectionTitle>It counts when</SectionTitle>
      <CriteriaList criteria={criteriaFor(c.objective_criteria ?? [], true)} />

      {flags.length ? (
        <View style={styles.flags}>
          <View style={styles.flagHead}>
            <WarningIcon size={18} color="#9A5B10" weight="fill" />
            <Text style={styles.flagTitle}>Check before approving</Text>
          </View>
          {flags.map((f) => (
            <Text key={f} style={styles.flagText}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          ))}
          {c.review_status === "suggested" ? (
            <View style={styles.flagAck}>
              <Text style={styles.flagAckText}>I've read these and the pose is safe as written</Text>
              <Switch value={safetyRead} onValueChange={setSafetyRead} trackColor={{ true: accent.band, false: border.default }} />
            </View>
          ) : null}
        </View>
      ) : null}

      {c.review_status === "suggested" ? (
        <View style={styles.decide}>
          <RaisedButton label="Approve" disabled={flags.length > 0 && !safetyRead} busy={busy === "approve"} onPress={() => void run("approve", () => DogPhotoPoseDiscoveryService.review(id, "approve", { safetyChecked: safetyRead }))} />
          <RaisedButton label="Reject" tone="white" busy={busy === "reject"} onPress={reject} />
        </View>
      ) : null}

      {c.review_status === "approved" ? (
        <View style={styles.publish}>
          <Text style={styles.publishTitle}>Publish as a challenge</Text>
          {c.reference_status !== "approved" ? <Text style={styles.small}>Approve a reference image first. Every challenge shows players what their photo could look like.</Text> : null}
          <Label text="Challenge name" />
          <Field value={name} onChangeText={setName} maxLength={80} />
          <Label text="Photos open" />
          <Segments value={start} options={[["now", "Now"], ["tomorrow", "Tomorrow 9:00"]] as const} onChange={setStart} />
          <Label text="Days for photos" />
          <Segments value={entryDays} options={[["3", "3"], ["5", "5"], ["7", "7"]] as const} onChange={setEntryDays} />
          <Label text="Days for voting" />
          <Segments value={voteDays} options={[["2", "2"], ["3", "3"]] as const} onChange={setVoteDays} />
          <Text style={styles.plan}>{`Photos ${day(plan.s)} to ${day(plan.close)}. Voting until ${day(plan.end)}.`}</Text>
          <RaisedButton
            label="Publish"
            disabled={c.reference_status !== "approved" || name.trim().length < 3}
            busy={busy === "publish"}
            onPress={() => void run("publish", () => DogPhotoPoseDiscoveryService.publish(id, { name: name.trim(), ...plan }), () => router.replace("/game/tournament/photo-pose"))}
          />
        </View>
      ) : null}

      {c.review_status === "published" ? (
        <RaisedButton label="Retire from the library" tone="white" busy={busy === "retire"} onPress={() => void run("retire", () => DogPhotoPoseDiscoveryService.retire(id))} style={styles.retire} />
      ) : null}
      {c.review_status === "rejected" && c.rejection_reason ? <Text style={styles.small}>{`Rejected: ${c.rejection_reason}`}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ height: insets.bottom + space.xl }} />
    </DetailShell>
  );
};

const STATUS: Record<PoseConceptRow["review_status"], string> = { suggested: "Waiting for review", approved: "Approved", rejected: "Rejected", published: "Live", retired: "Retired" };
const REF: Record<PoseConceptRow["reference_status"], string> = { none: "No image yet", pending: "Check this image", approved: "Approved", rejected: "Rejected. Draft or upload another." };

/** A pose written by hand: the same fields and checks as Gemini's ideas. */
const NewConcept = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [f, setF] = useState({ title: "", description: "", owner: "", dog: "", camera: "Eye level with the dog", framing: "", steps: "", counts: "", safety: "Let your dog leave the pose whenever they want.", objects: "" });
  const [category, setCategory] = useState<PoseCategory>("matching");
  const [difficulty, setDifficulty] = useState<PoseDifficulty>("easy");
  const [minutes, setMinutes] = useState<"2" | "5" | "10">("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const create = async () => {
    setError(null);
    const v = validatePose({
      title: f.title, short_description: f.description, pose_category: category, difficulty, estimated_setup_time: Number(minutes), required_participants: 1,
      required_objects: lines(f.objects), dog_requirements: [], owner_position: f.owner, dog_position: f.dog, camera_angle: f.camera, framing_instructions: f.framing,
      step_by_step_instructions: lines(f.steps), objective_verification_criteria: lines(f.counts).map((label) => ({ label, kind: "pose" })),
      safety_considerations: lines(f.safety), visual_reference_prompt: `${f.title}. ${f.owner}. ${f.dog}. ${f.framing}`, shareability_rationale: "",
    });
    if (!v.ok || !v.pose) return setError(`Check: ${v.reasons.map((r) => r.replace("invalid ", "").replace(/_/g, " ")).join(", ")}.`);
    const s = screenSafety(v.pose);
    if (s.verdict === "reject") return setError(`Not safe for dogs: ${s.reasons.join(", ")}.`);
    setBusy(true);
    try {
      const row = await DogPhotoPoseDiscoveryService.create({ ...v.pose, safetyFlags: s.reasons });
      await queryClient.invalidateQueries({ queryKey: poseKeys.concepts });
      router.replace({ pathname: "/game/tournament/pose-concept", params: { id: row.id } });
    } catch (e) {
      setError(poseError((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DetailShell title="New pose" glyph={<SparkleIcon size={20} color={accent.band} weight="fill" />} back="/game/tournament/pose-studio">
      <View style={styles.form}>
        <Label text="Title" />
        <Field value={f.title} onChangeText={set("title")} maxLength={48} placeholder="Back to Back Besties" />
        <Label text="One line for players" />
        <Field value={f.description} onChangeText={set("description")} multiline maxLength={200} />
        <Label text="Vibe" />
        <View style={styles.chips}>
          {POSE_CATEGORIES.map((k) => (
            <Chip key={k} label={CATEGORY_LABEL[k]} on={category === k} onPress={() => setCategory(k)} />
          ))}
        </View>
        <Label text="Difficulty" />
        <Segments value={difficulty} options={[["easy", DIFFICULTY_LABEL.easy], ["medium", DIFFICULTY_LABEL.medium]] as const} onChange={setDifficulty} />
        <Label text="Setup, minutes" />
        <Segments value={minutes} options={[["2", "2"], ["5", "5"], ["10", "10"]] as const} onChange={setMinutes} />
        <Label text="Where the owner is" />
        <Field value={f.owner} onChangeText={set("owner")} />
        <Label text="Where the dog is" />
        <Field value={f.dog} onChangeText={set("dog")} />
        <Label text="Camera angle" />
        <Field value={f.camera} onChangeText={set("camera")} />
        <Label text="Framing" />
        <Field value={f.framing} onChangeText={set("framing")} />
        <Label text="Steps, one per line" />
        <Field value={f.steps} onChangeText={set("steps")} multiline />
        <Label text="It counts when, one per line" />
        <Field value={f.counts} onChangeText={set("counts")} multiline placeholder="Owner and dog face away from each other" />
        <Label text="Props, one per line (optional)" />
        <Field value={f.objects} onChangeText={set("objects")} multiline />
        <Label text="Safety notes, one per line" />
        <Field value={f.safety} onChangeText={set("safety")} multiline />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <RaisedButton label="Save as an idea" busy={busy} onPress={() => void create()} style={styles.save} />
      <View style={{ height: insets.bottom + space.xl }} />
    </DetailShell>
  );
};

const Label = ({ text: t }: { text: string }) => <Text style={styles.label}>{t}</Text>;
const Field = (props: TextInputProps) => <TextInput placeholderTextColor={text.tertiary} {...props} style={[styles.field, props.multiline && styles.fieldMulti]} />;
const Detail = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detail}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);
const Centered = ({ text: t }: { text?: string }) => <View style={styles.centered}>{t ? <Text style={styles.small}>{t}</Text> : <ActivityIndicator color={text.secondary} />}</View>;

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: bg.canvas },
  status: { marginTop: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.stage, gap: 2 },
  statusText: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  statusMeta: { ...type.caption, color: text.secondary },
  firstSection: { marginTop: space.xl },
  refRow: { flexDirection: "row", gap: space.md },
  refImage: { width: 150 },
  refSide: { flex: 1, gap: 6 },
  refState: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  small: { ...type.caption, color: text.secondary },
  answers: { gap: 6, marginTop: 4 },
  answer: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  answerText: { ...type.caption, color: text.primary, flex: 1 },
  pair: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  half: { flex: 1 },
  refTools: { gap: space.sm, marginTop: space.md },
  form: { marginTop: space.sm },
  label: { ...type.caption, fontWeight: "700", color: text.secondary, marginTop: space.md, marginBottom: 6 },
  field: { minHeight: 48, paddingHorizontal: space.md, paddingVertical: 12, borderRadius: radius.input, borderWidth: 1, borderColor: border.default, backgroundColor: bg.surface, ...type.body, color: text.primary },
  fieldMulti: { minHeight: 88, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  save: { marginTop: space.lg },
  body: { ...type.body, color: text.primary, marginTop: space.md },
  details: { marginTop: space.lg, gap: space.sm },
  detail: { flexDirection: "row", gap: space.md },
  detailLabel: { ...type.caption, fontWeight: "700", color: text.tertiary, width: 92, marginTop: 2 },
  detailValue: { ...type.supporting, color: text.primary, flex: 1 },
  flags: { marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: "#FDF0D8", gap: 6 },
  flagHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: 2 },
  flagTitle: { ...type.cardTitle, fontWeight: "800", color: "#6E3F05" },
  flagText: { ...type.supporting, color: "#6E3F05" },
  flagAck: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.sm },
  flagAckText: { ...type.supporting, fontWeight: "700", color: "#6E3F05", flex: 1 },
  decide: { gap: space.sm, marginTop: space.xl },
  publish: { marginTop: space.section, padding: space.lg, borderRadius: 24, backgroundColor: bg.stage },
  publishTitle: { ...type.sectionTitle, fontWeight: "800", color: text.primary, marginBottom: space.xs },
  plan: { ...type.supporting, color: text.primary, marginVertical: space.lg },
  retire: { marginTop: space.xl },
  error: { ...type.supporting, color: "#B4432F", marginTop: space.lg },
});
