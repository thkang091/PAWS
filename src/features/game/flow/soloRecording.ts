import { cacheDirectory, deleteAsync } from "expo-file-system/legacy";
import type { PlayGameId } from "./gameFlow";

export type SoloRecording = {
  id: string;
  uri: string;
  gameId: PlayGameId;
  target: string;
  durationSeconds: number;
};

let currentRecording: SoloRecording | null = null;
let sequence = 0;

// Only files created by Expo Camera in this app's cache may be removed here.
// Route parameters never become file paths; review screens look up an opaque ID.
export function deleteSoloVideo(uri: string): void {
  if (!cacheDirectory) return;
  try {
    const video = new URL(uri);
    const cameraDirectory = new URL("Camera/", cacheDirectory);
    const pathname = decodeURIComponent(video.pathname);
    const directory = decodeURIComponent(cameraDirectory.pathname);
    const filename = pathname.slice(directory.length);
    if (video.protocol !== "file:" || video.host !== cameraDirectory.host ||
      video.search || video.hash || !pathname.startsWith(directory) ||
      !/^[^/\\]+\.(mov|mp4)$/i.test(filename)) return;
    void deleteAsync(uri, { idempotent: true }).catch(() => {
      // Cache eviction is best effort; the operating system can reclaim it later.
    });
  } catch {
    // Ignore malformed URIs and cache cleanup failures.
  }
}

export function saveSoloRecording(input: Omit<SoloRecording, "id">): SoloRecording {
  if (!input.uri || !Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new Error("The recording could not be saved for review.");
  }
  const previous = currentRecording;
  const recording = { ...input, id: `solo-${Date.now().toString(36)}-${++sequence}` };
  currentRecording = recording;
  if (previous && previous.uri !== recording.uri) deleteSoloVideo(previous.uri);
  return recording;
}

export function getSoloRecording(id: string | undefined): SoloRecording | null {
  return id && currentRecording?.id === id ? currentRecording : null;
}

export function discardSoloRecording(id: string): void {
  if (currentRecording?.id !== id) return;
  const recording = currentRecording;
  currentRecording = null;
  deleteSoloVideo(recording.uri);
}
