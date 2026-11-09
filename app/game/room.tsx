import { useLocalSearchParams } from "expo-router";
import { DuelPlayroom } from "@/features/game/flow/DuelPlayroom";
import { GameRoomScreen } from "@/features/game/flow/MultiplayerScreens";

export default function RoomScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return mode === "tournament" ? <GameRoomScreen /> : <DuelPlayroom />;
}
