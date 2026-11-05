export type PlayGameId = "longest-sit" | "trick-combo" | "spot-sprint" | "red-light-green-light" | "paws-says";
export type PlayMode = "solo" | "duel" | "tournament";
export type PlayLocation = "together" | "remote";

// Keep the planned group flow behind one entry gate while Solo and Duel are reviewed.
export const TOURNAMENT_ENABLED = false;

// Solo capture windows exclude the three-second setup countdown.
const SOLO_TIME_LIMITS = { "longest-sit": 20, "trick-combo": 12, "spot-sprint": 8, "red-light-green-light": 15 } as const;
export function soloTimeLimitSeconds(gameId: PlayGameId): number {
  return gameId === "paws-says" ? PREVIEW_MAX_SECONDS : SOLO_TIME_LIMITS[gameId];
}

export type PlayGame = {
  id: PlayGameId;
  title: string;
  subtitle: string;
  description: string;
  measure: string;
  duration: string;
  steps: readonly string[];
  equipment: string;
  cues: readonly string[];
  sampleScore: string;
  scoreLabel: string;
};

// Presentation copy and example rules only. No entry fees, rewards, or records
// are written by this flow. Final scoring belongs to the video-review service.
export const PLAY_GAMES: readonly PlayGame[] = [
  {
    id: "longest-sit", title: "Longest Sit", subtitle: "Hold a sit",
    description: "Hold a sitting position for as long as possible.",
    measure: "Longest hold", duration: `${SOLO_TIME_LIMITS["longest-sit"]}-second challenge`,
    steps: ["Frame your dog's whole body. You have 3 seconds to get ready.", "At Go, give the sit cue and hold the position within the time limit.", "End when your dog gets up, or let time run out. Review, then submit."],
    equipment: "A quiet spot and somewhere to prop your phone.",
    cues: ["Sit & stay"], sampleScore: "00:14.2", scoreLabel: "Time sitting",
  },
  {
    id: "trick-combo", title: "Random Trick Combo", subtitle: "Complete the sequence",
    description: "Complete three familiar tricks in the shortest time.",
    measure: "Fastest combo", duration: `${SOLO_TIME_LIMITS["trick-combo"]}-second challenge`,
    steps: ["Use the 3-second countdown to get ready.", "At Go, complete all three commands in order within the time limit.", "End after the last trick. Review your round, then submit."],
    equipment: "A little floor space and tricks your pup already knows.",
    cues: ["Sit", "Paw", "Spin"], sampleScore: "00:08.4", scoreLabel: "Combo time",
  },
  {
    id: "spot-sprint", title: "Spot Sprint", subtitle: "Reach the target and sit",
    description: "Reach the target and sit as quickly as possible.",
    measure: "Fastest sit", duration: `${SOLO_TIME_LIMITS["spot-sprint"]}-second challenge`,
    steps: ["Choose a mat or stable, low platform. Keep the start and target in frame.", "Use the 3-second countdown to get ready. At Go, cue your dog to the target.", "Reach the target and sit within the time limit. Review, then submit."],
    equipment: "A familiar mat or stable, suitable platform.",
    cues: ["To your spot!"], sampleScore: "00:03.6", scoreLabel: "Time to sit",
  },
  {
    id: "red-light-green-light", title: "Red Light, Green Light", subtitle: "Stop and go",
    description: "Come closer on green, stop on red, and reach the finish.",
    measure: "Stop & go", duration: `${SOLO_TIME_LIMITS["red-light-green-light"]}-second challenge`,
    steps: ["Choose a short, clear route to a finish spot beside you. Keep the route in frame.", "On green, call your dog closer. On red, ask them to stop. Follow the changing light.", "Reach the finish on green, then end the round. You have 15 seconds."],
    equipment: "A clear path, a marked finish spot, and familiar come and stay cues.",
    cues: ["Green light: Come closer", "Red light: Stop"], sampleScore: "00:11.4", scoreLabel: "Time to finish",
  },
  {
    id: "paws-says", title: "PAWS Says", subtitle: "Follow the commands",
    description: "Follow the same cues. Most completed commands wins.",
    measure: "Most completed", duration: "5 commands",
    steps: ["Both players get the same command sequence.", "Try each command before the next one appears.", "Keep the camera rolling. AI counts completed commands after the round."],
    equipment: "Two pups, two phones, and a little room to play.",
    cues: ["Sit", "Paw", "Stand", "Spin", "Sit"], sampleScore: "4 / 5", scoreLabel: "Commands completed",
  },
];

export const SOLO_GAMES = PLAY_GAMES.filter(game => game.id !== "paws-says");
export const PREVIEW_CUE_SECONDS = 8;
export const PREVIEW_MAX_SECONDS = 120;

export function findPlayGame(id?: string): PlayGame | undefined {
  return PLAY_GAMES.find(game => game.id === id);
}

export function parsePlayMode(value?: string): PlayMode {
  return value === "duel" || value === "tournament" ? value : "solo";
}

export function parsePlayLocation(value?: string): PlayLocation {
  return value === "remote" ? "remote" : "together";
}

export function gameForMode(mode: PlayMode, id?: string): PlayGame | undefined {
  if (mode === "duel") return findPlayGame("paws-says");
  if (mode === "tournament") return findPlayGame("spot-sprint");
  const game = findPlayGame(id);
  return game?.id === "paws-says" ? undefined : game;
}

export function parsePreviewDuration(value?: string): number | null {
  if (!value || !/^\d+(\.\d+)?$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= PREVIEW_MAX_SECONDS ? seconds : null;
}

export function formatGameTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return String(Math.floor(safe / 60)).padStart(2, "0") + ":" + String(safe % 60).padStart(2, "0");
}

export const modeLabel = (mode: PlayMode) => mode === "solo" ? "Solo" : mode === "duel" ? "Duel" : "Tournament";
export const modeHome = (mode: PlayMode) => mode === "solo" ? "/game/challenge" : mode === "duel" ? "/game/duel" : "/game/tournament";
