import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LockSimpleIcon } from "phosphor-react-native";

import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { roomErrorText } from "@/features/rooms/roomCopy";
import { useOrganizer } from "@/hooks/useRegions";
import { bg, space, text, type } from "@/constants/design";

/**
 * Road area screens for organizers only. Anyone else sees why, never the tools. This is for clarity: every admin
 * write is also refused by the server for non-organizers.
 */
export const OrganizerGate = ({ children, body, explain = roomErrorText }: { children: ReactNode; body?: string; explain?: (code: string) => string }) => {
  const organizer = useOrganizer();
  const insets = useSafeAreaInsets();

  if (organizer.isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={text.secondary} />
      </View>
    );
  }
  if (organizer.data === true) return <>{children}</>;

  const code = (organizer.error as { code?: string } | null)?.code;
  return (
    <View style={[styles.centered, { paddingBottom: insets.bottom + space.xl }]}>
      <View style={styles.disc}>
        <LockSimpleIcon size={28} color={text.primary} weight="fill" />
      </View>
      <Text style={styles.title}>{code ? "Couldn't check your access" : "Organizers only"}</Text>
      <Text style={styles.body}>{code ? explain(code) : (body ?? "Road areas are prepared and checked by PAWS organizers before anyone plays on them.")}</Text>
      {code ? <RaisedButton tone="yellow" label="Try again" onPress={() => void organizer.refetch()} style={styles.button} /> : null}
      <RaisedButton tone="white" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/game/tournament"))} style={styles.button} />
    </View>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl, backgroundColor: bg.canvas, gap: space.sm },
  disc: { width: 64, height: 64, borderRadius: 32, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  title: { ...type.sectionTitle, fontWeight: "800", color: text.primary, textAlign: "center" },
  body: { ...type.supporting, color: text.secondary, textAlign: "center", maxWidth: 300 },
  button: { alignSelf: "stretch", marginTop: space.sm },
});
