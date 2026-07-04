export type DogDetectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DogGuideBoxRoi = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minBoxOverlapRatio: number;
};

export type RawDogDetection = {
  visible: boolean;
  confidence: number;
  box?: DogDetectionBox;
};

export type DogFramingIssue =
  | "none"
  | "notVisible"
  | "outsideGuideBox"
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
  insideGuideBox: boolean;
  confidencePassed: boolean;
  readyToStart: boolean;
  confidence: number;
  message: string;
  issue: DogFramingIssue;
  box?: DogDetectionBox;
};

export const DOG_FRAMING_THRESHOLDS = {
  // Local AI is only a pre-filter before Gemini.
  // Confidence is informational, not a hard gate.
  minConfidence: 0.04,

  // Easy mode: allow a wide center zone.
  // The goal is not perfect framing, only "dog is reasonably in view."
  minCenterX: 0.1,
  maxCenterX: 0.9,
  minCenterY: 0.14,
  maxCenterY: 0.74,

  // Easy mode: allow both small and large dogs.
  // Only block extreme cases: dog is tiny or fills almost the whole screen.
  minBoxArea: 0.008,
  maxBoxArea: 0.9,
};

export const DEFAULT_DOG_GUIDE_BOX_ROI: DogGuideBoxRoi = {
  // Approximate normalized area of the visible QR guide box.
  // Tune these numbers after testing on the phone.
  // 카메라 인식 조절 값
minX: 0.14,
maxX: 0.86,
minY: 0.12,
maxY: 0.74,
minBoxOverlapRatio: 0.14,
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

const getIntersectionArea = (
  box: DogDetectionBox,
  roi: DogGuideBoxRoi,
) => {
  const boxLeft = box.x;
  const boxRight = box.x + box.width;
  const boxTop = box.y;
  const boxBottom = box.y + box.height;

  const overlapLeft = Math.max(boxLeft, roi.minX);
  const overlapRight = Math.min(boxRight, roi.maxX);
  const overlapTop = Math.max(boxTop, roi.minY);
  const overlapBottom = Math.min(boxBottom, roi.maxY);

  const overlapWidth = Math.max(0, overlapRight - overlapLeft);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);

  return overlapWidth * overlapHeight;
};

const isInsideGuideBox = (
  visible: boolean,
  box: DogDetectionBox | undefined,
  center: { x: number; y: number },
  area: number,
  roi: DogGuideBoxRoi,
) => {
  if (!visible || !box || area <= 0) return false;

  const centerInsideRoi =
    center.x >= roi.minX &&
    center.x <= roi.maxX &&
    center.y >= roi.minY &&
    center.y <= roi.maxY;

  const intersectionArea = getIntersectionArea(box, roi);
  const overlapRatio = intersectionArea / area;

  return centerInsideRoi && overlapRatio >= roi.minBoxOverlapRatio;
};

const getFramingIssue = (
  visible: boolean,
  insideGuideBox: boolean,
  center: { x: number; y: number },
  area: number,
): DogFramingIssue => {
  if (!visible) return "notVisible";
  if (!insideGuideBox) return "outsideGuideBox";

  // Distance guidance first. If the dog is too small or too large,
  // center guidance is less useful.
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
  guideBoxRoi: DogGuideBoxRoi = DEFAULT_DOG_GUIDE_BOX_ROI,
): DogFramingStatus => {
  const box = detection.box;
  const confidence = detection.confidence;

  const hasValidBox =
    Boolean(box) &&
    (box?.width ?? 0) > 0.002 &&
    (box?.height ?? 0) > 0.002;

  const visible = detection.visible && hasValidBox;

  const center = getBoxCenter(box);
  const area = getBoxArea(box);

  const insideGuideBox = isInsideGuideBox(
  visible,
  box,
  center,
  area,
  guideBoxRoi,
);

  const confidencePassed =
    confidence >= DOG_FRAMING_THRESHOLDS.minConfidence;

  const centered =
  visible &&
  insideGuideBox &&
  center.x >= DOG_FRAMING_THRESHOLDS.minCenterX &&
  center.x <= DOG_FRAMING_THRESHOLDS.maxCenterX &&
  center.y >= DOG_FRAMING_THRESHOLDS.minCenterY &&
  center.y <= DOG_FRAMING_THRESHOLDS.maxCenterY;

  const goodDistance =
    visible &&
    area >= DOG_FRAMING_THRESHOLDS.minBoxArea &&
    area <= DOG_FRAMING_THRESHOLDS.maxBoxArea;

  // Clear is only informational now.
  // The local gate is not judging training quality.
  const clear = visible;

  // Local pre-filter condition:
  // Start recording only when the dog is visible, roughly centered,
  // and not extremely too far/too close.
  const readyToStart = visible && insideGuideBox && goodDistance;

  const issue = getFramingIssue(visible, insideGuideBox, center, area);
  const message = getMessageForIssue(issue);

  return {
  visible,
  clear,
  centered,
  goodDistance,
  insideGuideBox,
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
        x: 0.02,
        y: 0.32,
        width: 0.22,
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
        width: 0.08,
        height: 0.1,
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