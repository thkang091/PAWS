import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import {
  GameControllerIcon,
  HeartIcon,
  PathIcon,
  UserIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";

import { PawsTabBar } from "@/features/home/components/navigation/PawsTabBar";

const glyph =
  (Glyph: PhosphorIcon) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Glyph size={size} color={String(color)} weight={focused ? "fill" : "regular"} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <PawsTabBar {...props} />}
    >
      <Tabs.Screen name="train" options={{ title: "Train", tabBarIcon: glyph(PathIcon) }} />
      <Tabs.Screen name="care" options={{ title: "Care", tabBarIcon: glyph(HeartIcon) }} />
      <Tabs.Screen
        name="game"
        options={{ title: "Game", tabBarIcon: glyph(GameControllerIcon) }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: glyph(UserIcon) }}
      />
      <Tabs.Screen name="dog-moment" options={{ href: null }} />
    </Tabs>
  );
}
