import { MultiplayerHomeScreen } from "@/features/game/flow/MultiplayerScreens";
import { TournamentLockedScreen } from "@/features/game/flow/TournamentLockedScreen";
import { TOURNAMENT_ENABLED } from "@/features/game/flow/gameFlow";

export default function TournamentScreen() {
  return TOURNAMENT_ENABLED ? <MultiplayerHomeScreen tournament /> : <TournamentLockedScreen />;
}
