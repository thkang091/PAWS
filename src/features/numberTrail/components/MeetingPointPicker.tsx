import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CrosshairIcon, MapPinSimpleIcon, XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { RaisedButton } from "@/features/game/arena/RaisedButton";
import { QUIET_MAP } from "@/features/rooms/components/mapStyle";
import { LocationTracking } from "@/features/tournament/gps/locationTracking";
import type { Area } from "@/features/numberTrail/localStore";
import { bg, border, motion, radius, space, text, type } from "@/constants/design";

const SPAN = 0.006;

/**
 * Where the race starts: the host moves the map under a fixed pin to a public meeting point. Only a point is chosen
 * here; the server finds the real start corner and the number from the streets around it, and says so if it can't.
 */
export const MeetingPointPicker = ({
  visible,
  initial,
  onClose,
  onPick,
  title = "Meeting point",
  line = "Put the pin on a public street corner everyone can reach.",
  cta = "Use this spot",
}: {
  visible: boolean;
  initial: Area | null;
  onClose: () => void;
  onPick: (a: Area) => void;
  title?: string;
  line?: string;
  cta?: string;
}) => {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const map = useRef<MapView | null>(null);
  const [center, setCenter] = useState<Area | null>(initial);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const lift = useSharedValue(0);
  const pin = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 8 }] }));
  const shadow = useAnimatedStyle(() => ({ opacity: 0.25 - lift.value * 0.12, transform: [{ scale: 1 - lift.value * 0.25 }] }));

  const goToMe = async () => {
    setLocating(true);
    const access = await LocationTracking.requestAccess();
    if (access !== "granted") {
      setDenied(true);
      setLocating(false);
      return;
    }
    const fix = await LocationTracking.current();
    setLocating(false);
    if (!fix) return;
    const region = { latitude: fix.latitude, longitude: fix.longitude, latitudeDelta: SPAN, longitudeDelta: SPAN };
    map.current?.animateToRegion(region, reduceMotion ? 0 : 320);
    setCenter({ latitude: fix.latitude, longitude: fix.longitude });
  };

  useEffect(() => {
    if (visible && !initial) void goToMe();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (r: Region) => {
    lift.value = reduceMotion ? 0 : withTiming(0, { duration: motion.duration.pressOut, easing: motion.easing.out });
    setCenter({ latitude: r.latitude, longitude: r.longitude });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.screen}>
        <MapView
          ref={map}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          initialRegion={initial ? { ...initial, latitudeDelta: SPAN, longitudeDelta: SPAN } : undefined}
          customMapStyle={QUIET_MAP}
          showsUserLocation={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          onPanDrag={() => {
            if (!reduceMotion && lift.value === 0) lift.value = withTiming(1, { duration: motion.duration.pressIn, easing: motion.easing.out });
          }}
          onRegionChangeComplete={settle}
          accessibilityLabel="Map. Move it to put the pin on your meeting point."
        />
        <View pointerEvents="none" style={styles.pinWrap}>
          <Animated.View style={[styles.pinShadow, shadow]} />
          <Animated.View style={[styles.pin, pin]}>
            <MapPinSimpleIcon size={44} color={text.primary} weight="fill" />
          </Animated.View>
        </View>

        <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
          <PressScale accessibilityRole="button" accessibilityLabel="Close" style={styles.round} onPress={onClose}>
            <XIcon size={20} color={text.primary} weight="bold" />
          </PressScale>
          <PressScale accessibilityRole="button" accessibilityLabel="Go to my location" style={styles.round} onPress={() => void goToMe()}>
            {locating ? <ActivityIndicator color={text.primary} /> : <CrosshairIcon size={20} color={text.primary} weight="bold" />}
          </PressScale>
        </View>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.line}>{denied && !center ? "Location is off. Move the map to the place you want." : line}</Text>
          <RaisedButton
            label={cta}
            disabled={!center}
            style={styles.cta}
            onPress={() => {
              if (!center) return;
              void Haptics.selectionAsync();
              onPick(center);
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.subtle },
  pinWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  // The pin's tip sits on the map's centre.
  pin: { marginTop: -44 },
  pinShadow: { position: "absolute", width: 16, height: 6, borderRadius: 3, backgroundColor: text.primary },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space.lg },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: bg.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: border.soft },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.xxl, paddingTop: space.xl, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: bg.surface },
  title: { ...type.sectionTitle, fontWeight: "800", color: text.primary },
  line: { ...type.supporting, color: text.secondary, marginTop: 4 },
  cta: { marginTop: space.lg },
});
