import { useEffect, useRef } from "react";
import { TrainingClipVideo } from "../TrainingClipVideo";
import { getTrainingClipAssets } from "@/features/train/media/trainingClipAssets";
import { getTrainingClipLessons } from "@/features/train/media/trainingClipLessons";
import { useTrainingClipPlayback } from "@/hooks/useTrainingClipPlayback";
import { TrainingClipScreen } from "../TrainingClipScreen";
import { prepareTrainingClip } from "@/features/train/media/prepareTrainingClip";
import { YouTubeTrainingClip } from "../YouTubeTrainingClip";
import { getTrainingYouTubeSegment } from "../../media/trainingYouTube";

export function TrainingPracticeClip(props: Parameters<typeof NativeTrainingPracticeClip>[0]) {
  if (getTrainingYouTubeSegment(props.skillCode, props.level)) return <YouTubeTrainingClip {...props} />;
  return <NativeTrainingPracticeClip {...props} />;
}

function NativeTrainingPracticeClip({ skillCode, title, sessionId, level, onContinue, onClose, onHelp, reviewAt, busy = false, error, continueLabel, allowSkip = false }: {
  skillCode: string; title: string; sessionId?: string;
  level: number; onContinue: () => void; onClose: () => void;
  onHelp?: (at: number, step: number) => void; reviewAt?: number;
  busy?: boolean; error?: string | null; continueLabel?: string; allowSkip?: boolean;
}) {
  const lesson = getTrainingClipLessons(skillCode).find(item => item.levelNumber === level)!;
  const assets = getTrainingClipAssets(skillCode, level)!;
  const playback = useTrainingClipPlayback(lesson, assets.source, true, sessionId);
  const nextSource = getTrainingClipAssets(skillCode, level + 1)?.source;
  useEffect(() => {
    if (!playback.loading && !playback.error && nextSource && reviewAt === undefined) void prepareTrainingClip(nextSource).catch(() => {});
  }, [playback.loading, playback.error, nextSource, reviewAt]);
  const sought = useRef(false);
  useEffect(() => {
    if (reviewAt !== undefined && !playback.loading && !sought.current) {
      sought.current = true;
      playback.seek(reviewAt);
    }
  }, [reviewAt, playback.loading, playback.seek]);
  const leave = (action: () => void) => { playback.pause(); action(); };
  const openCoach = () => {
    if (busy) return;
    playback.pause();
    onHelp?.(playback.time, playback.currentCue?.stepIndex ?? 0);
  };
  return <TrainingClipScreen title={title} lesson={lesson} playback={playback}
    video={<TrainingClipVideo playback={playback} poster={assets.poster} />}
    onClose={() => leave(onClose)} onContinue={() => leave(onContinue)} onReplay={playback.playWhole}
    onHelp={onHelp ? openCoach : undefined} busy={busy} error={error}
    continueLabel={continueLabel ?? (reviewAt !== undefined ? "Back to question" : "Continue")}
    continueDisabled={!allowSkip && reviewAt === undefined && !playback.hasCompleted} />;
}
