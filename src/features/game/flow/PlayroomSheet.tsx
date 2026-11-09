import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { XIcon } from "phosphor-react-native";

import { PressScale } from "@/components/ui/PressScale";
import { bg, motion, radius, space, text } from "@/constants/design";
import { ui } from "./GameFlowUI";

export function PlayroomSheet({ visible, title, onClose, children, rise = false }: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  rise?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [presented, setPresented] = useState(visible);
  const [panelHeight, setPanelHeight] = useState(0);
  const retained = useRef({ title, children, rise });
  // The parent clears its sheet state immediately. Retain the last visible contents
  // until the closing motion ends, rather than animating an empty dialog.
  if (visible) retained.current = { title, children, rise };
  const measured = panelHeight > 0;

  useLayoutEffect(() => {
    if (visible && !presented) {
      progress.setValue(0);
      setPresented(true);
      return;
    }
    if (!presented) return;
    if (reduceMotion || (!visible && !measured)) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) { setPresented(false); setPanelHeight(0); }
      return;
    }
    if (!measured) return;

    let active = true;
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? motion.duration.enter : motion.duration.exit,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({ finished }) => {
      if (active && finished && !visible) {
        setPresented(false);
        setPanelHeight(0);
      }
    });
    return () => { active = false; animation.stop(); };
  }, [visible, presented, measured, reduceMotion, progress]);

  if (!presented) return null;
  const displayed = visible ? { title, children, rise } : retained.current;
  const dismiss = () => { if (visible) onClose(); };
  const translateY = displayed.rise ? progress.interpolate({
    inputRange: [0, 1],
    outputRange: [panelHeight + insets.bottom + space.lg, 0],
  }) : 0;

  return <Modal transparent visible animationType="none" onRequestClose={dismiss}>
    <Animated.View pointerEvents="none" testID="playroom-scrim" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]} />
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.frame, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
      <Animated.View testID="playroom-sheet" accessibilityViewIsModal onAccessibilityEscape={dismiss}
        onLayout={event => setPanelHeight(Math.round(event.nativeEvent.layout.height))}
        style={[styles.sheet, { opacity: progress, transform: [{ translateY }] }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[ui.sectionTitle, styles.title]}>{displayed.title}</Text>
          <PressScale accessibilityRole="button" accessibilityLabel="Close dialog" onPress={dismiss} style={ui.iconButton}>
            <XIcon size={21} color={text.primary} />
          </PressScale>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}>
          {displayed.children}
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(28,27,26,0.35)" },
  frame: { flex: 1, justifyContent: "flex-end", alignItems: "center", paddingHorizontal: space.lg },
  sheet: { width: "100%", maxWidth: 480, maxHeight: "100%", borderRadius: radius.sheet, backgroundColor: bg.canvas, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.md },
  title: { flex: 1, minWidth: 0 },
  content: { paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.lg },
});
