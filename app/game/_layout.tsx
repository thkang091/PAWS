import { Stack } from "expo-router";

const full = { presentation: "fullScreenModal", gestureEnabled: false } as const;
const locked = { gestureEnabled: false } as const;

export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[gameId]" options={{ headerShown: true, title: "Challenge" }} />
      <Stack.Screen name="play" options={full} />
      <Stack.Screen name="number-trail/near" options={locked} />
      <Stack.Screen name="number-trail/room/[id]" options={locked} />
      <Stack.Screen name="tournament/walk" options={full} />
      <Stack.Screen name="tournament/result" options={locked} />
      <Stack.Screen name="tournament/reels-record" options={full} />
      <Stack.Screen name="room/[id]" options={locked} />
    </Stack>
  );
}
