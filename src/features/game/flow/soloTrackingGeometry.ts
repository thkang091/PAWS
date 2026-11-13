import type { SoloFramingBox, SoloFramingObservation } from "./soloFramingGuide";

export type SoloNativeTrackingEvent = {
  state: "searching" | "tracking" | "lost" | "unavailable";
  /** Normalized top-left coordinates, already oriented and mirrored for preview. */
  box?: SoloFramingBox;
  confidence: number;
  frameWidth: number;
  frameHeight: number;
};

type Viewport = { width: number; height: number };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => isFiniteNumber(value) && value > 0;

/** Maps the actual camera image into the centered aspect-fill preview viewport. */
export function projectSoloTrackingEvent(
  event: unknown,
  viewport: Viewport,
  receivedAtMs: number,
): SoloFramingObservation | null {
  if (!isRecord(event) || !isFiniteNumber(receivedAtMs) || receivedAtMs < 0) return null;
  const payload = "nativeEvent" in event ? event.nativeEvent : event;
  if (!isRecord(payload)) return null;
  const state = payload.state;
  if (state !== "searching" && state !== "tracking" && state !== "lost" && state !== "unavailable") return null;
  const lost = (): SoloFramingObservation => ({ state: "lost", confidence: 0, timestampMs: receivedAtMs });
  if (state !== "tracking") return { state, confidence: 0, timestampMs: receivedAtMs };

  const { frameWidth, frameHeight, confidence, box } = payload;
  if (!positive(frameWidth) || !positive(frameHeight) ||
    !positive(viewport.width) || !positive(viewport.height) ||
    !isFiniteNumber(confidence) || confidence < 0 || confidence > 1 || !isRecord(box)) return lost();
  const { x, y, width, height } = box;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !positive(width) || !positive(height)) return lost();

  const scale = Math.max(viewport.width / frameWidth, viewport.height / frameHeight);
  const imageWidth = frameWidth * scale;
  const imageHeight = frameHeight * scale;
  const cropX = (imageWidth - viewport.width) / 2;
  const cropY = (imageHeight - viewport.height) / 2;
  const projected: SoloFramingBox = {
    x: (x * imageWidth - cropX) / viewport.width,
    y: (y * imageHeight - cropY) / viewport.height,
    width: width * imageWidth / viewport.width,
    height: height * imageHeight / viewport.height,
  };
  if (!Object.values(projected).every(Number.isFinite) || projected.width <= 0 || projected.height <= 0) return lost();
  // Do not clamp: an edge outside the visible viewport is useful framing input.
  // Native has already handled camera orientation and front-camera mirroring.
  return { state: "tracking", box: projected, confidence, timestampMs: receivedAtMs };
}
