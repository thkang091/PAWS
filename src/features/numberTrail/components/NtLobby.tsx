import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CaretLeftIcon, CaretRightIcon, MapPinSimpleIcon, QrCodeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { InviteSheet } from "@/features/rooms/components/InviteSheet";
import { MeetingPointPicker } from "@/features/numberTrail/components/MeetingPointPicker";
import { ConnectionPill, IndeterminateTrail, RacePlayerList } from "@/features/numberTrail/components/RacePieces";
import type { Area } from "@/features/numberTrail/localStore";
import { LOBBY_BLOCKERS, NUMBER_ERRORS, numberErrorText } from "@/features/numberTrail/raceCopy";
import { lobbyView } from "@/features/numberTrail/raceView";
import { NT } from "@/features/numberTrail/theme";
import { ROUTES } from "@/features/rooms/lobbyRules";
import { setRoomGame } from "@/services/roomService";
import { cancelRoom, leaveNumberRace, setNumberReady, setNumberSettings, type RaceState } from "@/services/numberRaceService";
import type { Difficulty } from "../../../../supabase/functions/tournament/digits";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

const MINUTES = [15, 25, 40] as const;
const LEVELS: { key: Difficulty | null; label: string }[] = [
  { key: null, label: "Any" },
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

/**
 * Before a number is drawn: who's here, the walking time and meeting point (the host's to change), and the honest state
 * of finding a number. When it fails, the real reason and the two things that fix it.
 */
export const NtLobby = ({
  state,
  online,
  live,
  area,
  preparing,
  prepareError,
  onPrepare,
  onArea,
  onChanged,
  openInvite,
}: {
  state: RaceState;
  online: Set<string>;
  live: boolean;
  area: Area | null;
  preparing: boolean;
  prepareError: string | null;
  onPrepare: (opts?: { area?: Area }) => void;
  onArea: (a: Area) => void;
  onChanged: () => void;
  openInvite: boolean;
}) => {
  const insets = useSafeAreaInsets();
  const [inviting, setInviting] = useState(openInvite && state.me.isHost);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const v = lobbyView(state);
  const me = state.players.find((p) => p.userId === state.me.userId);
  const host = state.me.isHost;
  const failed = prepareError ?? state.match.prepareError;
  const working = preparing || state.match.preparing;
  const otherMinutes = MINUTES.filter((m) => m !== state.match.minutes);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      void Haptics.selectionAsync();
    } catch (e) {
      setError(numberErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
      onChanged();
    }
  };
  const settings = (s: { minutes?: number; difficulty?: Difficulty | null }) =>
    void act(() => setNumberSettings(state.match.id, { minutes: (s.minutes ?? state.match.minutes) as 15 | 25 | 40, difficulty: s.difficulty === undefined ? state.match.difficulty : s.difficulty, countdownS: state.match.countdownS }));

  const leave = () =>
    Alert.alert("Leave this game?", host ? "The game passes to the next player. If nobody is left, it closes." : "You can rejoin with the code while it's open.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => void leaveNumberRace(state.room.id).catch(() => undefined).finally(() => router.replace(ROUTES.nearby as never)) },
    ]);
  // Back, for the host, is "pick another game": the room goes back to its game list (this race is set aside).
  const back = () => {
    if (!host) return router.replace(ROUTES.nearby as never);
    void act(async () => {
      await setRoomGame(state.room.id, null);
      router.replace({ pathname: "/game/room/[id]", params: { id: state.room.id } });
    });
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingBottom: 150 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <PressScale accessibilityRole="button" accessibilityLabel={host ? "Pick another game" : "Back"} style={styles.round} onPress={back}>
            <CaretLeftIcon size={20} color={text.primary} weight="bold" />
          </PressScale>
          <ConnectionPill live={live} />
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {state.room.name}
        </Text>
        <Text style={styles.subtitle}>{`Number Trail · ${v.players.length} of ${v.capacity} players`}</Text>
        <PressScale accessibilityRole="button" accessibilityLabel={`Room code ${state.room.code}. Invite players`} style={styles.codeRow} onPress={() => setInviting(true)}>
          <Text style={styles.code}>{state.room.code}</Text>
          <View style={styles.inviteChip}>
            <QrCodeIcon size={16} color={text.primary} weight="bold" />
            <Text style={styles.inviteText}>Invite</Text>
          </View>
        </PressScale>

        {/* The number: being found, failed, or not yet asked for. */}
        <View style={[styles.course, failed && !working && styles.courseFailed]} accessibilityLiveRegion="polite">
          {working ? (
            <>
              <IndeterminateTrail />
              <Text style={styles.courseTitle}>{host ? LOBBY_BLOCKERS.preparing.host : LOBBY_BLOCKERS.preparing.player}</Text>
              <Text style={styles.courseLine}>Checking the streets near the meeting point. This can take a few seconds.</Text>
            </>
          ) : failed ? (
            <>
              <Text style={styles.courseTitle}>{failed === "no_number_routes" ? "No number here" : "Couldn't find a number"}</Text>
              <Text style={styles.courseLine}>{NUMBER_ERRORS[failed] ?? numberErrorText(failed)}</Text>
              {host ? (
                <View style={styles.fixes}>
                  <PressScale accessibilityRole="button" accessibilityLabel="Choose another meeting point" style={styles.fix} onPress={() => setPicking(true)}>
                    <Text style={styles.fixText}>New spot</Text>
                  </PressScale>
                  {otherMinutes.map((m) => (
                    <PressScale key={m} accessibilityRole="button" accessibilityLabel={`Try ${m} minutes`} style={styles.fix} onPress={() => settings({ minutes: m })}>
                      <Text style={styles.fixText}>{`${m} min`}</Text>
                    </PressScale>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.courseTitle}>{host ? "Ready when you are" : LOBBY_BLOCKERS.no_number.player}</Text>
              <Text style={styles.courseLine}>{host ? "PAWS finds a two-digit number on the real streets around the meeting point." : "You'll see the number and the course as soon as it's found."}</Text>
            </>
          )}
        </View>

        <Text style={styles.label}>WALKING TIME</Text>
        <View style={styles.chips}>
          {MINUTES.map((m) => (
            <PressScale key={m} accessibilityRole="button" accessibilityState={{ selected: state.match.minutes === m, disabled: !host || working }} disabled={!host || working} style={[styles.chip, state.match.minutes === m && styles.chipOn, !host && state.match.minutes !== m && styles.chipQuiet]} onPress={() => settings({ minutes: m })}>
              <Text style={styles.chipText}>{`${m} min`}</Text>
            </PressScale>
          ))}
        </View>
        <Text style={styles.label}>DIFFICULTY</Text>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <PressScale key={l.label} accessibilityRole="button" accessibilityState={{ selected: state.match.difficulty === l.key, disabled: !host || working }} disabled={!host || working} style={[styles.chip, state.match.difficulty === l.key && styles.chipOn, !host && state.match.difficulty !== l.key && styles.chipQuiet]} onPress={() => settings({ difficulty: l.key })}>
              <Text style={styles.chipText}>{l.label}</Text>
            </PressScale>
          ))}
        </View>
        {host ? (
          <PressScale accessibilityRole="button" accessibilityLabel={area ? "Change the meeting point" : "Choose a meeting point"} style={styles.point} onPress={() => setPicking(true)} disabled={working}>
            <MapPinSimpleIcon size={20} color={text.primary} weight="fill" />
            <View style={styles.flexOnly}>
              <Text style={styles.pointTitle}>{area ? "Meeting point set" : "Choose a meeting point"}</Text>
              <Text style={styles.pointLine}>{area ? "Tap to move it." : "Only you see it. The race starts at the nearest public corner."}</Text>
            </View>
            <CaretRightIcon size={18} color={text.primary} weight="bold" />
          </PressScale>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.section}>Players</Text>
          <Text style={styles.count}>{`${v.players.length} of ${v.capacity}`}</Text>
        </View>
        <RacePlayerList players={v.players} me={state.me.userId} online={online} />

        {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
        <PressScale accessibilityRole="button" style={styles.textButton} onPress={leave}>
          <Text style={styles.leaveText}>Leave game</Text>
        </PressScale>
        {host ? (
          <PressScale
            accessibilityRole="button"
            style={styles.textButton}
            onPress={() => Alert.alert("Cancel this game?", "Everyone in it will be sent back.", [{ text: "Keep it", style: "cancel" }, { text: "Cancel game", style: "destructive", onPress: () => void act(() => cancelRoom(state.room.id)) }])}
          >
            <Text style={styles.cancelText}>Cancel game</Text>
          </PressScale>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        {host ? (
          <RaisedButton label={failed ? "Try again" : "Find a number"} sub={!area ? "Choose a meeting point first" : undefined} disabled={!area || working} busy={working} onPress={() => onPrepare()} />
        ) : (
          <RaisedButton tone={me?.ready ? "white" : "yellow"} label={me?.ready ? "I'm not ready" : "I'm ready"} sub={me?.ready ? "Head to the meeting point" : undefined} busy={busy} onPress={() => void act(() => setNumberReady(state.room.id, !me?.ready))} />
        )}
      </View>

      <InviteSheet visible={inviting} roomId={state.room.id} code={state.room.code} isHost={host} onClose={() => setInviting(false)} />
      <MeetingPointPicker
        visible={picking}
        initial={area}
        onClose={() => setPicking(false)}
        onPick={(a) => {
          setPicking(false);
          onArea(a);
          if (failed) onPrepare({ area: a });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  flexOnly: { flex: 1 },
  body: { paddingHorizontal: layout.gutter },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: border.soft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, lineHeight: 33, fontWeight: "800", letterSpacing: -0.6, color: text.primary, marginTop: space.xl },
  subtitle: { ...type.supporting, fontWeight: "600", color: text.secondary, marginTop: 2 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.lg, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  code: { fontSize: 28, fontWeight: "800", letterSpacing: 5, color: text.primary },
  inviteChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: accent.deep },
  inviteText: { fontSize: 13, fontWeight: "800", color: text.primary },
  course: { marginTop: space.lg, padding: space.xl, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: NT.board, gap: 6 },
  courseFailed: { backgroundColor: "#FBF0EC", borderColor: "#F2D6CC" },
  courseTitle: { ...type.cardTitle, fontSize: 17, fontWeight: "800", color: text.primary, marginTop: 4 },
  courseLine: { ...type.supporting, color: text.secondary },
  fixes: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
  fix: { flex: 1, height: 44, borderRadius: radius.pill, backgroundColor: bg.surface, borderWidth: 1, borderColor: border.default, alignItems: "center", justifyContent: "center" },
  fixText: { fontSize: 14, fontWeight: "800", color: text.primary },
  label: { ...type.eyebrow, color: text.secondary, marginTop: space.xl, marginBottom: space.sm },
  chips: { flexDirection: "row", gap: space.sm },
  chip: { flex: 1, height: 44, borderRadius: 14, borderWidth: 2, borderColor: border.soft, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  chipOn: { borderColor: accent.band, backgroundColor: accent.soft },
  chipQuiet: { opacity: 0.45 },
  chipText: { fontSize: 14, fontWeight: "700", color: text.primary },
  point: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  pointTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  pointLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: space.section, marginBottom: space.md },
  section: { ...type.sectionTitle, color: text.primary },
  count: { ...type.supporting, fontWeight: "700", color: text.secondary, fontVariant: ["tabular-nums"] },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  textButton: { alignSelf: "center", marginTop: space.lg, paddingVertical: space.xs, paddingHorizontal: space.md },
  leaveText: { ...type.supporting, fontWeight: "700", color: text.secondary },
  cancelText: { ...type.supporting, fontWeight: "700", color: "#B4442C" },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
