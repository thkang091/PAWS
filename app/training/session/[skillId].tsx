import { useMemo } from "react";
import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ScreenContainer } from "@/components/ui/ScreenContainer";
import { getActivityDefinition } from "@/config/activityDefinitions";
import { theme } from "@/constants/theme";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useTrainingSkills } from "@/hooks/useTrainingSkills";

const corgiImage = require("../../../assets/training/corgi-sit-lesson.png");

export default function GuidedTrainingSessionScreen() {
  const { skillId } = useLocalSearchParams<{ skillId: string }>();
  const dog = useCurrentDog();
  const skills = useTrainingSkills();
  const skill = useMemo(() => (skills.data ?? []).find((item) => item.id === skillId), [skillId, skills.data]);
  const verificationActivityId = useMemo(() => {
    if (!skill) return null;
    const mapped = skill.slug === "paw-shake" ? "paw" : skill.slug === "roll-over" ? "roll_over" : skill.slug.includes("recall") || skill.slug === "come" ? "recall" : skill.slug;
    return getActivityDefinition(mapped) ? mapped : null;
  }, [skill]);

  if (dog.isLoading || skills.isLoading) return <ScreenContainer centered><LoadingState message="Preparing lesson..." /></ScreenContainer>;
  if (!dog.data || !skill) return <ScreenContainer centered><ErrorState message="Training lesson could not start." /></ScreenContainer>;

  const steps = [
    { title: "Get Attention", body: "Hold a high-value treat right near their nose. Let them smell it to lock in their focus." },
    { title: "Move Hand Up", body: "Slowly move your hand up and back over their head." },
    { title: "Reward", body: "The moment their bottom hits the floor, say “Yes!” and treat." },
  ];

  return (
    <ScreenContainer scroll>
      <ImageBackground source={corgiImage} imageStyle={styles.lessonImage} style={styles.lessonHero}>
        <View style={styles.playButton}><Ionicons name="play" size={38} color={theme.colors.white} /></View>
        <View style={styles.lessonTag}><Text style={styles.lessonTagText}>Lesson: {skill.name}</Text></View>
      </ImageBackground>

      <Text style={styles.title}>Step-by-Step Guide</Text>

      {steps.map((step, index) => (
        <View key={step.title} style={[styles.stepCard, index > 0 && styles.collapsedStep]}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepNumber, index === 0 && styles.stepNumberActive]}>
              <Text style={[styles.stepNumberText, index === 0 && styles.stepNumberTextActive]}>{index + 1}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
          </View>
          <Text style={styles.stepBody}>{step.body}</Text>
          {index === 0 ? (
            <>
              <View style={styles.tipBox}>
                <MaterialCommunityIcons name="lightbulb-on" size={18} color="#656B37" />
                <View style={styles.tipTextWrap}>
                  <Text style={styles.tipLabel}>TRAINER TIP</Text>
                  <Text style={styles.tipText}>Make sure your dog is standing before you start this step.</Text>
                </View>
              </View>
              <View style={styles.mistakeBox}>
                <Ionicons name="warning" size={18} color="#D2272F" />
                <View style={styles.tipTextWrap}>
                  <Text style={styles.mistakeLabel}>COMMON MISTAKE</Text>
                  <Text style={styles.mistakeText}>Don’t hold the treat too high, or your dog will try to jump up instead of looking up.</Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      ))}

      <Pressable style={styles.practiceButton} onPress={() => router.push(`/activity/${verificationActivityId ?? "sit"}?context=training`)}>
        <MaterialCommunityIcons name="paw" size={22} color={theme.colors.white} />
        <Text style={styles.practiceText}>Practice Now</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lessonHero: { height: 312, borderRadius: 8, overflow: "hidden", justifyContent: "center", alignItems: "center" },
  lessonImage: { borderRadius: 8 },
  playButton: { width: 74, height: 74, borderRadius: 37, backgroundColor: "rgba(84,89,74,0.82)", alignItems: "center", justifyContent: "center", paddingLeft: 4 },
  lessonTag: { position: "absolute", left: theme.spacing.lg, bottom: theme.spacing.lg, backgroundColor: "#FFFCF7", borderRadius: 6, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  lessonTagText: { color: "#43483A", fontSize: 13, fontWeight: "800" },
  title: { color: "#111411", fontSize: 24, fontWeight: "900", letterSpacing: 0 },
  stepCard: { backgroundColor: "#FFFCF7", borderRadius: 10, borderWidth: 1, borderColor: "#E6DED2", padding: theme.spacing.lg, gap: theme.spacing.md },
  collapsedStep: { opacity: 0.78 },
  stepHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  stepNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#E5E3DE", alignItems: "center", justifyContent: "center" },
  stepNumberActive: { backgroundColor: "#697056" },
  stepNumberText: { color: theme.colors.textMuted, fontSize: 16, fontWeight: "900" },
  stepNumberTextActive: { color: theme.colors.white },
  stepTitle: { color: "#2A2E27", fontSize: 18, fontWeight: "900" },
  stepBody: { color: "#3F453D", fontSize: 16, lineHeight: 25, paddingLeft: 48 },
  tipBox: { flexDirection: "row", gap: theme.spacing.sm, backgroundColor: "#F4F2CE", borderRadius: 6, borderWidth: 1, borderColor: "#E3DDA0", padding: theme.spacing.md, marginLeft: 48 },
  mistakeBox: { flexDirection: "row", gap: theme.spacing.sm, borderRadius: 6, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#D2272F", padding: theme.spacing.md, marginLeft: 48 },
  tipTextWrap: { flex: 1 },
  tipLabel: { color: "#656B37", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  tipText: { color: "#5D614F", fontSize: 13, lineHeight: 19, marginTop: 3 },
  mistakeLabel: { color: "#D2272F", fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
  mistakeText: { color: "#5D4545", fontSize: 13, lineHeight: 19, marginTop: 3 },
  practiceButton: { position: "sticky" as never, minHeight: 58, borderRadius: 8, backgroundColor: "#697056", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xl, marginBottom: theme.spacing.lg },
  practiceText: { color: theme.colors.white, fontSize: 18, fontWeight: "900" },
});
