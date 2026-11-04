import { Redirect } from "expo-router";
import { GameSessionScreen } from "@/features/game/flow/GameSessionScreen";
import { useGameFlowParams } from "@/features/game/flow/SoloScreens";

export default function GameSessionRoute() {
  const { mode, routeParams } = useGameFlowParams();
  return mode === "solo" ? <Redirect href={{ pathname: "/game/prepare", params: routeParams }} /> : <GameSessionScreen />;
}
