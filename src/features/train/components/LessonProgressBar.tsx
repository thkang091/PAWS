import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { PressScale } from '@/components/ui/PressScale';
import { accent, border, radius } from '@/constants/design';
import type { LessonAccess } from '@/services/trainingRoundService';

export function LessonProgressBar({ items, current, onSelect, disabled = false, playbackProgress = 0 }: {
  items: readonly (LessonAccess & { title: string })[];
  current: number;
  onSelect: (level: number) => void;
  disabled?: boolean;
  playbackProgress?: number;
}) {
  return <View testID="lesson-progress" style={styles.bar} accessibilityLabel="This session's progress">
    {items.map(item => <PressScale key={item.levelId} accessibilityRole="button"
      accessibilityLabel={`Go to ${item.title}`}
      accessibilityHint={item.visited ? item.completed ? 'Completed practice. Tap to revisit.' : 'Tap to return to this practice.' : 'Available when you reach this practice.'}
      accessibilityState={{ selected: item.levelNumber === current, disabled: disabled || !item.visited }}
      disabled={disabled || !item.visited} scaleTo={0.98} style={styles.segment}
      onPress={() => onSelect(item.levelNumber)}>
      <View style={[styles.track, item.completed && styles.completed]} />
      {item.levelNumber === current ? <PlaybackCursor progress={playbackProgress} /> : null}
    </PressScale>)}
  </View>;
}

function PlaybackCursor({ progress }: { progress: number }) {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReducedMotion();
  const position = useSharedValue(progress);
  useEffect(() => {
    const target = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    position.value = reduceMotion ? target : withTiming(target, { duration: 200, easing: Easing.linear });
  }, [progress, position, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * width }] }));
  return <View pointerEvents="none" style={styles.cursorTrack} onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}>
    <Animated.View testID="lesson-playback-cursor" style={[styles.cursor, animated]} />
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 3, minHeight: 44 },
  segment: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  track: { height: 3, width: '100%', borderRadius: radius.pill, backgroundColor: border.soft },
  completed: { backgroundColor: accent.deep },
  cursorTrack: { position: 'absolute', left: 0, right: 9, top: 0, bottom: 0, justifyContent: 'center' },
  cursor: { position: 'absolute', width: 9, height: 9, borderRadius: radius.pill, backgroundColor: accent.deep },
});
