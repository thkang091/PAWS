import type { FocusPoseKey } from "@/components/mascot/focusPosePaths";
import type { PastelTint } from "@/constants/design";
import type { OwnerTrainingGoal } from "@/types/domain";

export type FocusFollowUp = {
  prompt: string;
  options: ReadonlyArray<{ value: string; label: string }>;
};

export type FocusArea = {
  key: OwnerTrainingGoal;
  title: string;
  blurb: string;
  pose: FocusPoseKey;
  tint: PastelTint;
  lead: string;
  sentenceValue: string;
  followUp: FocusFollowUp | null;
};

export const focusAreas: readonly FocusArea[] = [
  {
    key: "RULES_AND_BOUNDARIES",
    pose: "rules",
    tint: "butter",
    lead: "start with ",
    sentenceValue: "rules & boundaries",
    title: "Rules & boundaries",
    blurb: "Doors, food, toys & home rules",
    followUp: {
      prompt: "Where do the rules slip most?",
      options: [
        { value: "doors_and_thresholds", label: "Doors & thresholds" },
        { value: "food_and_counters", label: "Food & counters" },
        { value: "toys_and_furniture", label: "Toys & furniture" },
        { value: "guests_arriving", label: "Guests arriving" },
        { value: "bedtime_and_settling", label: "Bedtime & settling" },
      ],
    },
  },
  {
    key: "CLEAR_COMMUNICATION",
    pose: "communication",
    tint: "sky",
    lead: "start with ",
    sentenceValue: "clear communication",
    title: "Clear communication",
    blurb: "Rewards, attention & feedback",
    followUp: {
      prompt: "What's hardest to get across?",
      options: [
        { value: "getting_attention", label: "Getting attention" },
        { value: "saying_yes_clearly", label: "Saying yes clearly" },
        { value: "saying_no_clearly", label: "Saying no clearly" },
        { value: "timing_rewards", label: "Timing rewards" },
        { value: "staying_consistent", label: "Staying consistent" },
      ],
    },
  },
  {
    key: "HANDLING_AND_GROOMING",
    pose: "grooming",
    tint: "blush",
    lead: "start with ",
    sentenceValue: "handling & grooming",
    title: "Handling & grooming",
    blurb: "Touch, nails, baths & care",
    followUp: {
      prompt: "What's hardest to handle?",
      options: [
        { value: "nails_and_paws", label: "Nails & paws" },
        { value: "brushing_and_baths", label: "Brushing & baths" },
        { value: "ears_eyes_teeth", label: "Ears, eyes & teeth" },
        { value: "vet_visits", label: "Vet visits" },
        { value: "being_picked_up", label: "Being picked up" },
      ],
    },
  },
  {
    key: "CALM_EVERYDAY_MANNERS",
    pose: "manners",
    tint: "mint",
    lead: "start with ",
    sentenceValue: "calm everyday manners",
    title: "Calm everyday manners",
    blurb: "Name, settling & staying calm",
    followUp: {
      prompt: "Where does calm break down?",
      options: [
        { value: "name_response", label: "Name response" },
        { value: "waiting_at_doors", label: "Waiting at doors" },
        { value: "settling_on_a_mat", label: "Settling on a mat" },
        { value: "greeting_people", label: "Greeting people" },
        { value: "around_food", label: "Around food" },
      ],
    },
  },
  {
    key: "PROBLEM_BEHAVIORS",
    pose: "problems",
    tint: "peach",
    lead: "start with ",
    sentenceValue: "problem behaviors",
    title: "Problem behaviors",
    blurb: "Biting, barking & chewing",
    followUp: {
      prompt: "What's happening most often?",
      options: [
        { value: "biting_hands_or_feet", label: "Biting hands or feet" },
        { value: "chewing_household_items", label: "Chewing household items" },
        { value: "barking_for_attention", label: "Barking for attention" },
        { value: "barking_at_sounds", label: "Barking at sounds or visitors" },
        { value: "jumping_on_people", label: "Jumping on people" },
        { value: "picking_things_up", label: "Picking things up" },
        { value: "something_else", label: "Something else" },
      ],
    },
  },
  {
    key: "POTTY_AND_REAL_WORLD",
    pose: "potty",
    tint: "lilac",
    lead: "start with ",
    sentenceValue: "potty & real-world skills",
    title: "Potty & real-world skills",
    blurb: "Potty, walks & daily safety",
    followUp: {
      prompt: "What needs the most work?",
      options: [
        { value: "potty_routine", label: "Potty routine" },
        { value: "walking_on_leash", label: "Walking on leash" },
        { value: "traffic_and_roads", label: "Traffic & roads" },
        { value: "meeting_other_dogs", label: "Meeting other dogs" },
        { value: "settling_outdoors", label: "Settling outdoors" },
      ],
    },
  },
  {
    key: "NOT_SURE_YET",
    pose: "unsure",
    tint: "mist",
    lead: "",
    sentenceValue: "find the best place to start",
    title: "I'm not sure yet",
    blurb: "Help me find the best place to start",
    followUp: null,
  },
  {
    key: "SOMETHING_ELSE",
    pose: "other",
    tint: "pistachio",
    lead: "work on ",
    sentenceValue: "something else",
    title: "Other",
    blurb: "Something else not listed",
    followUp: null,
  },
  {
    key: "DOING_WELL",
    pose: "doing_well",
    tint: "seafoam",
    lead: "keep things ",
    sentenceValue: "light for now",
    title: "We're doing well",
    blurb: "Just exploring for now",
    followUp: null,
  },
];

export const focusByKey = new Map(focusAreas.map((area) => [area.key, area]));
