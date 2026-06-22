import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";

import { theme } from "@/constants/theme";

type IoniconName = keyof typeof Ionicons.glyphMap;

const icon =
  (active: IoniconName, inactive: IoniconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) =>
    <Ionicons name={focused ? active : inactive} size={24} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primaryDark,
        tabBarInactiveTintColor: theme.colors.textSubtle,
        tabBarStyle: {
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.card,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="train"
        options={{
          title: "Train",
          tabBarIcon: icon("school", "school-outline"),
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: "Care",
          tabBarIcon: icon("heart", "heart-outline"),
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: "Game",
          tabBarIcon: icon("game-controller", "game-controller-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          href: null,
          tabBarIcon: icon("person-circle", "person-circle-outline"),
        }}
      />
      <Tabs.Screen
        name="dog-moment"
        options={{ href: null }}
      />
    </Tabs>
  );
}
