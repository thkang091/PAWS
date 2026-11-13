import type { TournamentGame, TournamentMode } from "@/services/tournamentService";

export type CatalogGame = {
  key: TournamentGame;
  mode: TournamentMode;
  title: string;
  line: string;
  category: string;
  /** Playable in this release. Everything else shows as Coming soon. */
  playable: boolean;
  route?: string;
  /** Nearby games only: how many can play, shown on the hub card. */
  players?: string;
  /** Nearby games only: the hub card's button. */
  cta?: string;
};

/** Every tournament game, in the order the hub lists them. */
export const TOURNAMENT_GAMES: readonly CatalogGame[] = [
  { key: "largest_country", mode: "online", title: "Make the Largest Country", line: "Walk a loop. The biggest territory wins.", category: "Walk", playable: true, route: "/game/tournament/largest-country" },
  { key: "photo_pose", mode: "online", title: "Photo Pose Challenge", line: "Match this week's pose with your dog.", category: "Photo", playable: true, route: "/game/tournament/photo-pose" },
  { key: "dog_reels", mode: "online", title: "Dog Reels Battle", line: "Film 15 seconds of your dog. Most votes wins.", category: "Video", playable: true, route: "/game/tournament/reels" },
  { key: "number_trail", mode: "nearby", title: "Number Trail", line: "Walk a number on real streets.", category: "Walk", playable: true, route: "/game/tournament?mode=nearby", players: "2 to 10 players", cta: "Play nearby" },
  { key: "find_mafia", mode: "nearby", title: "Find the Mafia", line: "One walker has a secret route. Find them.", category: "Party", playable: true, route: "/game/tournament?mode=nearby", players: "4 to 10 players", cta: "Play nearby" },
  { key: "steal_territory", mode: "nearby", title: "Steal Your Territory", line: "Claim the streets around you before others do.", category: "Walk", playable: true, route: "/game/tournament?mode=nearby", players: "2 to 10 players", cta: "Play nearby" },
  { key: "steal_road", mode: "nearby", title: "Steal Your Road", line: "Walk a road end to end to make it yours.", category: "Walk", playable: true, route: "/game/tournament?mode=nearby", players: "2 to 10 players", cta: "Play nearby" },
];

export const LARGEST_COUNTRY = TOURNAMENT_GAMES[0];
export const NUMBER_TRAIL = TOURNAMENT_GAMES.find((g) => g.key === "number_trail")!;
