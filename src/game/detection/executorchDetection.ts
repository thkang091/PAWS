import type { RawDogDetection } from "./dogFraming";

type FlexibleBbox = {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
};

export type ExecuTorchDetectionLike = {
  label?: string;
  score?: number;
  confidence?: number;
  bbox?: FlexibleBbox;
};

const clamp01 = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
};

const readScore = (detection: ExecuTorchDetectionLike) => {
  return detection.score ?? detection.confidence ?? 0;
};

export const isDogDetection = (detection: ExecuTorchDetectionLike) => {
  const label = String(detection.label ?? "").toLowerCase().trim();
  return label === "dog";
};

export const pickBestDogDetection = <T extends ExecuTorchDetectionLike>(
  detections: readonly T[],
) => {
  return (
    detections
      .filter(isDogDetection)
      .sort((a, b) => readScore(b) - readScore(a))[0] ?? null
  );
};

const getBboxCoordinates = (bbox: FlexibleBbox) => {
  const x1 = bbox.x1 ?? bbox.left ?? bbox.x ?? 0;
  const y1 = bbox.y1 ?? bbox.top ?? bbox.y ?? 0;

  const x2 =
    bbox.x2 ??
    bbox.right ??
    (bbox.x !== undefined && bbox.width !== undefined
      ? bbox.x + bbox.width
      : 0);

  const y2 =
    bbox.y2 ??
    bbox.bottom ??
    (bbox.y !== undefined && bbox.height !== undefined
      ? bbox.y + bbox.height
      : 0);

  return {
    x1: Math.min(x1, x2),
    y1: Math.min(y1, y2),
    x2: Math.max(x1, x2),
    y2: Math.max(y1, y2),
  };
};

export const convertDetectionToRawDogDetection = (
  detection: ExecuTorchDetectionLike | null,
  frameWidth: number,
  frameHeight: number,
): RawDogDetection => {
  if (!detection?.bbox) {
    return {
      visible: false,
      confidence: 0,
    };
  }

  const confidence = readScore(detection);

  if (frameWidth <= 0 || frameHeight <= 0) {
    return {
      visible: false,
      confidence,
    };
  }

  const { x1, y1, x2, y2 } = getBboxCoordinates(detection.bbox);

  const maxCoord = Math.max(x1, y1, x2, y2);

  const normalized =
    maxCoord <= 1.5
      ? { x1, y1, x2, y2 }
      : {
          x1: x1 / frameWidth,
          y1: y1 / frameHeight,
          x2: x2 / frameWidth,
          y2: y2 / frameHeight,
        };

  return {
    visible: true,
    confidence,
    box: {
      x: clamp01(normalized.x1),
      y: clamp01(normalized.y1),
      width: clamp01(normalized.x2 - normalized.x1),
      height: clamp01(normalized.y2 - normalized.y1),
    },
  };
};