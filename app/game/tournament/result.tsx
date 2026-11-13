import { useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShareNetworkIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { TerritoryMap, type TerritoryMapHandle } from "@/features/tournament/components/TerritoryMap";
import { TournamentResultCard } from "@/features/tournament/components/TournamentResultCard";
import { errorText, formatArea } from "@/features/tournament/format";
import { useTerritory } from "@/hooks/useTournaments";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

const MAP_HEIGHT = 340;

/** The checked territory: its outline on the map, the official area, the walk, the place, and Share. */
export default function TerritoryResultScreen() {
  const params = useLocalSearchParams<{ submissionId?: string; tournamentId?: string; rank?: string; total?: string }>();
  const insets = useSafeAreaInsets();
  const dog = useCurrentDog();
  const territory = useTerritory(params.submissionId);
  const mapRef = useRef<TerritoryMapHandle>(null);
  const [sharing, setSharing] = useState(false);
  const [withMap, setWithMap] = useState(false);

  const outline = useMemo(
    () => territory.data?.outline.coordinates[0]?.map(([longitude, latitude]) => ({ latitude, longitude })) ?? null,
    [territory.data],
  );
  const rank = params.rank ? Number(params.rank) : null;
  const total = params.total ? Number(params.total) : null;
  const name = dog.data?.name ?? "My dog";

  const summary = () => {
    const area = formatArea(territory.data?.areaM2 ?? 0);
    const place = rank ? ` and placed ${rank}${total ? ` of ${total}` : ""}` : "";
    return `${name} claimed ${area} in Make the Largest Country on PAWS${place}.`;
  };

  const share = async () => {
    if (!withMap) {
      setSharing(false);
      await Share.share({ message: summary() }).catch(() => undefined);
      return;
    }
    // A picture of the route can show where you live. Ask once more, plainly, before it leaves the phone.
    Alert.alert("Share the map picture?", "It shows the exact streets you walked, which may be close to your home.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Share with map",
        onPress: async () => {
          setSharing(false);
          const uri = await mapRef.current?.snapshot();
          await Share.share(uri ? { message: summary(), url: uri } : { message: summary() }).catch(() => undefined);
        },
      },
    ]);
  };

  // Back to the game this walk was for: a friend battle opens by its id, the weekly game ignores it.
  const back = () => (params.tournamentId ? router.replace({ pathname: "/game/tournament/largest-country", params: { id: params.tournamentId } }) : router.back());

  return (
    <View style={styles.screen}>
      <View style={styles.map}>
        <TerritoryMap segments={[]} start={outline?.[0] ?? null} outline={outline} topInset={insets.top + 60} bottomInset={60} />
        <PressScale accessibilityRole="button" accessibilityLabel="Close" style={[styles.close, { top: insets.top + space.sm }]} onPress={back}>
          <XIcon size={20} color={text.primary} weight="bold" />
        </PressScale>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]} showsVerticalScrollIndicator={false}>
        {territory.data ? (
          <TournamentResultCard
            areaM2={territory.data.areaM2}
            distanceM={territory.data.distanceM}
            elapsedSeconds={territory.data.elapsedSeconds}
            rank={rank}
            total={total}
            personalBest={territory.data.personalBest}
            flagged={territory.data.validationStatus === "flagged"}
          />
        ) : (
          <Text style={styles.loading}>{territory.error ? errorText((territory.error as { code?: string }).code) : "Loading your territory."}</Text>
        )}
        <View style={styles.actions}>
          <RaisedButton tone="white" label="Share" icon={<ShareNetworkIcon size={18} color={text.primary} weight="bold" />} disabled={!territory.data} onPress={() => setSharing(true)} style={styles.flex} />
          <RaisedButton
            label="Leaderboard"
            disabled={!territory.data}
            onPress={() => territory.data && router.push({ pathname: "/game/tournament/leaderboard", params: { id: territory.data.tournamentId } })}
            style={styles.flex}
          />
        </View>
        <PressScale accessibilityRole="button" accessibilityLabel="Done" style={styles.done} onPress={back}>
          <Text style={styles.doneText}>Done</Text>
        </PressScale>
      </ScrollView>

      <Modal visible={sharing} transparent animationType="slide" onRequestClose={() => setSharing(false)}>
        <View style={styles.scrim}>
          <Pressable style={styles.flex} accessibilityLabel="Close" onPress={() => setSharing(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <Text style={styles.sheetTitle}>Share your result</Text>
            <View style={styles.preview}>
              <Text style={styles.previewText}>{summary()}</Text>
            </View>
            <View style={styles.toggle}>
              <View style={styles.flex}>
                <Text style={styles.toggleTitle}>Include the map picture</Text>
                <Text style={styles.toggleNote}>Off by default. It shows where you walked.</Text>
              </View>
              <Switch value={withMap} onValueChange={setWithMap} trackColor={{ true: accent.band, false: border.default }} />
            </View>
            <RaisedButton label="Share" onPress={() => void share()} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  flex: { flex: 1 },
  map: { height: MAP_HEIGHT, overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: bg.stage },
  close: { position: "absolute", left: space.lg, width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center" },
  body: { padding: layout.gutter, gap: space.lg },
  loading: { ...type.supporting, color: text.secondary },
  actions: { flexDirection: "row", gap: space.md },
  done: { alignSelf: "center", paddingVertical: space.sm, paddingHorizontal: space.lg },
  doneText: { ...type.supporting, fontWeight: "700", color: text.secondary },
  scrim: { flex: 1, backgroundColor: "rgba(28,27,26,0.4)" },
  sheet: { backgroundColor: bg.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space.xxl, gap: space.lg },
  sheetTitle: { ...type.sectionTitle, fontWeight: "700", color: text.primary },
  preview: { padding: space.lg, borderRadius: radius.card, backgroundColor: bg.subtle },
  previewText: { ...type.body, color: text.primary },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md },
  toggleTitle: { ...type.supporting, fontWeight: "700", color: text.primary },
  toggleNote: { ...type.caption, color: text.secondary },
});
