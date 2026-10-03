import { router } from "expo-router";
import { TrainingPracticeClip } from "./TrainingPracticeClip";
import { PREVIEW_LESSON } from "./previewData";

/** Preview and real training share the same player; only persistence differs. */
export function TrainingPracticePreview({ level, onContinue, onClose, onStruggle, reviewAt }: {
  level: number; onContinue: () => void; onClose: () => void;
  onStruggle?: (concept: string) => void; reviewAt?: number;
}) {
  return <TrainingPracticeClip skillCode={PREVIEW_LESSON.code} title={PREVIEW_LESSON.title}
    level={level} onContinue={onContinue} onClose={onClose} reviewAt={reviewAt}
    onHelp={onStruggle ? (_, step) => {
      onStruggle(`level-${level}`);
      router.push({ pathname: "/train/help", params: { preview: "doorway", previewLevel: String(level), step: String(step), state: "live" } });
    } : undefined} />;
}
