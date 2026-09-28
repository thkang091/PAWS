import { useCallback, useEffect, useRef, useState } from "react";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";

import type { VoiceClip } from "@/services/trainerChat";

export const LEVELS = 28;
const LIMIT_MS = 60000;
const MIN_MS = 600;
const SPEECH_FLOOR_DB = -42;

export type VoiceState = "idle" | "recording" | "denied";

const level = (metering: number | undefined) =>
  metering === undefined ? 0.05 : Math.max(0.05, Math.min(1, (metering + 55) / 50));

export const useVoiceNote = (onLimit: () => void) => {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const status = useAudioRecorderState(recorder, 70);
  const [state, setState] = useState<VoiceState>("idle");
  const [levels, setLevels] = useState<number[]>(() => Array(LEVELS).fill(0.05));
  const limitFired = useRef(false);
  const peak = useRef<number | null>(null);
  const onLimitRef = useRef(onLimit);
  onLimitRef.current = onLimit;

  useEffect(() => {
    if (!status.isRecording) return;
    setLevels((current) => [...current.slice(1), level(status.metering)]);
    if (typeof status.metering === "number") {
      peak.current = peak.current === null ? status.metering : Math.max(peak.current, status.metering);
    }
    if (status.durationMillis >= LIMIT_MS && !limitFired.current) {
      limitFired.current = true;
      onLimitRef.current();
    }
  }, [status.durationMillis, status.isRecording, status.metering]);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setState("denied");
      return false;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    limitFired.current = false;
    peak.current = null;
    setLevels(Array(LEVELS).fill(0.05));
    setState("recording");
    return true;
  }, [recorder]);

  const release = async () => {
    setState("idle");
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  };

  const finish = useCallback(async (): Promise<VoiceClip | "short" | "quiet"> => {
    const durationMs = recorder.getStatus().durationMillis;
    await recorder.stop();
    await release();
    const uri = recorder.uri;
    if (!uri || durationMs < MIN_MS) return "short";
    if (peak.current !== null && peak.current < SPEECH_FLOOR_DB) return "quiet";
    const base64 = await new File(uri).base64();
    return { base64, mimeType: "audio/mp4", durationMs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder]);

  const cancel = useCallback(async () => {
    if (recorder.getStatus().isRecording) await recorder.stop();
    await release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder]);

  return {
    state,
    levels,
    durationMs: status.durationMillis,
    start,
    finish,
    cancel,
    clearDenied: () => setState("idle"),
  };
};
