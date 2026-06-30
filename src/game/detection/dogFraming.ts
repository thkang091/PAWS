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

export type DogFramingStatus = {
  visible: boolean;
  clear: boolean;
  centered: boolean;
  goodDistance: boolean;
  confidencePassed: boolean;
  readyToStart: boolean;
  confidence: number;
  message: string;
  box?: DogDetectionBox;
};

export const DOG_FRAMING_THRESHOLDS = {
  minConfidence: 0.6,
  minCenterX: 0.3,
  maxCenterX: 0.7,
  minCenterY: 0.22,
  maxCenterY: 0.8,
  minBoxArea: 0.08,
  maxBoxArea: 0.55,
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

  const clear = visible && confidencePassed;

  const readyToStart =
    visible && clear && centered && goodDistance && confidencePassed;

  let message = "Place your dog inside the frame.";

  if (!visible) {
    message = "Place your dog inside the frame.";
  } else if (!confidencePassed) {
    message = "Make sure your dog is clearly visible.";
  } else if (!centered) {
    message = "Move your dog toward the center.";
  } else if (!goodDistance) {
    message =
      area < DOG_FRAMING_THRESHOLDS.minBoxArea
        ? "Move your dog closer."
        : "Move your dog back a little.";
  } else {
    message = "Great. Hold still...";
  }

  return {
    visible,
    clear,
    centered,
    goodDistance,
    confidencePassed,
    readyToStart,
    confidence,
    message,
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