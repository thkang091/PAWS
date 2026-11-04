import { GamePreparationScreen, useGameFlowParams } from "@/features/game/flow/SoloScreens";
import SoloCameraScreen from "@/features/game/flow/SoloCameraScreen";

export default function PrepareGameRoute() {
  const { mode } = useGameFlowParams();
  return mode === "solo" ? <SoloCameraScreen /> : <GamePreparationScreen />;
}
