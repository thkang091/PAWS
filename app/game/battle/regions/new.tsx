import { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { CircleDashedIcon, FileArrowUpIcon, PathIcon, WarningCircleIcon, WarningIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ROUTES } from "@/features/rooms/lobbyRules";
import { IMPORT_LIMITS, parseRoadGeoJson, type ImportResult } from "@/features/rooms/regionAdmin";
import { importErrorText, importWarningText } from "@/features/rooms/regionCopy";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { OrganizerGate } from "@/features/rooms/components/OrganizerGate";
import { RoadMap } from "@/features/rooms/components/RoadMap";
import { formatDistance } from "@/features/tournament/format";
import { useRefreshRegions } from "@/hooks/useRegions";
import { createRegion, importRoadGraph, regionRoads, updateRegion } from "@/services/roomService";
import { accent, bg, border, layout, motion, radius, space, text, type } from "@/constants/design";

const OSM = { source: "OpenStreetMap", license: "ODbL 1.0", attribution: "© OpenStreetMap contributors" };

/** Start a road area: a name, a GeoJSON file of roads checked on the phone, and where the roads came from. */
export default function NewRegionScreen() {
  return (
    <OrganizerGate>
      <NewRegion />
    </OrganizerGate>
  );
}

const NewRegion = () => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const refresh = useRefreshRegions();
  const [name, setName] = useState("");
  const [file, setFile] = useState<{ name: string; result: ImportResult } | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [source, setSource] = useState("");
  const [license, setLicense] = useState("");
  const [attribution, setAttribution] = useState("");
  const [notes, setNotes] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A region created before an import failed is reused on retry, so trying again never makes two.
  const created = useRef<string | null>(null);

  const result = file?.result ?? null;
  const roads = useMemo(() => (result?.ok ? result.edges.map((e, i) => ({ id: String(i), status: "pending" as const, coords: e.coords })) : []), [result]);

  const pick = async () => {
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({ type: ["application/geo+json", "application/json", "public.json", "*/*"], copyToCacheDirectory: true, multiple: false });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setReading(true);
    try {
      const size = asset.size ?? 0;
      // Refuse big files before reading them into memory.
      const parsed = size > IMPORT_LIMITS.maxBytes ? parseRoadGeoJson("", size) : parseRoadGeoJson(await new File(asset.uri).text(), size);
      setFile({ name: asset.name, result: parsed });
      setPasting(false);
      void Haptics.notificationAsync(parsed.ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    } catch {
      setError("Couldn't read that file. Try saving it again as .geojson.");
    } finally {
      setReading(false);
    }
  };

  const checkPasted = () => {
    const parsed = parseRoadGeoJson(pasted.trim(), pasted.length);
    setFile({ name: "Pasted GeoJSON", result: parsed });
    setPasting(false);
  };

  const blocker = name.trim().length < 2 ? "Name the area" : !result ? "Add a road file" : !result.ok ? "Fix the file first" : !source.trim() || !license.trim() ? "Add the source and licence" : null;

  const save = async () => {
    if (!result?.ok || !result.center || blocker) return;
    setError(null);
    try {
      setSaving("Creating the draft");
      const id = created.current ?? (await createRegion({ name: name.trim(), latitude: result.center.latitude, longitude: result.center.longitude, source: source.trim(), license: license.trim(), attribution: attribution.trim() })).id;
      created.current = id;
      if (notes.trim()) await updateRegion(id, { name: name.trim(), source: source.trim(), license: license.trim(), attribution: attribution.trim(), notes: notes.trim() });
      setSaving(`Importing ${result.stats.roads} roads`);
      // If an earlier try imported before the reply was lost, don't import twice.
      const existing = await regionRoads(id);
      if (existing.length === 0) await importRoadGraph(id, result.nodes, result.edges);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void refresh(id);
      router.replace(ROUTES.region(id) as never);
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.flex}>
      <DetailShell title="New road area" glyph={<PathIcon size={20} color={accent.band} weight="bold" />} back={ROUTES.regions}>
        <Text style={styles.label}>NAME</Text>
        <TextInput value={name} onChangeText={setName} maxLength={60} style={styles.input} placeholder="Riverside loop" placeholderTextColor={text.tertiary} accessibilityLabel="Area name" />

        <Text style={styles.label}>ROADS</Text>
        {!file || pasting ? (
          <View style={styles.drop}>
            {!pasting ? (
              <>
                <View style={styles.dropIcon}>
                  <FileArrowUpIcon size={26} color={text.primary} weight="bold" />
                </View>
                <Text style={styles.dropTitle}>A GeoJSON file of roads</Text>
                <Text style={styles.dropLine}>{`LineStrings or MultiLineStrings in longitude and latitude. Up to ${IMPORT_LIMITS.maxBytes / 1_000_000} MB.`}</Text>
                <RaisedButton label="Choose a file" height={50} busy={reading} onPress={() => void pick()} style={styles.dropButton} />
                <PressScale accessibilityRole="button" style={styles.link} onPress={() => setPasting(true)}>
                  <Text style={styles.linkText}>Paste GeoJSON instead</Text>
                </PressScale>
              </>
            ) : (
              <>
                <TextInput
                  value={pasted}
                  onChangeText={setPasted}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.paste}
                  placeholder='{"type": "FeatureCollection", "features": [...]}'
                  placeholderTextColor={text.tertiary}
                  accessibilityLabel="GeoJSON text"
                />
                <View style={styles.pasteRow}>
                  <PressScale accessibilityRole="button" style={styles.link} onPress={() => setPasting(false)}>
                    <Text style={styles.linkText}>Cancel</Text>
                  </PressScale>
                  <RaisedButton label="Check roads" height={46} disabled={!pasted.trim()} onPress={checkPasted} style={styles.flex} />
                </View>
              </>
            )}
          </View>
        ) : (
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(motion.duration.enter)}>
            <View style={styles.fileRow}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <PressScale accessibilityRole="button" accessibilityLabel="Use different roads" style={styles.replace} onPress={() => setFile(null)}>
                <Text style={styles.replaceText}>Replace</Text>
              </PressScale>
            </View>

            {result && result.errors.length ? (
              <View style={[styles.issues, styles.issuesBad]} accessibilityRole="alert">
                <View style={styles.issueHead}>
                  <WarningCircleIcon size={18} color="#B4442C" weight="fill" />
                  <Text style={[styles.issueTitle, styles.bad]}>{`Can't import this file`}</Text>
                </View>
                {result.errors.map((e) => (
                  <Text key={e.code} style={styles.issueLine}>
                    {importErrorText(e)}
                  </Text>
                ))}
              </View>
            ) : null}

            {result?.ok ? (
              <>
                <View style={styles.preview}>
                  <RoadMap roads={roads} outline={result.outline} style={StyleSheet.absoluteFill} padding={{ top: 28, bottom: 28, left: 28, right: 28 }} />
                </View>
                <View style={styles.stats}>
                  <Stat label="Roads" value={String(result.stats.roads)} />
                  <Stat label="Junctions" value={String(result.stats.junctions)} />
                  <Stat label="Length" value={formatDistance(result.stats.lengthM)} />
                  <Stat label="Pieces" value={String(result.stats.pieces)} warn={result.stats.pieces > 1} />
                </View>
              </>
            ) : null}

            {result && result.warnings.length ? (
              <View style={[styles.issues, styles.issuesWarn]}>
                <View style={styles.issueHead}>
                  <WarningIcon size={18} color="#8A5A10" weight="fill" />
                  <Text style={[styles.issueTitle, styles.warnInk]}>Look at these while reviewing</Text>
                </View>
                {result.warnings.map((w) => (
                  <Text key={w.code} style={styles.issueLine}>
                    {importWarningText(w)}
                  </Text>
                ))}
              </View>
            ) : null}
          </Animated.View>
        )}

        <View style={styles.sourceHead}>
          <Text style={[styles.label, styles.labelInline]}>SOURCE AND LICENCE</Text>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Fill in OpenStreetMap"
            style={styles.quick}
            onPress={() => {
              setSource(OSM.source);
              setLicense(OSM.license);
              setAttribution(OSM.attribution);
            }}
          >
            <Text style={styles.quickText}>Use OpenStreetMap</Text>
          </PressScale>
        </View>
        <View style={styles.group}>
          <Field label="Source" value={source} onChange={setSource} placeholder="Where the roads came from" max={300} />
          <Field label="Licence" value={license} onChange={setLicense} placeholder="ODbL 1.0, CC BY 4.0" max={200} rule />
          <Field label="Attribution" value={attribution} onChange={setAttribution} placeholder="Shown to players" max={300} rule />
        </View>
        <Text style={styles.label}>NOTES</Text>
        <TextInput value={notes} onChangeText={setNotes} maxLength={1000} multiline style={[styles.input, styles.notes]} placeholder="Anything other organizers should know" placeholderTextColor={text.tertiary} accessibilityLabel="Notes" />

        <View style={styles.safety}>
          <CircleDashedIcon size={20} color={text.primary} weight="bold" />
          <Text style={styles.safetyText}>Every road imports as pending. Nothing is playable until you check it on the review map.</Text>
        </View>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <View style={{ height: 110 + insets.bottom }} />
      </DetailShell>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <RaisedButton label="Save draft" sub={saving ?? blocker ?? "Then review each road"} disabled={Boolean(blocker)} busy={Boolean(saving)} onPress={() => void save()} />
      </View>
    </View>
  );
};

