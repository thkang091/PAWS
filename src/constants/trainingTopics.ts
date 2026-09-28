import type { CompanionPoseKey } from "@/features/train/components/companionPaths";
import type { PastelTint } from "@/constants/design";
import type { OwnerTrainingGoal } from "@/types/domain";

export type TopicKey =
  | "rules"
  | "communication"
  | "grooming"
  | "manners"
  | "problems"
  | "potty"
  | "walks"
  | "social"
  | "tricks";

export type TopicLesson = { id: string; title: string; minutes: number };

export type TrainingTopic = {
  key: TopicKey;
  title: string;
  short: string;
  blurb: string;
  pose: CompanionPoseKey;
  tint: PastelTint;
  lessons: readonly TopicLesson[];
};

const lessons = (key: TopicKey, rows: readonly [string, number][]): TopicLesson[] =>
  rows.map(([title, minutes], index) => ({ id: `${key}-${index + 1}`, title, minutes }));

export const TRAINING_TOPICS: readonly TrainingTopic[] = [
  {
    key: "social",
    title: "Social skills",
    short: "Social",
    blurb: "Meeting people, dogs and new places",
    pose: "social",
    tint: "seafoam",
    lessons: lessons("social", [
      ["Watch from a distance", 6],
      ["Calm first greetings", 8],
      ["Socialization: people and dogs", 10],
      ["Passing dogs on a walk", 8],
      ["Visitors at the door", 10],
      ["A busy park, calmly", 12],
    ]),
  },
  {
    key: "rules",
    title: "Rules & boundaries",
    short: "Rules",
    blurb: "Doors, food, toys and home rules",
    pose: "settling",
    tint: "butter",
    lessons: lessons("rules", [
      ["Wait at the door", 6],
      ["Off the counter", 8],
      ["Leave it", 8],
      ["Go to your mat", 10],
      ["Toys are shared, not taken", 8],
      ["Settle at bedtime", 10],
    ]),
  },
  {
    key: "communication",
    title: "Clear communication",
    short: "Signals",
    blurb: "Rewards, attention and feedback",
    pose: "communication",
    tint: "sky",
    lessons: lessons("communication", [
      ["Your marker word", 5],
      ["Name means look at me", 6],
      ["Timing a reward", 8],
      ["A clear no reward marker", 8],
      ["Hand signals", 10],
      ["Being consistent at home", 8],
    ]),
  },
  {
    key: "walks",
    title: "Better walks",
    short: "Walks",
    blurb: "Loose lead, turns and passing things",
    pose: "walk",
    tint: "pistachio",
    lessons: lessons("walks", [
      ["The loose lead position", 8],
      ["Stop when it pulls", 8],
      ["Changing direction", 10],
      ["Passing people", 10],
      ["Waiting at the curb", 6],
      ["A calm break outside", 10],
    ]),
  },
  {
    key: "manners",
    title: "Calm everyday manners",
    short: "Manners",
    blurb: "Name, settling and staying calm",
    pose: "life",
    tint: "mint",
    lessons: lessons("manners", [
      ["Sit before good things", 6],
      ["Four paws on the floor", 8],
      ["Settle on cue", 10],
      ["Calm after play", 8],
      ["Waiting for dinner", 6],
      ["Relaxing in a café", 12],
    ]),
  },
  {
    key: "grooming",
    title: "Handling & grooming",
    short: "Grooming",
    blurb: "Touch, nails, baths and care",
    pose: "grooming",
    tint: "blush",
    lessons: lessons("grooming", [
      ["Happy to be touched", 6],
      ["Paws and nails", 8],
      ["Brushing without a fight", 8],
      ["Ears and teeth", 8],
      ["Bath time, calmly", 12],
      ["The vet check routine", 10],
    ]),
  },
  {
    key: "problems",
    title: "Problem behaviors",
    short: "Problems",
    blurb: "Biting, barking and chewing",
    pose: "healthy",
    tint: "peach",
    lessons: lessons("problems", [
      ["Soft mouth, not teeth", 8],
      ["Quiet after one bark", 8],
      ["Chew the right things", 6],
      ["Jumping up, redirected", 8],
      ["Barking at the window", 10],
      ["When the doorbell rings", 10],
    ]),
  },
  {
    key: "potty",
    title: "Potty & real-world skills",
    short: "Potty",
    blurb: "Potty, walks and daily safety",
    pose: "potty",
    tint: "lilac",
    lessons: lessons("potty", [
      ["A potty routine", 6],
      ["Reward outside, right away", 5],
      ["Accidents without scolding", 6],
      ["Come when called", 10],
      ["Car rides", 10],
      ["Alone for a little while", 12],
    ]),
  },
  {
    key: "tricks",
    title: "Tricks & games",
    short: "Tricks",
    blurb: "Spin, find it and brain games",
    pose: "play",
    tint: "butter",
    lessons: lessons("tricks", [
      ["Touch my hand", 5],
      ["Spin", 6],
      ["Find it", 8],
      ["Play dead", 8],
      ["Tidy up the toys", 12],
      ["A puzzle feeder", 10],
    ]),
  },
];

export const topicByKey = new Map(TRAINING_TOPICS.map((topic) => [topic.key, topic]));

export const topicForFocus = (goal: OwnerTrainingGoal | string): TopicKey => {
  switch (goal) {
    case "BETTER_BEHAVIOR_AT_HOME":
      return "rules";
    case "SAFETY_AND_OBEDIENCE":
      return "communication";
    case "BETTER_WALKS":
      return "walks";
    case "COOL_TRICKS_AND_GAMES":
      return "tricks";
    case "HELPFUL_SKILLS_AROUND_THE_HOUSE":
    case "CALM_ALONE_TIME":
    case "HEALTHY_HABITS":
      return "manners";
    case "SOCIAL_SKILLS":
      return "social";
    case "RULES_AND_BOUNDARIES":
      return "rules";
    case "CLEAR_COMMUNICATION":
    case "NOT_SURE_YET":
      return "communication";
    case "HANDLING_AND_GROOMING":
      return "grooming";
    case "CALM_EVERYDAY_MANNERS":
    case "SOMETHING_ELSE":
      return "manners";
    case "PROBLEM_BEHAVIORS":
      return "problems";
    case "POTTY_AND_REAL_WORLD":
      return "potty";
    case "DOING_WELL":
      return "tricks";
    default:
      return "social";
  }
};
