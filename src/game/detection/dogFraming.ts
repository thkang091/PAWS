export type DogDetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RawDogDetection = {
  visible: boolean;
  confidence: number;
  box?: DogDetectionBox;
};

export type DogFramingIssue =
  | "none"
  | "notVisible"
  | "tooFar"
  | "tooClose"
  | "offCenterLeft"
  | "offCenterRight"
  | "offCenterTop"
  | "offCenterBottom";

export type DogFramingStatus = {
  visible: boolean;
  clear: boolean;
  centered: boolean;
  goodDistance: boolean;
  confidencePassed: boolean;
  readyToStart: boolean;
  confidence: number;
  message: string;
  issue: DogFramingIssue;
  box?: DogDetectionBox;
};

export const DOG_FRAMING_THRESHOLDS = {
  // Easy mode: confidence is only informational now.
  minConfidence: 0.05,

  // Easy centered range. Wider than before.
  minCenterX: 0.18,
  maxCenterX: 0.82,
  minCenterY: 0.12,
  maxCenterY: 0.9,

  // Easy distance range. Allow smaller and larger dog boxes.
  minBoxArea: 0.015,
  maxBoxArea: 0.82,
};

const getBoxCenter = (box?: DogDetectionBox) => {
  if (!box) return { x: 0, y: 0 };

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
};

const getBoxArea = (box?: DogDetectionBox) => {
  if (!box) return 0;
  return box.width * box.height;
};

const getFramingIssue = (
  visible: boolean,
  center: { x: number; y: number },
  area: number,
): DogFramingIssue => {
  if (!visible) return "notVisible";

  // Distance first, because if the dog is too small/large,
  // center guidance is often less useful.
  if (area < DOG_FRAMING_THRESHOLDS.minBoxArea) return "tooFar";
  if (area > DOG_FRAMING_THRESHOLDS.maxBoxArea) return "tooClose";

  if (center.x < DOG_FRAMING_THRESHOLDS.minCenterX) return "offCenterLeft";
  if (center.x > DOG_FRAMING_THRESHOLDS.maxCenterX) return "offCenterRight";
  if (center.y < DOG_FRAMING_THRESHOLDS.minCenterY) return "offCenterTop";
  if (center.y > DOG_FRAMING_THRESHOLDS.maxCenterY) return "offCenterBottom";

  return "none";
};

const getMessageForIssue = (issue: DogFramingIssue) => {
  switch (issue) {
    case "notVisible":
      return "Place your dog inside the frame.";
    case "tooFar":
      return "Move closer to your dog.";
    case "tooClose":
      return "Move back a little.";
    case "offCenterLeft":
      return "Move your dog toward the center.";
    case "offCenterRight":
      return "Move your dog toward the center.";
    case "offCenterTop":
      return "Lower the camera a little.";
    case "offCenterBottom":
      return "Raise the camera a little.";
    case "none":
    default:
      return "Great. Hold still...";
  }
};

export const evaluateDogFraming = (
  detection: RawDogDetection,
): DogFramingStatus => {
  const box = detection.box;
  const confidence = detection.confidence;
  const visible = detection.visible && Boolean(box);

  const center = getBoxCenter(box);
  const area = getBoxArea(box);

  const confidencePassed =
    confidence >= DOG_FRAMING_THRESHOLDS.minConfidence;

  const centered =
    visible &&
    center.x >= DOG_FRAMING_THRESHOLDS.minCenterX &&
    center.x <= DOG_FRAMING_THRESHOLDS.maxCenterX &&
    center.y >= DOG_FRAMING_THRESHOLDS.minCenterY &&
    center.y <= DOG_FRAMING_THRESHOLDS.maxCenterY;

  const goodDistance =
    visible &&
    area >= DOG_FRAMING_THRESHOLDS.minBoxArea &&
    area <= DOG_FRAMING_THRESHOLDS.maxBoxArea;

  // Clear is no longer a hard gate in easy mode.
  const clear = visible;

  // Easy mode ready condition:
  // visible + centered + goodDistance only.
  const readyToStart = visible && centered && goodDistance;

  const issue = getFramingIssue(visible, center, area);
  const message = getMessageForIssue(issue);

  return {
    visible,
    clear,
    centered,
    goodDistance,
    confidencePassed,
    readyToStart,
    confidence,
    message,
    issue,
    box,
  };
};

export const createMockDogDetection = (elapsedMs: number): RawDogDetection => {
  if (elapsedMs < 800) {
    return {
      visible: false,
      confidence: 0,
    };
  }

  if (elapsedMs < 1400) {
    return {
      visible: true,
      confidence: 0.42,
      box: {
        x: 0.34,
        y: 0.32,
        width: 0.28,
        height: 0.34,
      },
    };
  }

  if (elapsedMs < 2000) {
    return {
      visible: true,
      confidence: 0.72,
      box: {
        x: 0.08,
        y: 0.32,
        width: 0.28,
        height: 0.34,
      },
    };
  }

  if (elapsedMs < 2600) {
    return {
      visible: true,
      confidence: 0.78,
      box: {
        x: 0.42,
        y: 0.38,
        width: 0.16,
        height: 0.18,
      },
    };
  }

  return {
    visible: true,
    confidence: 0.86,
    box: {
      x: 0.34,
      y: 0.28,
      width: 0.32,
      height: 0.42,
    },
  };
};