/** Coordinates are relative to the visible preview, with a top-left origin. */
export type SoloFramingBox = { x: number; y: number; width: number; height: number };
export type SoloFramingObservation = {
  state: "searching" | "tracking" | "lost" | "unavailable";
  box?: SoloFramingBox;
  confidence: number;
  /** Monotonic receipt time, in milliseconds. */
  timestampMs: number;
};
export type SoloFramingStatus = "good" | "adjust" | "unknown";
export type SoloFramingSnapshot = {
  phase: "centering" | "tracking" | "lost" | "unavailable";
  box?: SoloFramingBox;
  hint: string | null;
  distance: SoloFramingStatus;
  visibility: "good" | "unknown";
  position: SoloFramingStatus;
};

const ISSUE_HOLD_MS = 900;
const LOST_GRACE_MS = 550;
const MAX_OBSERVATION_AGE_MS = 1000;
const GOOD_NOTICE_MS = 1500;
const CENTER_HINT = "Bring your dog to the center";
type Issue = "closer" | "back" | "up" | "down" | "center";
const HINTS: Record<Issue, string> = {
  closer: "Move a little closer",
  back: "Move your phone back a little",
  up: "Tilt your phone up a little",
  down: "Tilt your phone down a little",
  center: "Keep your dog near the center",
};

const initialSnapshot = (): SoloFramingSnapshot => ({
  phase: "centering", hint: CENTER_HINT, distance: "unknown", visibility: "unknown", position: "unknown",
});

