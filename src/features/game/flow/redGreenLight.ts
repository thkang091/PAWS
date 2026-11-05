export type RedGreenLight = "green" | "red";

// Read the recording clock rather than starting a second timer. Missed renders
// still catch up to the correct light, and a retake starts on green at zero.
export function redGreenLightAt(elapsedSeconds: number): RedGreenLight {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  return elapsed % 5 < 3 ? "green" : "red";
}
