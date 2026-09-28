import { StyleSheet, View } from "react-native";

import { ChapterNode, NODE_SIZE, type NodeState } from "@/features/train/components/ChapterNode";
import { ChapterPath } from "@/features/train/components/ChapterPath";
import { GardenBackdrop } from "@/features/train/components/GardenBackdrop";
import { Reveal } from "@/features/onboarding/components/Reveal";
import { motion, radius, space } from "@/constants/design";

export type TrailStep = { id: string; title: string; state: NodeState };

const LANE = [0.22, 0.36];
const SLOT_H = 118;
const TRAIL_TOP = NODE_SIZE / 2 + space.sm;

export const TopicTrail = ({
  topicKey,
  steps,
  doneCount,
  width,
  onStepPress,
}: {
  topicKey: string;
  steps: readonly TrailStep[];
  doneCount: number;
  width: number;
  onStepPress: (step: TrailStep, index: number) => void;
}) => {
  const points = steps.map((_, i) => ({ x: width * LANE[i % LANE.length], y: TRAIL_TOP + i * SLOT_H }));
  const trailHeight = TRAIL_TOP + Math.max(0, steps.length - 1) * SLOT_H + NODE_SIZE;
  const walked = steps.length < 2 ? doneCount : Math.min(1, doneCount / (steps.length - 1));

  return (
    <View key={topicKey} style={styles.meadow}>
      <GardenBackdrop width={width} height={trailHeight + space.xxl * 2} />
      <View style={{ width, height: trailHeight }}>
        <ChapterPath points={points} width={width} height={trailHeight} progress={Math.max(0, walked)} />
        {steps.map((step, i) => (
          <Reveal key={step.id} index={i} offset={motion.duration.enter}>
            <ChapterNode
              index={i}
              state={step.state}
              label={step.title}
              x={points[i].x}
              y={points[i].y}
              onPress={() => onStepPress(step, i)}
            />
          </Reveal>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  meadow: {
    marginTop: space.xl,
    borderRadius: radius.sheet,
    overflow: "hidden",
    paddingTop: space.xxl,
    paddingBottom: space.xxl,
  },
});
