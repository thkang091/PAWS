import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { PawsDog, PawsDogHero, type DogPose } from "@/components/mascot/PawsDog";
import { motion } from "@/constants/design";

const HERO_WIDTH = 116;
const POSE_WIDTH = 112;
const STAGE_HEIGHT = 92;

type MascotStageProps = {
  pose: DogPose | null;
  curious?: boolean;
};

export const MascotStage = ({ pose, curious = false }: MascotStageProps) => {
  const [shown, setShown] = useState<{ pose: DogPose | null; curious: boolean }>({
    pose,
    curious,
  });
  const swap = useSharedValue(1);
  const pop = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (shown.pose === pose && shown.curious === curious) return;
    setShown({ pose, curious });
    swap.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: motion.duration.enter, easing: motion.easing.out }),
    );
    if (!reduceMotion) {
      pop.value = withSequence(
        withTiming(0.94, { duration: 90, easing: motion.easing.out }),
        withSpring(1, motion.spring),
      );
    }
  }, [pose, curious]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: reduceMotion ? [] : [{ scale: pop.value }],
  }));

  return (
    <View style={styles.stage} pointerEvents="none">
      <Animated.View style={animatedStyle}>
        {shown.pose === null ? (
          <PawsDogHero width={HERO_WIDTH} />
        ) : (
          <PawsDog size={POSE_WIDTH} pose={shown.pose} curious={shown.curious} />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: {
    height: STAGE_HEIGHT,
    width: HERO_WIDTH,
    alignItems: "flex-start",
    justifyContent: "flex-end",
  },
});
