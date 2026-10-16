import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Modal, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { CameraIcon } from "phosphor-react-native";

import { setPendingPhoto } from "@/features/care/state/pendingPhoto";
import { accent, motion, text } from "@/constants/design";

const KNOB = 60;
const HALO = 78;
const DRAG = 150;
const COMMIT = 0.5;
const SPRING = { duration: 420, dampingRatio: 0.72 };
const GROW = 480;
const LINES = { w: 15, h: 34 };

/** The peek's footprint; the parent gives it room on its right edge, the way Activity makes room for the walk dog. */
export const PEEK = { width: 112, height: 84 };

/**
 * The food check, told the way the walk dog says "Let's walk": a camera peeks in from the screen edge. Drag it toward the middle (or tap it) and it swells into a circle that fills the screen, warming to
 * the camera's dark, and the camera opens out of it. Backing out shrinks the circle home, so the way in is the way out.
 */
export const AskPeek = ({ name, style }: { name: string; style?: StyleProp<ViewStyle> }) => {
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);
  const armed = useSharedValue(0);
  const pulse = useSharedValue(0);
  const grow = useSharedValue(0);
  const veil = useSharedValue(1);
  const knobRef = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);

  const { width: W, height: H } = Dimensions.get("window");

  useFocusEffect(
    useCallback(() => {
      x.value = 0;
      armed.value = 0;
    }, [armed, x]),
  );

  // On arrival the camera leans in once and its halo swells, the same hello the walk dog gives.
  useEffect(() => {
    if (reduceMotion) return;
    x.value = withDelay(900, withSequence(withTiming(-18, { duration: 260, easing: motion.easing.out }), withSpring(0, SPRING)));
    pulse.value = withDelay(900, withSequence(withTiming(1, { duration: 260 }), withTiming(0, { duration: 460 })));
  }, [pulse, reduceMotion, x]);

  const close = useCallback(() => {
    setOrigin(null);
    grow.value = 0;
    veil.value = 1;
    x.value = withSpring(0, SPRING);
    armed.value = 0;
  }, [armed, grow, veil, x]);

  const shrinkBack = useCallback(() => {
    grow.value = withTiming(0, { duration: 320, easing: motion.easing.drawer }, (done) => {
      if (done) runOnJS(close)();
    });
  }, [close, grow]);

  const openCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      // The check screen explains the permission and offers Settings.
      close();
      router.push("/care/food-check?start=camera" as never);
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.5, base64: true, exif: false });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset?.base64) {
        shrinkBack();
        return;
      }
      setPendingPhoto({ base64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg", uri: asset.uri });
      router.push("/care/food-check?start=photo" as never);
      // Let the check screen settle under the dark circle, then lift the circle away.
      veil.value = withDelay(
        320,
        withTiming(0, { duration: 220, easing: motion.easing.out }, (done) => {
          if (done) runOnJS(close)();
        }),
      );
    } catch {
      close();
      router.push("/care/food-check?start=camera" as never);
    }
  }, [close, shrinkBack, veil]);

  const launch = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (reduceMotion) {
      void openCamera();
      return;
    }
    knobRef.current?.measureInWindow((kx, ky, kw, kh) => setOrigin({ x: kx + kw / 2, y: ky + kh / 2 }));
  }, [openCamera, reduceMotion]);

  // Once the overlay sits over the camera, swell it past the farthest corner.
  useEffect(() => {
    if (!origin) return;
    grow.value = 0;
    grow.value = withTiming(1, { duration: GROW, easing: motion.easing.drawer }, (done) => {
      if (done) runOnJS(openCamera)();
    });
  }, [grow, openCamera, origin]);

  const tick = () => void Haptics.selectionAsync();

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onUpdate((event) => {
      const raw = event.translationX;
      x.value = raw < 0 ? Math.max(-DRAG * 1.15, raw) : raw * 0.18;
      const past = -x.value / DRAG >= COMMIT ? 1 : 0;
      if (past !== armed.value) {
        armed.value = past;
        runOnJS(tick)();
      }
    })
    .onEnd((event) => {
      if (-x.value / DRAG >= COMMIT || event.velocityX < -700) runOnJS(launch)();
      else {
        armed.value = 0;
        x.value = withSpring(0, SPRING);
      }
    });
  const tap = Gesture.Tap()
    .maxDuration(260)
    .onEnd(() => {
      runOnJS(launch)();
    });

  const knobStyle = useAnimatedStyle(() => {
    const p = interpolate(-x.value, [0, DRAG], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateX: x.value }, { rotate: `${-p * 12}deg` }, { scale: 1 + p * 0.16 + armed.value * 0.04 }] };
  });
  const haloStyle = useAnimatedStyle(() => {
    const p = interpolate(-x.value, [0, DRAG], [0, 1], Extrapolation.CLAMP);
    return { opacity: 0.9 - p * 0.35, transform: [{ translateX: x.value * 0.94 }, { scale: 1 + p * 0.5 + pulse.value * 0.12 }] };
  });
  const linesStyle = useAnimatedStyle(() => {
    const p = interpolate(-x.value, [0, DRAG], [0, 1], Extrapolation.CLAMP);
    return { opacity: 1 - Math.min(1, p * 1.6), transform: [{ translateX: x.value * 0.9 - p * 10 }, { scale: 1 + p * 0.35 + pulse.value * 0.2 }] };
  });

  // The swell: from camera size to past the farthest corner, warming from butter to the camera's dark as it covers.
  const reach = origin ? Math.hypot(Math.max(origin.x, W - origin.x), Math.max(origin.y, H - origin.y)) * 2 : 0;
  const end = reach / KNOB + 0.2;
  const circleStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
    backgroundColor: interpolateColor(grow.value, [0, 0.35, 1], [accent.deep, accent.deep, text.primary]),
    transform: [{ scale: 1 + grow.value * (end - 1) }],
  }));
  const glyphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(grow.value, [0, 0.3], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: 1 + grow.value * 0.8 }],
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        style={[styles.root, style]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Can ${name} eat this? Take a photo of a food to check it`}
        accessibilityHint="Drag the camera toward the middle, or tap, to open the camera"
        accessibilityActions={[{ name: "activate" }]}
        onAccessibilityAction={launch}
      >
        <Animated.View style={[styles.lines, linesStyle]} pointerEvents="none">
          <Image source={require("../../../../assets/walk/lines.png")} style={styles.fill} contentFit="contain" />
        </Animated.View>
        <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
        <Animated.View style={[styles.knob, knobStyle, origin && styles.hidden]}>
          <View ref={knobRef} collapsable={false} style={styles.knobFace}>
            <CameraIcon size={25} color={text.primary} weight="bold" />
          </View>
        </Animated.View>

        <Modal transparent visible={origin != null} animationType="none" statusBarTranslucent onRequestClose={shrinkBack}>
          {origin ? (
            <Animated.View style={[styles.swell, { left: origin.x - KNOB / 2, top: origin.y - KNOB / 2 }, circleStyle]} pointerEvents="none">
              <Animated.View style={glyphStyle}>
                <CameraIcon size={25} color={text.primary} weight="bold" />
              </Animated.View>
            </Animated.View>
          ) : null}
        </Modal>
      </View>
    </GestureDetector>
  );
};

const INK = text.primary;

const styles = StyleSheet.create({
  root: { position: "absolute", width: PEEK.width, height: PEEK.height },
  fill: { width: "100%", height: "100%" },
  // The camera hangs a little past the screen edge, so it reads as peeking in rather than parked.
  halo: { position: "absolute", right: -16 - (HALO - KNOB) / 2, bottom: 10 - (HALO - KNOB) / 2, width: HALO, height: HALO, borderRadius: HALO / 2, backgroundColor: accent.primary },
  knob: { position: "absolute", right: -16, bottom: 10, width: KNOB, height: KNOB, transformOrigin: "right bottom" },
  knobFace: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: accent.deep,
    borderWidth: 2,
    borderColor: INK,
    alignItems: "center",
    justifyContent: "center",
  },
  hidden: { opacity: 0 },
  lines: { position: "absolute", right: KNOB - 4, bottom: 22, width: LINES.w, height: LINES.h, transformOrigin: "right center" },
  swell: { position: "absolute", width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: "center", justifyContent: "center" },
});
