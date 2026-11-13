import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { PROVIDER_GOOGLE } from "react-native-maps";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretRightIcon, CheckIcon, MapPinSimpleIcon, MinusIcon, PlusIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import { MeetingPointPicker } from "@/features/numberTrail/components/MeetingPointPicker";
import { NumberGlyph } from "@/features/numberTrail/components/NumberGlyph";
import { ntStore, type Area } from "@/features/numberTrail/localStore";
import { numberErrorText } from "@/features/numberTrail/raceCopy";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { createNumberRace } from "@/services/numberRaceService";
import type { Difficulty } from "../../../supabase/functions/tournament/digits";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

const MINUTES = [15, 25, 40] as const;
const LEVELS: { key: Difficulty | null; label: string }[] = [
  { key: null, label: "Any" },
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];
const COUNTDOWNS = [10, 30, 60] as const;
/** About how far the race is at an easy dog-walking pace (the server's target length). */
const km = (minutes: number) => `about ${((minutes * 60 * 1.1) / 1000).toFixed(1)} km`;

/** Create a Number Trail game: a room, its settings and the meeting point. The number is found right after. */
export default function CreateNumberTrailScreen() {
  const insets = useSafeAreaInsets();
  const dog = useCurrentDog();
  const name = dog.data?.name ?? "Our";
  const [roomName, setRoomName] = useState(`${name}'s Number Trail`);
  const [players, setPlayers] = useState(6);
  const [minutes, setMinutes] = useState<(typeof MINUTES)[number]>(25);
  const [level, setLevel] = useState<Difficulty | null>(null);
  const [countdown, setCountdown] = useState<(typeof COUNTDOWNS)[number]>(10);
  const [area, setArea] = useState<Area | null>(null);
  const [picking, setPicking] = useState(false);
  const [safe, setSafe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocker = !area ? "Choose a meeting point first" : !safe ? "Tick the safety promise first" : undefined;

  const create = async () => {
    if (!area) return;
    setBusy(true);
    setError(null);
    try {
      const r = await createNumberRace({
        name: roomName.trim() || `${name}'s Number Trail`,
        maxPlayers: players,
        countdownS: countdown,
        safetyAck: safe,
        dogId: dog.data?.id ?? null,
        displayName: dog.data?.name ?? "Player",
        minutes,
        difficulty: level,
      });
      await ntStore.setArea(r.matchId, area);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/game/number-trail/room/[id]", params: { id: r.roomId, prepare: "1", invite: "1" } });
    } catch (e) {
      setError(numberErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <DetailShell title="New game" glyph={<NumberGlyph value="42" height={18} link={false} stroke={0.34} />} back="/game/number-trail">
        <Text style={styles.label}>MEETING POINT</Text>
        <PressScale accessibilityRole="button" accessibilityLabel={area ? "Meeting point chosen. Change it" : "Choose a meeting point"} scaleTo={0.98} style={[styles.point, !area && styles.pointEmpty]} onPress={() => setPicking(true)}>
          {area ? (
            <View style={styles.preview} pointerEvents="none">
              <MapView
                key={`${area.latitude},${area.longitude}`}
                provider={PROVIDER_GOOGLE}
                style={StyleSheet.absoluteFill}
                initialRegion={{ ...area, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
                customMapStyle={QUIET_MAP}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
              />
              <View style={styles.previewPin}>
                <MapPinSimpleIcon size={34} color={text.primary} weight="fill" />
              </View>
            </View>
          ) : null}
          <View style={styles.pointRow}>
            <MapPinSimpleIcon size={20} color={text.primary} weight="fill" />
            <View style={styles.flexOnly}>
              <Text style={styles.rowTitle}>{area ? "Meeting point set" : "Choose a meeting point"}</Text>
              <Text style={styles.rowNote}>{area ? "The race starts at the nearest public corner." : "Pick where everyone will meet. The number is found from the streets around it."}</Text>
            </View>
            <CaretRightIcon size={18} color={text.primary} weight="bold" />
          </View>
        </PressScale>

        <Text style={styles.label}>WALKING TIME</Text>
        <View style={styles.chips}>
          {MINUTES.map((m) => (
            <PressScale key={m} accessibilityRole="button" accessibilityState={{ selected: minutes === m }} accessibilityLabel={`${m} minutes, ${km(m)}`} style={[styles.chip, styles.chipTall, minutes === m && styles.chipOn]} onPress={() => setMinutes(m)}>
              <Text style={styles.chipBig}>{`${m} min`}</Text>
              <Text style={styles.chipSub}>{km(m)}</Text>
            </PressScale>
          ))}
        </View>

        <Text style={styles.label}>DIFFICULTY</Text>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <PressScale key={l.label} accessibilityRole="button" accessibilityState={{ selected: level === l.key }} style={[styles.chip, level === l.key && styles.chipOn]} onPress={() => setLevel(l.key)}>
              <Text style={styles.chipText}>{l.label}</Text>
            </PressScale>
          ))}
        </View>

        <Text style={styles.label}>ROOM NAME</Text>
        <TextInput value={roomName} onChangeText={setRoomName} maxLength={40} style={styles.input} placeholder="Park crew" placeholderTextColor={text.disabled} accessibilityLabel="Room name" returnKeyType="done" />

        <Text style={styles.label}>PLAYERS</Text>
        <View style={styles.stepper}>
          <PressScale accessibilityRole="button" accessibilityLabel="Fewer players" style={styles.stepButton} disabled={players <= 2} onPress={() => setPlayers((p) => Math.max(2, p - 1))}>
            <MinusIcon size={18} color={players <= 2 ? text.disabled : text.primary} weight="bold" />
          </PressScale>
          <Text style={styles.stepValue} accessibilityLiveRegion="polite">{`Up to ${players}`}</Text>
          <PressScale accessibilityRole="button" accessibilityLabel="More players" style={styles.stepButton} disabled={players >= 10} onPress={() => setPlayers((p) => Math.min(10, p + 1))}>
            <PlusIcon size={18} color={players >= 10 ? text.disabled : text.primary} weight="bold" />
          </PressScale>
        </View>

        <Text style={styles.label}>COUNTDOWN</Text>
        <View style={styles.chips}>
          {COUNTDOWNS.map((c) => (
            <PressScale key={c} accessibilityRole="button" accessibilityState={{ selected: countdown === c }} style={[styles.chip, countdown === c && styles.chipOn]} onPress={() => setCountdown(c)}>
              <Text style={styles.chipText}>{`${c}s`}</Text>
            </PressScale>
          ))}
        </View>

        <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: safe }} style={styles.safety} onPress={() => setSafe((v) => !v)}>
          <View style={[styles.box, safe && styles.boxOn]}>{safe ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}</View>
          <Text style={styles.safetyText}>We'll walk at our dogs' pace, stay on public paths, cross only where it's safe, and keep dogs on a lead near roads.</Text>
        </PressScale>
        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        <View style={{ height: 110 + insets.bottom }} />
      </DetailShell>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <RaisedButton label="Create game" sub={blocker} disabled={Boolean(blocker)} busy={busy} onPress={() => void create()} />
      </View>
      <MeetingPointPicker
        visible={picking}
        initial={area}
        onClose={() => setPicking(false)}
        onPick={(a) => {
          setArea(a);
          setPicking(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  flexOnly: { flex: 1 },
  label: { ...type.eyebrow, color: text.tertiary, marginTop: space.xl, marginBottom: space.sm },
  point: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, overflow: "hidden" },
  pointEmpty: { borderWidth: 2, borderColor: accent.band, backgroundColor: accent.soft },
  preview: { height: 132, backgroundColor: bg.subtle },
  previewPin: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingBottom: 34 },
  pointRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  rowTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  rowNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  chips: { flexDirection: "row", gap: space.sm },
  chip: { flex: 1, height: 44, borderRadius: 14, borderWidth: 2, borderColor: border.soft, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  chipTall: { height: 62 },
  chipOn: { borderColor: accent.band, backgroundColor: accent.soft },
  chipText: { fontSize: 14, fontWeight: "700", color: text.primary },
  chipBig: { fontSize: 16, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  chipSub: { fontSize: 11, fontWeight: "600", color: text.secondary, marginTop: 2 },
  input: { height: 52, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, ...type.body, color: text.primary },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.sm, borderRadius: radius.input, backgroundColor: bg.subtle },
  stepButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 17, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  safety: { flexDirection: "row", gap: space.md, alignItems: "flex-start", marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: text.primary, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: accent.deep, borderColor: accent.band },
  safetyText: { ...type.supporting, color: text.primary, flex: 1 },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
