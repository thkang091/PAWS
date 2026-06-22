export {
  BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAME_DIFFICULTY_COUNTS,
  BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES,
} from "@/data/challengeGames/betterBehaviorAtHome";

import { BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES } from "@/data/challengeGames/betterBehaviorAtHome";
import { BETTER_WALKS_CHALLENGE_GAMES } from "@/data/challengeGames/betterWalks";
import { CALM_ALONE_TIME_CHALLENGE_GAMES } from "@/data/challengeGames/calmAloneTime";
import { COOL_TRICKS_AND_GAMES_CHALLENGE_GAMES } from "@/data/challengeGames/coolTricksAndGames";
import { HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES } from "@/data/challengeGames/helpfulSkillsAroundHouse";
import { SAFETY_AND_OBEDIENCE_CHALLENGE_GAMES } from "@/data/challengeGames/safetyAndObedience";
import type { ChallengeGame } from "@/types/domain";

export { BETTER_WALKS_CHALLENGE_GAMES } from "@/data/challengeGames/betterWalks";

export { HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES } from "@/data/challengeGames/helpfulSkillsAroundHouse";

export { SAFETY_AND_OBEDIENCE_CHALLENGE_GAMES } from "@/data/challengeGames/safetyAndObedience";

export { COOL_TRICKS_AND_GAMES_CHALLENGE_GAMES } from "@/data/challengeGames/coolTricksAndGames";

export { CALM_ALONE_TIME_CHALLENGE_GAMES } from "@/data/challengeGames/calmAloneTime";

export const CHALLENGE_GAME_CATALOG: ChallengeGame[] = [
  ...BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES,
  ...SAFETY_AND_OBEDIENCE_CHALLENGE_GAMES,
  ...BETTER_WALKS_CHALLENGE_GAMES,
  ...COOL_TRICKS_AND_GAMES_CHALLENGE_GAMES,
  ...HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES,
  ...CALM_ALONE_TIME_CHALLENGE_GAMES,
];
