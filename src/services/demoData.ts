import type {
  Dog,
  OwnerTrainingGoal,
  PersonalizedRoadmap,
  PersonalizedRoadmapDay,
  TrainingCatalogActivity,
} from "@/types/domain";

export const DEMO_MODE = false;

const CHAPTERS: Array<{ category: OwnerTrainingGoal; steps: Array<[string, string]> }> = [
  {
    category: "BETTER_BEHAVIOR_AT_HOME",
    steps: [
      ["Settling on a mat", "Teach a calm place to land when the house gets busy."],
      ["Doorway manners", "Wait at the threshold instead of pushing through."],
      ["Four paws on the floor", "Greet people without jumping up."],
      ["Calm around food", "Hold a settle while the family eats."],
      ["Guest arrival routine", "Put the whole doorbell routine together."],
    ],
  },
  {
    category: "SAFETY_AND_OBEDIENCE",
    steps: [
      ["Name response", "One sound, one turn of the head, every time."],
      ["Marker words", "A word that means the treat is already on its way."],
      ["Hand signals", "Say it without saying it, for when the room is loud."],
      ["Leave it", "Walk past what you would rather they did not have."],
      ["Emergency recall", "The one word that always works."],
    ],
  },
  {
    category: "BETTER_WALKS",
    steps: [
      ["Leash foundations", "A leash with a curve in it, for a whole block."],
      ["Handling distractions", "Keep walking when the world gets interesting."],
      ["Polite passersby", "Past people without a greeting every time."],
      ["Crossing paths safely", "Curbs, corners, and waiting to be told."],
      ["Outdoor confidence", "New routes without the brakes going on."],
    ],
  },
  {
    category: "COOL_TRICKS_AND_GAMES",
    steps: [
      ["Play foundation", "Start and stop a game on your word."],
      ["Fetch basics", "Out, back, and let go, in that order."],
      ["Tug manners", "Teeth on the toy, never on the hand."],
      ["Spin", "The first trick worth filming."],
      ["Trick combinations", "Two tricks that run into one another."],
    ],
  },
  {
    category: "HANDLING_AND_GROOMING",
    steps: [
      ["Touch confidence", "Every part of them, calmly, in your own hands."],
      ["Brushing basics", "A brush that means good things are happening."],
      ["Paw checks", "Feet held, checked, and given back."],
      ["Nail care", "One nail at a time, with nothing to brace against."],
      ["Calm care routines", "The whole groom, start to finish, unhurried."],
    ],
  },
  {
    category: "SOCIAL_SKILLS",
    steps: [
      ["Calm greetings", "Meet someone new without coming off the ground."],
      ["Meeting new people", "Strangers who are allowed to be boring."],
      ["Passing other dogs", "A wide arc and a loose leash."],
      ["Visitor manners", "Someone at the door who stays a while."],
      ["Building confidence", "Somewhere busier than yesterday."],
    ],
  },
  {
    category: "HEALTHY_HABITS",
    steps: [
      ["Balanced meals", "The same amount, at the same times."],
      ["Fresh water", "Topped up, and somewhere they can always reach."],
      ["Quality sleep", "A dark, quiet place that is theirs."],
      ["Regular exercise", "Enough to settle afterwards, not enough to fray."],
      ["Routine checklist", "The whole day, on one short list."],
    ],
  },
  {
    category: "POTTY_AND_REAL_WORLD",
    steps: [
      ["Set a potty schedule", "Out at the same times, every day."],
      ["Potty cues", "A word that means now would be a good moment."],
      ["Going outside successfully", "Out, done, and back in without a detour."],
      ["Rewards and praise", "Paid the second it happens, not indoors after."],
      ["Build consistency", "A week of it, so it stops being a project."],
    ],
  },
  {
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    steps: [
      ["Bring a toy", "Fetch, but useful."],
      ["Carry an object", "Across the room, without a chew on the way."],
      ["Put toys away", "The basket, and only the basket."],
      ["Find a family member", "Go get them, and come back with them."],
      ["Deliver to a person", "Hand it over, and let go."],
    ],
  },
  {
    category: "CALM_ALONE_TIME",
    steps: [
      ["Training basics", "The settle everything else is built on."],
      ["Safe-zone routine", "A place they choose when you are busy."],
      ["Short step-away", "Out of sight for a moment, back before it matters."],
      ["Calm departure", "Leaving without a ceremony."],
      ["Life together", "A normal day, with none of it a problem."],
    ],
  },
];

const DONE_PER_CHAPTER = [2, 1, 0, 0, 3, 0, 5, 1, 0, 0];

type Store = { dog: Dog | null; roadmap: (PersonalizedRoadmap & { days: PersonalizedRoadmapDay[] }) | null };

const store: Store = { dog: null, roadmap: null };

const buildRoadmap = (dogId: string) => {
  const days: PersonalizedRoadmapDay[] = [];
  let n = 1;
  CHAPTERS.forEach((chapter, ci) => {
    chapter.steps.forEach(([title, goal], si) => {
      const activity = {
        id: `demo-a-${n}`,
        category: chapter.category,
        sequenceNumber: si + 1,
        level: 1,
        title,
        lessonGoal: goal,
      } as TrainingCatalogActivity;
      days.push({
        id: `demo-d-${n}`,
        roadmapId: "demo-roadmap",
        dayNumber: n,
        primaryActivityId: activity.id,
        optionalSideQuestId: null,
        optionalBondQuestId: null,
        reasonSelected: "",
        difficultyMode: si === chapter.steps.length - 1 ? "BOSS_BATTLE" : "LEARN",
        completedAt: si < (DONE_PER_CHAPTER[ci] ?? 0) ? new Date().toISOString() : null,
        feedback: null,
        primaryActivity: activity,
      });
      n += 1;
    });
  });

  return {
    id: "demo-roadmap",
    dogId,
    isActive: true,
    days,
  } as unknown as PersonalizedRoadmap & { days: PersonalizedRoadmapDay[] };
};

export const demoCreateDog = (name: string): Dog => {
  const dog = {
    id: "demo-dog",
    name: name.trim() || "your dog",
  } as unknown as Dog;
  store.dog = dog;
  store.roadmap = buildRoadmap(dog.id);
  return dog;
};

export const demoGetDog = (): Dog | null => store.dog;

export const demoGetRoadmap = () => store.roadmap;
