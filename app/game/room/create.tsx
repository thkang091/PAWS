import { useState } from "react";
import { StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CheckIcon, MinusIcon, PlusIcon, UsersThreeIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { ROUTES, isBattle } from "@/features/rooms/lobbyRules";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { createRoom, type RoomGame } from "@/services/roomService";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

const GAMES: { key: RoomGame; title: string; ready: boolean; min: number }[] = [
  { key: "find_mafia", title: "Find the Mafia", ready: true, min: 4 },
  { key: "steal_territory", title: "Steal Your Territory", ready: true, min: 2 },
  { key: "steal_road", title: "Steal Your Road", ready: true, min: 2 },
];
const DELAYS = [0, 10, 30, 60];

/** Create a nearby room: which game, a name, how many can join, and a safety promise from the host. */
export default function CreateRoomScreen() {
  const params = useLocalSearchParams<{ game?: string }>();
  const insets = useSafeAreaInsets();
  const dog = useCurrentDog();
  const name = dog.data?.name ?? "Our";
  const [game, setGame] = useState<RoomGame>((GAMES.find((g) => g.key === params.game && g.ready)?.key ?? "find_mafia") as RoomGame);
  const min = GAMES.find((g) => g.key === game)?.min ?? 2;
  const [roomName, setRoomName] = useState(`${name}'s walk`);
  const [players, setPlayers] = useState(6);
  const [delay, setDelay] = useState(10);
  const [safe, setSafe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom({
        game,
        name: roomName.trim() || `${name}'s walk`,
        maxPlayers: players,
        teamMode: game !== "find_mafia",
        startDelayS: delay,
        safetyAck: safe,
        dogId: dog.data?.id ?? null,
        displayName: dog.data?.name ?? "Player",
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: "/game/room/[id]", params: { id: room.roomId, invite: "1" } });
    } catch (e) {
      setError(roomErrorText((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <DetailShell title="New room" glyph={<UsersThreeIcon size={20} color={accent.band} weight="fill" />} back={isBattle(game) ? ROUTES.detail(game) : ROUTES.hub}>
        <Text style={styles.label}>GAME</Text>
        <View style={styles.games}>
          {GAMES.map((g) => (
            <PressScale
              key={g.key}
              accessibilityRole="button"
              accessibilityState={{ selected: game === g.key, disabled: !g.ready }}
              accessibilityLabel={g.ready ? g.title : `${g.title}, coming soon`}
              disabled={!g.ready}
              style={[styles.game, game === g.key && styles.gameOn, !g.ready && styles.gameOff]}
              onPress={() => {
                setGame(g.key);
                setPlayers((p) => Math.max(g.min, p));
              }}
            >
              <Text style={styles.gameTitle}>{g.title}</Text>
              <Text style={styles.gameNote}>{g.ready ? `${g.min} to 10 players` : "Coming soon"}</Text>
            </PressScale>
          ))}
        </View>

        <Text style={styles.label}>ROOM NAME</Text>
        <TextInput value={roomName} onChangeText={setRoomName} maxLength={40} style={styles.input} placeholder="Park crew" placeholderTextColor={text.disabled} accessibilityLabel="Room name" />

        <Text style={styles.label}>PLAYERS</Text>
        <View style={styles.stepper}>
          <PressScale accessibilityRole="button" accessibilityLabel="Fewer players" style={styles.stepButton} disabled={players <= min} onPress={() => setPlayers((p) => Math.max(min, p - 1))}>
            <MinusIcon size={18} color={players <= min ? text.disabled : text.primary} weight="bold" />
          </PressScale>
          <Text style={styles.stepValue}>{`Up to ${players}`}</Text>
          <PressScale accessibilityRole="button" accessibilityLabel="More players" style={styles.stepButton} disabled={players >= 10} onPress={() => setPlayers((p) => Math.min(10, p + 1))}>
            <PlusIcon size={18} color={players >= 10 ? text.disabled : text.primary} weight="bold" />
          </PressScale>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Teams</Text>
            <Text style={styles.rowNote}>{game === "find_mafia" ? "Find the Mafia is every player for themselves." : "Two teams, Blue and Orange. You'll set them in the lobby."}</Text>
          </View>
          <Switch value={game !== "find_mafia"} disabled trackColor={{ true: accent.band, false: border.default }} />
        </View>

        <Text style={styles.label}>START DELAY</Text>
        <View style={styles.chips}>
          {DELAYS.map((d) => (
            <PressScale key={d} accessibilityRole="button" accessibilityState={{ selected: delay === d }} style={[styles.chip, delay === d && styles.chipOn]} onPress={() => setDelay(d)}>
              <Text style={styles.chipText}>{d === 0 ? "None" : `${d}s`}</Text>
            </PressScale>
          ))}
        </View>

        <PressScale accessibilityRole="checkbox" accessibilityState={{ checked: safe }} style={styles.safety} onPress={() => setSafe((v) => !v)}>
          <View style={[styles.box, safe && styles.boxOn]}>{safe ? <CheckIcon size={14} color={text.primary} weight="bold" /> : null}</View>
          <Text style={styles.safetyText}>We'll stay on public paths, cross only at crossings, keep dogs on a lead near roads, and never walk onto private land.</Text>
        </PressScale>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={{ height: 110 + insets.bottom }} />
      </DetailShell>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <RaisedButton label="Create room" sub={safe ? undefined : "Tick the safety promise first"} disabled={!safe} busy={busy} onPress={() => void create()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  label: { ...type.eyebrow, color: text.tertiary, marginTop: space.xl, marginBottom: space.sm },
  games: { gap: space.sm },
  game: { padding: space.lg, borderRadius: radius.card, borderWidth: 2, borderColor: border.soft, backgroundColor: bg.surface },
  gameOn: { borderColor: accent.band, backgroundColor: accent.soft },
  gameOff: { opacity: 0.55 },
  gameTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  gameNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  input: { height: 52, paddingHorizontal: space.lg, borderRadius: radius.input, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface, ...type.body, color: text.primary },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.sm, borderRadius: radius.input, backgroundColor: bg.subtle },
  stepButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 17, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  switchRow: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  rowTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  rowNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  chips: { flexDirection: "row", gap: space.sm },
  chip: { flex: 1, height: 44, borderRadius: 14, borderWidth: 2, borderColor: border.soft, alignItems: "center", justifyContent: "center", backgroundColor: bg.surface },
  chipOn: { borderColor: accent.band, backgroundColor: accent.soft },
  chipText: { fontSize: 14, fontWeight: "700", color: text.primary },
  safety: { flexDirection: "row", gap: space.md, alignItems: "flex-start", marginTop: space.xl, padding: space.lg, borderRadius: radius.card, backgroundColor: accent.soft },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: text.primary, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: accent.deep, borderColor: accent.band },
  safetyText: { ...type.supporting, color: text.primary, flex: 1 },
  error: { ...type.supporting, color: "#B4442C", marginTop: space.lg },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
