import { router } from "expo-router";
import { useState } from 'react';
import { TrainingPracticeClip } from "./TrainingPracticeClip";
import { PREVIEW_LESSON } from "./previewData";
import { getTrainingClipLessons } from '../../media/trainingClipLessons';
import { LessonProgressBar } from '../LessonProgressBar';
import { getRoundPracticeAccess, nextVisitedPractice } from '../../rounds/lessonNavigation';

/** Preview and real training share the same player; only persistence differs. */
export function TrainingPracticePreview({ level, practiceLevels = [1, 2, 3], onContinue, onClose, onStruggle, reviewAt }: {
  level: number; onContinue: () => void; onClose: () => void;
  practiceLevels?: readonly number[];
  onStruggle?: (concept: string) => void; reviewAt?: number;
}) {
  const [viewed, setViewed] = useState(level);
  const clips = getTrainingClipLessons(PREVIEW_LESSON.code);
  const lessonAccess = clips.map(clip => ({ levelId: clip.id, levelNumber: clip.levelNumber, visited: false, completed: false }));
  const practiceIds = practiceLevels.flatMap(number => {
    const clip = clips.find(item => item.levelNumber === number);
    return clip ? [clip.id] : [];
  });
  const access = getRoundPracticeAccess(practiceIds, practiceLevels.indexOf(level), lessonAccess)
    .map(item => ({ ...item, title: clips.find(clip => clip.id === item.levelId)!.steps[0].title }));
  return <TrainingPracticeClip skillCode={PREVIEW_LESSON.code} title={PREVIEW_LESSON.title}
    key={viewed} level={viewed} onContinue={() => viewed === level ? onContinue() : setViewed(nextVisitedPractice(viewed, level, access))} onClose={onClose} reviewAt={reviewAt}
    lessonProgress={reviewAt === undefined ? progress => <LessonProgressBar playbackProgress={progress} items={access} current={viewed} onSelect={setViewed} /> : undefined}
    onHelp={onStruggle ? (_, step) => {
      onStruggle(`level-${viewed}`);
      router.push({ pathname: "/train/help", params: { preview: "doorway", previewLevel: String(viewed), step: String(step), state: "live", reinforcement: "1" } });
    } : undefined} />;
}
