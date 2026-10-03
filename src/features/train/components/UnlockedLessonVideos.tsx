import { useEffect, useState } from "react";
import { BackHandler, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftIcon, ArrowCounterClockwiseIcon, PlayIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { TrainingClipGuide, TrainingClipTimeline } from "./TrainingClipGuide";
import { TrainingClipVideo } from "./TrainingClipVideo";
import { getTrainingClipLessons } from "@/features/train/media/trainingClipLessons";
import { getTrainingClipAssets } from "@/features/train/media/trainingClipAssets";
import { useTrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";
import { accent, bg, border, layout, radius, space, text, type } from "@/constants/design";

// This viewer has no training mutations. Watching, seeking, and switching
// videos cannot spend Energy, report success, or alter checkpoint progress.
export function UnlockedLessonVideos({ skillCode, title, onClose }: {
  skillCode: string;
  title: string;
  onClose: () => void;
}) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const lessons = getTrainingClipLessons(skillCode);
  const selected = lessons.find(item => item.levelNumber === selectedLevel);
  const showLibrary = () => setSelectedLevel(null);
  useEffect(() => {
    if (selectedLevel === null) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelectedLevel(null);
      return true;
    });
    return () => subscription.remove();
  }, [selectedLevel]);

  if (selected) return <UnlockedVideoPlayer key={`${skillCode}-${selectedLevel}`} skillCode={skillCode} level={selected.levelNumber} title={title} onBack={showLibrary} />;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.library}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Your lesson videos</Text>
        <Text style={styles.lessonTitle}>{title}</Text>
        <Text style={styles.subtitle}>Pick a moment to rewatch, anytime.</Text>
      </View>
      <View style={styles.list}>
        {lessons.map(lesson => <PressScale key={lesson.id} accessibilityRole="button" accessibilityLabel={`Watch ${lesson.steps[0]?.title}`} onPress={() => setSelectedLevel(lesson.levelNumber)} style={styles.videoRow}>
          <Image source={getTrainingClipAssets(skillCode, lesson.levelNumber)?.poster} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.rowText}><Text numberOfLines={2} style={styles.rowTitle}>{lesson.steps[0]?.title}</Text></View>
          <PlayIcon size={22} color={text.primary} weight="fill" />
        </PressScale>)}
      </View>
    </ScrollView>
    <View style={styles.footer}><PressScale accessibilityRole="button" accessibilityLabel="Back to roadmap" style={styles.primary} onPress={onClose}><Text style={styles.buttonText}>Back to roadmap</Text></PressScale></View>
  </SafeAreaView>;
}

function UnlockedVideoPlayer({ skillCode, level, title, onBack }: {
  skillCode: string; level: number; title: string; onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const lessons = getTrainingClipLessons(skillCode);
  const lesson = lessons.find(item => item.levelNumber === level)!;
  const assets = getTrainingClipAssets(skillCode, level)!;
  const playback = useTrainingClipPlayback(lesson, assets.source, true);
  const leave = () => { playback.pause(); onBack(); };
  return <View style={styles.screen}>
    <View style={[styles.stage, { height: Math.round(height * 0.4) }]}>
      <TrainingClipVideo playback={playback} poster={assets.poster} />
      <PressScale accessibilityRole="button" accessibilityLabel="All lesson videos" style={[styles.back, { top: insets.top + space.sm }]} onPress={leave}><ArrowLeftIcon size={24} color={text.inverse} /></PressScale>
    </View>
    <View style={styles.playerSheet}>
      <Text numberOfLines={1} style={styles.caption}>{title}</Text>
      <Text style={styles.rowTitle}>{lesson.steps[0]?.title}</Text>
      <TrainingClipGuide lesson={lesson} playback={playback} />
    </View>
    <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
      <TrainingClipTimeline lesson={lesson} playback={playback} />
      <View style={styles.controls}>
        <PressScale accessibilityRole="button" accessibilityLabel="Watch again" style={styles.replay} onPress={playback.playWhole}><ArrowCounterClockwiseIcon size={24} color={text.primary} /></PressScale>
        <PressScale accessibilityRole="button" accessibilityLabel="All lesson videos" style={[styles.primary, styles.grow]} onPress={leave}><Text style={styles.buttonText}>All videos</Text></PressScale>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  library: { padding: layout.gutter, gap: space.xxl },
  heading: { alignItems: "center", gap: space.sm },
  title: { ...type.pageTitle, color: text.primary, textAlign: "center" },
  lessonTitle: { ...type.cardTitle, color: text.primary, textAlign: "center" },
  subtitle: { ...type.supporting, color: text.secondary, textAlign: "center" },
  caption: { ...type.supporting, color: text.secondary },
  list: { gap: space.md },
  videoRow: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderColor: border.soft, borderRadius: radius.card, padding: space.md },
  thumbnail: { width: 80, height: 54, borderRadius: radius.control, backgroundColor: bg.subtle },
  rowText: { flex: 1, gap: space.xs },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  footer: { paddingHorizontal: layout.gutter, paddingVertical: space.md, gap: space.sm, backgroundColor: bg.canvas },
  primary: { minHeight: layout.controlHeight, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  buttonText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
  stage: { backgroundColor: "#141414" },
  back: { position: "absolute", left: layout.gutter, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(28,27,26,0.55)", alignItems: "center", justifyContent: "center" },
  playerSheet: { flex: 1, minHeight: 0, paddingHorizontal: layout.gutter, paddingTop: space.md, gap: space.sm },
  controls: { flexDirection: "row", gap: space.md },
  replay: { width: layout.controlHeight, height: layout.controlHeight, borderRadius: radius.pill, borderWidth: 1, borderColor: border.soft, justifyContent: "center", alignItems: "center" },
  grow: { flex: 1 },
});
