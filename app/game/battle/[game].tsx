import { Redirect } from "expo-router";

/** Nearby games no longer have description pages: make or join a room, then pick the game inside it. */
export default function BattleGameRedirect() {
  return <Redirect href={{ pathname: "/game/tournament", params: { mode: "nearby" } }} />;
}
