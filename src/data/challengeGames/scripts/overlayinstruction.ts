export type ChallengeInstructionStep = {
  id: string;
  label: string;
  helperText: string;
  startMs: number;
  endMs: number;
};

export type ChallengeScript = {
  id: string;
  title: string;
  totalDurationMs: number;
  steps: ChallengeInstructionStep[];
};

/**
 * GAME_CA_001
 * Settle Snapshot
 * Rest in one place for 10 seconds.
 */
export const settleSnapshotScript: ChallengeScript = {
  id: "settle_snapshot",
  title: "Settle Snapshot",
  totalDurationMs: 15000,
  steps: [
    {
      id: "ready",
      label: "Get Ready",
      helperText: "Keep your dog fully visible.",
      startMs: 0,
      endMs: 3000,
    },
    {
      id: "settle",
      label: "Settle",
      helperText: "Let your dog rest in one place.",
      startMs: 3000,
      endMs: 6000,
    },
    {
      id: "hold",
      label: "Hold Still",
      helperText: "Keep your dog in the same area.",
      startMs: 6000,
      endMs: 13000,
    },
    {
      id: "complete",
      label: "Complete",
      helperText: "Nice work.",
      startMs: 13000,
      endMs: 15000,
    },
  ],
};

/**
 * GAME_CA_002
 * Door Step Away
 * Owner steps away briefly while dog stays in place.
 */
export const doorStepAwayScript: ChallengeScript = {
  id: "door_step_away",
  title: "Door Step Away",
  totalDurationMs: 12000,
  steps: [
    {
      id: "ready",
      label: "Get Ready",
      helperText: "Keep your dog and doorway visible.",
      startMs: 0,
      endMs: 3000,
    },
    {
      id: "step_away",
      label: "Step Away",
      helperText: "Take a few steps away.",
      startMs: 3000,
      endMs: 7000,
    },
    {
      id: "wait",
      label: "Wait",
      helperText: "Let your dog stay in place.",
      startMs: 7000,
      endMs: 10000,
    },
    {
      id: "return",
      label: "Return",
      helperText: "Return calmly to your dog.",
      startMs: 10000,
      endMs: 12000,
    },
  ],
};

/**
 * GAME_CA_003
 * Mat Pause
 * Stay on a mat for 15 seconds.
 */
export const matPauseScript: ChallengeScript = {
  id: "mat_pause",
  title: "Mat Pause",
  totalDurationMs: 20000,
  steps: [
    {
      id: "ready",
      label: "Get Ready",
      helperText: "Keep the mat fully visible.",
      startMs: 0,
      endMs: 3000,
    },
    {
      id: "go_to_mat",
      label: "Go to Mat",
      helperText: "Guide your dog onto the mat.",
      startMs: 3000,
      endMs: 7000,
    },
    {
      id: "pause",
      label: "Pause",
      helperText: "Keep your dog on the mat.",
      startMs: 7000,
      endMs: 17000,
    },
    {
      id: "complete",
      label: "Complete",
      helperText: "Nice work.",
      startMs: 17000,
      endMs: 20000,
    },
  ],
};

/**
 * Backward-compatible alias.
 * The first camera demo used the name sitFreezeScript.
 * From now on, that same slot is connected to Settle Snapshot.
 */
export const sitFreezeScript = settleSnapshotScript;