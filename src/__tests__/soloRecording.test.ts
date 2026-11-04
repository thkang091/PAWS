jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///paws/cache/",
  deleteAsync: jest.fn().mockResolvedValue(undefined),
}));

import { deleteAsync } from "expo-file-system/legacy";
import { deleteSoloVideo, discardSoloRecording, getSoloRecording, saveSoloRecording } from "../features/game/flow/soloRecording";

const clip = (name = "round.mov") => ({
  uri: `file:///paws/cache/Camera/${name}`,
  gameId: "longest-sit" as const,
  target: "mat",
  durationSeconds: 8,
});

beforeEach(() => jest.clearAllMocks());

test("a review ID retrieves only the current recorded clip", () => {
  const recording = saveSoloRecording(clip());
  expect(getSoloRecording(recording.id)).toEqual(recording);
  expect(getSoloRecording(undefined)).toBeNull();
  expect(getSoloRecording(recording.uri)).toBeNull();
  expect(getSoloRecording("expired-id")).toBeNull();
  discardSoloRecording(recording.id);
  expect(getSoloRecording(recording.id)).toBeNull();
});

test("replacing a take removes its cached file without letting stale cleanup delete the new take", () => {
  const first = saveSoloRecording(clip("first.mov"));
  const second = saveSoloRecording(clip("second.mp4"));
  expect(second.id).not.toBe(first.id);
  expect(getSoloRecording(first.id)).toBeNull();
  expect(deleteAsync).toHaveBeenCalledWith(first.uri, { idempotent: true });
  jest.mocked(deleteAsync).mockClear();
  discardSoloRecording(first.id);
  expect(getSoloRecording(second.id)).toEqual(second);
  expect(deleteAsync).not.toHaveBeenCalled();
  discardSoloRecording(second.id);
  expect(deleteAsync).toHaveBeenCalledWith(second.uri, { idempotent: true });
});

test.each([0, -1, NaN, Infinity])("invalid duration %s never replaces a usable recording", durationSeconds => {
  const recording = saveSoloRecording(clip());
  expect(() => saveSoloRecording({ ...clip("invalid.mov"), durationSeconds })).toThrow();
  expect(getSoloRecording(recording.id)).toEqual(recording);
  discardSoloRecording(recording.id);
});

test.each([
  "https://example.com/paws/cache/Camera/round.mov",
  "file:///paws/documents/round.mov",
  "file:///paws/cache/Camera/../../documents/round.mov",
  "file:///paws/cache/Camera/%2e%2e%2felsewhere.mov",
  "file:///paws/cache/CameraExtra/round.mov",
  "file:///paws/cache/Camera/",
  "file:///paws/cache/Camera/other.txt",
  "file:///paws/cache/Camera/round.mov?token=example",
  "not-a-uri",
])("cleanup ignores paths outside camera video files: %s", uri => {
  deleteSoloVideo(uri);
  expect(deleteAsync).not.toHaveBeenCalled();
});

test("cleanup accepts Expo Camera MOV and MP4 files and ignores a failed deletion", async () => {
  jest.mocked(deleteAsync).mockRejectedValueOnce(new Error("Already evicted"));
  expect(() => deleteSoloVideo(clip().uri)).not.toThrow();
  deleteSoloVideo(clip("android.mp4").uri);
  await Promise.resolve();
  expect(deleteAsync).toHaveBeenCalledTimes(2);
});
