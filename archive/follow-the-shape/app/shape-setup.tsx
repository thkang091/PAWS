import { useEffect, useRef, useState } from "react";
import { Linking, StyleSheet, Switch, Text, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CrosshairSimpleIcon, MapPinSimpleIcon, SlidersHorizontalIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { DetailShell } from "@/features/care/components/DetailShell";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import { ShapeGlyph } from "@/features/tournament/components/ShapeGlyph";
import { LocationTracking } from "@/features/tournament/gps/locationTracking";
import { DIFFICULTY_LABEL, MINUTES, distanceLabel, shapeChoices } from "@/features/tournament/shapeFlow";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

type Point = { latitude: number; longitude: number };

/** Walk settings: where to start (your location, or anywhere you move the map to), how long, and path preferences. */
export default function ShapeSetupScreen() {
  const params = useLocalSearchParams<{ id?: string; shape?: string; minutes?: string; lat?: string; lng?: string; stairs?: string; paths?: string }>();
  const insets = useSafeAreaInsets();
  const shape = shapeChoices().find((s) => s.key === params.shape) ?? null;
  const map = useRef<MapView | null>(null);
  const initial = params.lat && params.lng ? { latitude: Number(params.lat), longitude: Number(params.lng) } : null;
  const [start, setStart] = useState<Point | null>(initial);
  const [locating, setLocating] = useState(!initial);
  const [access, setAccess] = useState<"granted" | "denied" | "blocked" | "unavailable" | null>(null);
  const [minutes, setMinutes] = useState<15 | 25 | 40>((MINUTES.find((m) => m === Number(params.minutes)) ?? 25) as 15 | 25 | 40);
  const [avoidStairs, setAvoidStairs] = useState(params.stairs === "1");
  const [preferPaths, setPreferPaths] = useState(params.paths !== "0");

  const locate = async () => {
    setLocating(true);
    const a = await LocationTracking.requestAccess();
    setAccess(a);
    const fix = a === "granted" ? await LocationTracking.current() : null;
    setLocating(false);
    if (!fix) return;
    const here = { latitude: fix.latitude, longitude: fix.longitude };
    setStart(here);
    map.current?.animateCamera({ center: here, zoom: 16 }, { duration: 400 });
  };

  useEffect(() => {
    if (!initial) void locate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shape) {
    return (
      <DetailShell title="Walk settings" glyph={<SlidersHorizontalIcon size={20} color={accent.band} weight="bold" />} back="/game/tournament/shapes">
        <Text style={styles.lead}>Choose a shape first.</Text>
      </DetailShell>
    );
  }

  const find = () => {
    if (!start) return;
    void Haptics.selectionAsync();
    router.push({
      pathname: "/game/tournament/shape-routes",
      params: { id: params.id ?? "", shape: shape.key, minutes: String(minutes), lat: start.latitude.toFixed(6), lng: start.longitude.toFixed(6), stairs: avoidStairs ? "1" : "0", paths: preferPaths ? "1" : "0" },
    });
  };

  return (
    <View style={styles.flex}>
      <DetailShell title="Walk settings" glyph={<SlidersHorizontalIcon size={20} color={accent.band} weight="bold" />} back="/game/tournament/shapes">
        <View style={styles.shapeRow}>
          <View style={styles.shapeArt}>
            <ShapeGlyph points={shape.points} closed={shape.closed} size={44} strokeWidth={4} />
          </View>
          <View style={styles.flexOnly}>
            <Text style={styles.shapeName}>{shape.name}</Text>
            <Text style={styles.shapeLine}>{`${DIFFICULTY_LABEL[shape.difficulty]}. ${shape.closed ? "A loop back to your start." : "Ends away from your start."}`}</Text>
          </View>
        </View>

        <Text style={styles.label}>START</Text>
        <View style={styles.mapBox}>
          {start ? (
            <MapView
              ref={map}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_GOOGLE}
              initialRegion={{ ...start, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
              customMapStyle={QUIET_MAP}
              showsUserLocation={access === "granted"}
              showsMyLocationButton={false}
              showsPointsOfInterests={false}
              showsCompass={false}
              toolbarEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              onRegionChangeComplete={(r: Region) => setStart({ latitude: r.latitude, longitude: r.longitude })}
            />
          ) : (
            <View style={styles.mapEmpty}>
              <Text style={styles.mapEmptyText}>{locating ? "Finding you" : access === "blocked" ? "Location is off for PAWS." : "Allow location to start from here."}</Text>
              {!locating ? (
                access === "blocked" ? (
                  <RaisedButton tone="white" height={44} label="Open Settings" onPress={() => void Linking.openSettings()} />
                ) : (
                  <RaisedButton tone="white" height={44} label="Use my location" onPress={() => void locate()} />
                )
              ) : null}
            </View>
          )}
          {start ? (
            <>
              {/* The pin stays in the middle; move the map under it to choose a start. */}
              <View pointerEvents="none" style={styles.pinWrap}>
                <MapPinSimpleIcon size={36} color={text.primary} weight="fill" />
              </View>
              <PressScale accessibilityRole="button" accessibilityLabel="Start from my location" style={styles.locate} onPress={() => void locate()}>
                <CrosshairSimpleIcon size={20} color={text.primary} weight="bold" />
              </PressScale>
            </>
          ) : null}
        </View>
        <Text style={styles.hint}>Move the map to start somewhere else. Routes begin at the nearest public walking path.</Text>

        <Text style={styles.label}>LENGTH</Text>
        <View style={styles.lengths}>
          {MINUTES.map((m) => {
            const on = minutes === m;
            return (
              <PressScale
                key={m}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${m} minutes, ${distanceLabel(m)}`}
                style={[styles.length, on && styles.lengthOn]}
                onPress={() => {
                  setMinutes(m);
                  void Haptics.selectionAsync();
                }}
              >
                <Text style={styles.lengthValue}>{`${m} min`}</Text>
                <Text style={styles.lengthNote}>{distanceLabel(m)}</Text>
              </PressScale>
            );
          })}
        </View>

        <Text style={styles.label}>WITH YOUR DOG</Text>
        <View style={styles.group}>
          <Pref title="Footpaths and park trails first" note="Where the path data marks them." value={preferPaths} onChange={setPreferPaths} />
          <Pref title="Avoid stairs" note="Only where the path data marks steps." value={avoidStairs} onChange={setAvoidStairs} rule />
        </View>
        <View style={{ height: 110 + insets.bottom }} />
      </DetailShell>
      <View style={[styles.bar, { paddingBottom: insets.bottom + space.md }]}>
        <RaisedButton label="Find routes" sub={start ? `${minutes} min, ${distanceLabel(minutes)}` : "Choose a start"} disabled={!start} onPress={find} />
      </View>
    </View>
  );
}

const Pref = ({ title, note, value, onChange, rule }: { title: string; note: string; value: boolean; onChange: (v: boolean) => void; rule?: boolean }) => (
  <View style={[styles.pref, rule && styles.prefRule]}>
    <View style={styles.flexOnly}>
      <Text style={styles.prefTitle}>{title}</Text>
      <Text style={styles.prefNote}>{note}</Text>
    </View>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: accent.band, false: border.default }} accessibilityLabel={title} />
  </View>
);

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: bg.canvas },
  flexOnly: { flex: 1 },
  lead: { ...type.supporting, color: text.secondary },
  shapeRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: accent.soft },
  shapeArt: { width: 56, height: 56, borderRadius: 16, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center" },
  shapeName: { ...type.cardTitle, fontWeight: "800", color: text.primary },
  shapeLine: { ...type.caption, color: text.secondary, marginTop: 2 },
  label: { ...type.eyebrow, color: text.tertiary, marginTop: space.xl, marginBottom: space.sm },
  mapBox: { height: 220, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: border.soft, backgroundColor: bg.stage },
  mapEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.lg },
  mapEmptyText: { ...type.supporting, color: text.secondary, textAlign: "center" },
  pinWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 36, alignItems: "center", justifyContent: "center" },
  locate: { position: "absolute", right: space.sm, bottom: space.sm, width: 44, height: 44, borderRadius: 22, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: border.soft },
  hint: { ...type.caption, color: text.secondary, marginTop: space.sm },
  lengths: { flexDirection: "row", gap: space.sm },
  length: { flex: 1, paddingVertical: space.md, borderRadius: 16, borderWidth: 2, borderColor: border.soft, backgroundColor: bg.surface, alignItems: "center" },
  lengthOn: { borderColor: accent.band, backgroundColor: accent.soft },
  lengthValue: { fontSize: 17, fontWeight: "800", color: text.primary, fontVariant: ["tabular-nums"] },
  lengthNote: { ...type.caption, color: text.secondary, marginTop: 2, fontVariant: ["tabular-nums"] },
  group: { borderRadius: radius.card, borderWidth: 1, borderColor: border.soft, backgroundColor: bg.surface },
  pref: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg },
  prefRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
  prefTitle: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  prefNote: { ...type.caption, color: text.secondary, marginTop: 2 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, backgroundColor: bg.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border.default },
});
