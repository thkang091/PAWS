import type { WelcomeSceneKey } from "@/features/welcome/components/welcomeScenePaths";

export type WelcomePanel = {
  scene: WelcomeSceneKey;
  headline: readonly string[];
  body: string;
  note: readonly string[];
  noteTilt: number;
  noteAt: { x: number; y: number };
  sceneWidth: number;
  sceneShift: number;
};

export const welcomePanels: readonly WelcomePanel[] = [
  {
    scene: "playful",
    headline: ["Build a better", "routine together"],
    body: "Training, care, and daily guidance tailored to your dog.",
    note: ["GOOD", "THINGS", "AHEAD"],
    noteTilt: -8,
    noteAt: { x: 0.06, y: 0.3 },
    sceneWidth: 0.98,
    sceneShift: 34,
  },
  {
    scene: "better",
    headline: ["Meet your", "routine partner"],
    body: "Personalized training, care, and daily guidance for a happier, healthier life together.",
    note: ["Better days", "together"],
    noteTilt: 7,
    noteAt: { x: 0.7, y: 0.14 },
    sceneWidth: 0.8,
    sceneShift: 22,
  },
  {
    scene: "cozy",
    headline: ["Support for", "every walk"],
    body: "Guidance, tools, and tips for you and your dog, every step of the way.",
    note: ["Better walks", "together"],
    noteTilt: -6,
    noteAt: { x: 0.68, y: 0.22 },
    sceneWidth: 0.72,
    sceneShift: 22,
  },
];