const Stat = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, warn && styles.warnInk]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Field = ({ label, value, onChange, placeholder, max, rule }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; max: number; rule?: boolean }) => (
  <View style={[styles.field, rule && styles.fieldRule]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} maxLength={max} style={styles.fieldInput} placeholder={placeholder} placeholderTextColor={text.tertiary} accessibilityLabel={label} />
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  label: { ...type.eyebrow, color: text.tertiary, marginTop: space.xl, marginBottom: space.sm },
  labelInline: { marginTop: 0, marginBottom: 0 },
  input: { minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, ...type.body, color: text.primary },
  notes: { minHeight: 88, paddingTop: 14, textAlignVertical: "top" },
  drop: { alignItems: "center", padding: space.xl, borderRadius: radius.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: border.strong, backgroundColor: bg.stage },
  dropIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center" },
  dropTitle: { ...type.cardTitle, fontWeight: "800", color: text.primary, marginTop: space.md },
  dropLine: { ...type.caption, color: text.secondary, textAlign: "center", marginTop: 4, maxWidth: 280 },
  dropButton: { alignSelf: "stretch", marginTop: space.lg },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: space.md },
  linkText: { ...type.supporting, fontWeight: "700", color: text.secondary, textDecorationLine: "underline" },
  paste: { alignSelf: "stretch", height: 150, padding: space.md, borderRadius: radius.control, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, fontFamily: "Menlo", fontSize: 12, color: text.primary, textAlignVertical: "top" },
  pasteRow: { flexDirection: "row", alignItems: "center", gap: space.sm, alignSelf: "stretch", marginTop: space.md, backgroundColor: "transparent" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: space.md, height: 52, paddingLeft: space.lg, paddingRight: 6, borderRadius: radius.input, backgroundColor: bg.subtle },
  fileName: { ...type.supporting, fontWeight: "700", color: text.primary, flex: 1 },
  replace: { height: 40, paddingHorizontal: space.md, borderRadius: radius.control, backgroundColor: bg.surface, justifyContent: "center" },
  replaceText: { fontSize: 13, fontWeight: "800", color: text.primary },
  preview: { height: 240, marginTop: space.md, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: border.soft },
  stats: { flexDirection: "row", marginTop: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft },
  stat: { flex: 1, paddingVertical: space.md, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: text.secondary, marginTop: 2 },
  issues: { marginTop: space.md, padding: space.lg, borderRadius: radius.card, gap: 6 },
  issuesBad: { backgroundColor: "#FBEDE9" },
  issuesWarn: { backgroundColor: accent.soft },
  issueHead: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: 2 },
  issueTitle: { ...type.supporting, fontWeight: "800" },
  issueLine: { ...type.caption, color: text.primary, lineHeight: 18 },
  bad: { color: "#B4442C" },
  warnInk: { color: "#8A5A10" },
  sourceHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xl, marginBottom: space.sm },
  quick: { height: 32, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.soft, justifyContent: "center" },
  quickText: { fontSize: 12, fontWeight: "800", color: text.primary },
  group: { borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  field: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingLeft: space.lg },
  fieldRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  fieldLabel: { ...type.supporting, fontWeight: "700", color: text.primary, width: 96 },
  fieldInput: { flex: 1, minHeight: 52, paddingRight: space.lg, ...type.body, color: text.primary },
  safety: { flexDirection: "row", gap: space.md, alignItems: "flex-start", marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  safetyText: { ...type.supporting, color: text.primary, flex: 1 },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
