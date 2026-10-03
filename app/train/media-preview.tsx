import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { PressScale } from "@/components/ui/PressScale";
import { TrainingClipGuide, TrainingClipTimeline } from "@/features/train/components/TrainingClipGuide";
import { TrainingClipVideo } from "@/features/train/components/TrainingClipVideo";
import { getTrainingClipLessons } from "@/features/train/media/trainingClipLessons";
import { getTrainingClipAssets } from "@/features/train/media/trainingClipAssets";
import { useTrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";
import { accent, bg, radius, space, text, type } from "@/constants/design";
import sections23Coverage from "@/features/train/media/sections23Coverage.generated.json";
import section4Coverage from "@/features/train/media/section4Coverage.generated.json";
import section5Coverage from "@/features/train/media/section5Coverage.generated.json";
import section6Coverage from "@/features/train/media/section6Coverage.generated.json";

const courseTitles: Record<string, string> = {
  "1-1": "Wait at the Door", "1-2": "Stay Off the Furniture", "1-3": "Drop It", "1-4": "Start a Potty Routine", "1-5": "Pause Unnecessary Barking",
  ...Object.fromEntries(Object.entries(sections23Coverage.courses).map(([skill, course]) => [skill, course.title])),
  ...Object.fromEntries(Object.entries(section4Coverage.courses).map(([skill, course]) => [skill, course.title])),
  ...Object.fromEntries(Object.entries(section5Coverage.courses).map(([skill, course]) => [skill, course.title])),
  ...Object.fromEntries(Object.entries(section6Coverage.courses).map(([skill, course]) => [skill, course.title])),
};

// Development-only media review: uses the same player and captions as the live
// lesson without creating a training session or spending a dog's Energy.
export default function TrainingMediaPreview() {
  if (!__DEV__) return <Redirect href="/(tabs)/train" />;
  return <MediaPreview />;
}

function MediaPreview() {
  const { skill } = useLocalSearchParams<{ skill?: string }>();
  const skillCode = skill && getTrainingClipLessons(skill).length ? skill : "1-1";
  const lessons = getTrainingClipLessons(skillCode);
  const [level, setLevel] = useState(1);
  const lesson = lessons.find(item => item.levelNumber === level) ?? lessons[0];
  const nextLesson = lessons[lessons.indexOf(lesson) + 1];
  const assets = getTrainingClipAssets(skillCode, lesson.levelNumber)!;
  const playback = useTrainingClipPlayback(lesson, assets.source, true);
  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <PressScale accessibilityRole="button" accessibilityLabel="Back to Train" onPress={() => router.replace("/(tabs)/train")} style={styles.back}><Text>← Train</Text></PressScale>
      <Text style={styles.label}>MEDIA PREVIEW</Text>
    </View>
    <View style={styles.heading}><Text style={styles.title}>{courseTitles[skillCode]}</Text><Text style={styles.note}>Section {skillCode.split("-")[0]} · Lesson {skillCode}</Text></View>
    <View style={styles.levels}>{lessons.map((item) => <PressScale key={item.id} accessibilityRole="button" accessibilityLabel={`Preview Level ${item.levelNumber}`} accessibilityState={{ selected: lesson.levelNumber === item.levelNumber }} onPress={() => { playback.pause(); setLevel(item.levelNumber); }} style={[styles.level, lesson.levelNumber === item.levelNumber && styles.selected]}><Text>Level {item.levelNumber}</Text></PressScale>)}</View>
    <View style={styles.video}><TrainingClipVideo playback={playback} poster={assets.poster} /></View>
    <View style={styles.content}>
      <TrainingClipGuide key={lesson.id} lesson={lesson} playback={playback} />
      <TrainingClipTimeline lesson={lesson} playback={playback} />
      <View style={styles.controls}>
        <PressScale accessibilityRole="button" accessibilityLabel="Watch again" style={styles.level} onPress={playback.playWhole}><Text>↺</Text></PressScale>
        <PressScale accessibilityRole="button" accessibilityLabel="Continue" disabled={!playback.hasCompleted} style={[styles.level, styles.selected, !playback.hasCompleted && styles.disabled]} onPress={() => nextLesson ? setLevel(nextLesson.levelNumber) : router.replace("/(tabs)/train")}><Text>Continue</Text></PressScale>
      </View>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  header: { paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { minHeight: 44, justifyContent: "center" },
  label: { ...type.eyebrow, color: text.secondary },
  heading: { paddingHorizontal: space.xl, gap: space.xs },
  title: { ...type.pageTitle, color: text.primary },
  note: { ...type.supporting, color: text.secondary },
  levels: { padding: space.lg, flexDirection: "row", gap: space.sm },
  level: { flex: 1, minHeight: 44, borderRadius: radius.pill, backgroundColor: bg.subtle, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: accent.primary },
  video: { width: "100%", aspectRatio: 16 / 9, maxHeight: 340, backgroundColor: "#141414" },
  content: { flex: 1, minHeight: 0, padding: space.xl, paddingBottom: space.sm },
  controls: { flexDirection: "row", gap: space.sm },
  disabled: { opacity: 0.5 },
});
