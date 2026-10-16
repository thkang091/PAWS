import { TrainingPracticeClip } from "./flow/TrainingPracticeClip";
import { getTrainingClipPoster } from "../media/trainingClipPosters";
import { useEffect, useState } from "react";
import { BackHandler, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlayIcon } from "phosphor-react-native";
import { PressScale } from "@/components/ui/PressScale";
import { getTrainingClipLessons } from "@/features/train/media/trainingClipLessons";
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

  if (selected) return <TrainingPracticeClip key={`${skillCode}-${selectedLevel}`} skillCode={skillCode}
    level={selected.levelNumber} title={title} onClose={showLibrary} onContinue={showLibrary}
    continueLabel="All videos" allowSkip />;

  return <SafeAreaView style={styles.screen}>
    <ScrollView contentContainerStyle={styles.library}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>Your lesson videos</Text>
        <Text style={styles.lessonTitle}>{title}</Text>
        <Text style={styles.subtitle}>Pick a moment to rewatch, anytime.</Text>
      </View>
      <View style={styles.list}>
        {lessons.map(lesson => <PressScale key={lesson.id} accessibilityRole="button" accessibilityLabel={`Watch ${lesson.steps[0]?.title}`} onPress={() => setSelectedLevel(lesson.levelNumber)} style={styles.videoRow}>
          <Image source={getTrainingClipPoster(skillCode, lesson.levelNumber)} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.rowText}><Text numberOfLines={2} style={styles.rowTitle}>{lesson.steps[0]?.title}</Text></View>
          <PlayIcon size={22} color={text.primary} weight="fill" />
        </PressScale>)}
      </View>
    </ScrollView>
    <View style={styles.footer}><PressScale accessibilityRole="button" accessibilityLabel="Back to roadmap" style={styles.primary} onPress={onClose}><Text style={styles.buttonText}>Back to roadmap</Text></PressScale></View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bg.canvas },
  library: { padding: layout.gutter, gap: space.xxl },
  heading: { alignItems: "center", gap: space.sm },
  title: { ...type.pageTitle, color: text.primary, textAlign: "center" },
  lessonTitle: { ...type.cardTitle, color: text.primary, textAlign: "center" },
  subtitle: { ...type.supporting, color: text.secondary, textAlign: "center" },
  list: { gap: space.md },
  videoRow: { flexDirection: "row", alignItems: "center", gap: space.md, borderWidth: 1, borderColor: border.soft, borderRadius: radius.card, padding: space.md },
  thumbnail: { width: 80, height: 54, borderRadius: radius.control, backgroundColor: bg.subtle },
  rowText: { flex: 1, gap: space.xs },
  rowTitle: { ...type.cardTitle, fontWeight: "600", color: text.primary },
  footer: { paddingHorizontal: layout.gutter, paddingVertical: space.md, gap: space.sm, backgroundColor: bg.canvas },
  primary: { minHeight: layout.controlHeight, borderRadius: radius.pill, backgroundColor: accent.deep, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xl },
  buttonText: { ...type.cardTitle, fontWeight: "700", color: text.primary },
});