function usableBox(box: SoloFramingBox | undefined): box is SoloFramingBox {
  if (!box) return false;
  const { x, y, width, height } = box;
  return [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0 &&
    width <= 4 && height <= 4 && x < 1 && y < 1 && x + width > 0 && y + height > 0;
}

function assess(box: SoloFramingBox): { issue: Issue | null; distance: "good" | "adjust"; position: "good" | "adjust" } {
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  // A broad comfortable region is intentional: these are framing hints, not
  // pose/feet checks or a qualification rule for starting a round.
  const clippedLeft = box.x < -0.035;
  const clippedRight = right > 1.035;
  const clippedTop = box.y < -0.035;
  const clippedBottom = bottom > 1.035;
  const clipped = clippedLeft || clippedRight || clippedTop || clippedBottom;
  const offCenter = centerX < 0.20 || centerX > 0.80 || centerY < 0.18 || centerY > 0.82;
  const longestSide = Math.max(box.width, box.height);
  const area = box.width * box.height;
  const tooSmall = longestSide < 0.20 || area < 0.025;
  const tooLarge = longestSide > 0.92 || area > 0.60;
  let issue: Issue | null = null;
  if (clipped) {
    if (tooLarge || (clippedLeft && clippedRight) || (clippedTop && clippedBottom)) issue = "back";
    else if (clippedTop) issue = "up";
    else if (clippedBottom) issue = "down";
    else issue = "center";
  } else if (tooLarge) issue = "back";
  else if (tooSmall) issue = "closer";
  else if (offCenter) issue = "center";
  return { issue, distance: tooSmall || tooLarge ? "adjust" : "good", position: clipped || offCenter ? "adjust" : "good" };
}

type StableMetric = { value: SoloFramingStatus; candidate: "good" | "adjust" | null; since: number };
const emptyMetric = (): StableMetric => ({ value: "unknown", candidate: null, since: 0 });
function settleMetric(metric: StableMetric, desired: "good" | "adjust", nowMs: number): SoloFramingStatus {
  if (metric.candidate !== desired) {
    metric.candidate = desired;
    metric.since = nowMs;
  }
  if ((metric.value === "unknown" && desired === "good") || nowMs - metric.since >= ISSUE_HOLD_MS) metric.value = desired;
  return metric.value;
}

/** Advisory only. No output from this controller should disable Start round. */
export function createSoloFramingGuide() {
  let snapshot = initialSnapshot();
  let everTracked = false;
  let lastSeenAt = -Infinity;
  let lastTimestamp = -Infinity;
  let lastBox: SoloFramingBox | undefined;
  let candidateIssue: Issue | null = null;
  let issueSince = 0;
  let settledIssue: Issue | null = null;
  let goodNoticeSince: number | null = null;
  let distance = emptyMetric();
  let position = emptyMetric();

  const clearFeedback = () => {
    candidateIssue = null;
    settledIssue = null;
    issueSince = 0;
    goodNoticeSince = null;
    distance = emptyMetric();
    position = emptyMetric();
  };
  const reset = () => {
    everTracked = false;
    lastSeenAt = -Infinity;
    lastTimestamp = -Infinity;
    lastBox = undefined;
    clearFeedback();
    snapshot = initialSnapshot();
    return snapshot;
  };
  const update = (observation: SoloFramingObservation, nowMs = performance.now()): SoloFramingSnapshot => {
    if (!Number.isFinite(nowMs)) return snapshot;
    // Results from the previous frame must not move a current box backwards.
    if (Number.isFinite(observation.timestampMs) && observation.timestampMs < lastTimestamp) return snapshot;
    if (Number.isFinite(observation.timestampMs)) lastTimestamp = observation.timestampMs;

    if (observation.state === "unavailable") {
      lastBox = undefined;
      clearFeedback();
      snapshot = { ...initialSnapshot(), phase: "unavailable" };
      return snapshot;
    }

    const age = nowMs - observation.timestampMs;
    const fresh = Number.isFinite(age) && age >= 0 && age <= MAX_OBSERVATION_AGE_MS;
    const valid = observation.state === "tracking" && fresh && usableBox(observation.box) &&
      Number.isFinite(observation.confidence) && observation.confidence >= 0.25 && observation.confidence <= 1;
    if (!valid) {
      const withinGrace = everTracked && nowMs - lastSeenAt <= LOST_GRACE_MS;
      if (!withinGrace) clearFeedback();
      snapshot = {
        phase: !everTracked ? "centering" : withinGrace ? "tracking" : "lost",
        box: withinGrace ? lastBox : undefined,
        hint: !everTracked ? CENTER_HINT : withinGrace ? null : "Bring your dog back into view",
        distance: "unknown", visibility: "unknown", position: "unknown",
      };
      return snapshot;
    }

    const box = observation.box!;
    const acquiring = !everTracked || snapshot.phase === "lost" || snapshot.phase === "unavailable";
    everTracked = true;
    lastSeenAt = nowMs;
    lastBox = { ...box };
    const assessment = assess(box);
    if (acquiring) {
      clearFeedback();
      candidateIssue = assessment.issue;
      issueSince = nowMs;
      if (assessment.issue === null) goodNoticeSince = nowMs;
    } else if (candidateIssue !== assessment.issue) {
      candidateIssue = assessment.issue;
      issueSince = nowMs;
    }

    if (nowMs - issueSince >= ISSUE_HOLD_MS && settledIssue !== candidateIssue) {
      const hadIssue = settledIssue !== null;
      settledIssue = candidateIssue;
      if (candidateIssue === null && hadIssue) goodNoticeSince = nowMs;
      else if (candidateIssue !== null) goodNoticeSince = null;
    }
    // Hide old advice as soon as the situation changes instead of briefly
    // telling the user to move closer while the subject has already grown.
    const hint = assessment.issue !== null
      ? settledIssue === assessment.issue ? HINTS[assessment.issue] : null
      : settledIssue === null && goodNoticeSince !== null && nowMs - goodNoticeSince < GOOD_NOTICE_MS ? "Looks good" : null;
    snapshot = {
      phase: "tracking", box: lastBox, hint,
      distance: settleMetric(distance, assessment.distance, nowMs),
      visibility: "good",
      position: settleMetric(position, assessment.position, nowMs),
    };
    return snapshot;
  };
  return { update, reset, getSnapshot: () => snapshot };
}
