import { SOCIALIZATION_SCRIPT, type LessonScript } from "@/features/train/components/lessonScript";

export type Lesson = {
  number: number;
  chapter: string;
  badge: string;
  title: string;
  blurb: string;
  trainer: { name: string; role: string };
  script: LessonScript;
};

export const CURRENT_LESSON: Lesson = {
  number: 8,
  chapter: "Introduction",
  badge: "The most popular lesson",
  title: "Socialization: meeting people and other dogs",
  blurb: "Build confidence around new people, dogs and places, a step at a time.",
  trainer: { name: "Emily Carter", role: "Certified dog trainer" },
  script: SOCIALIZATION_SCRIPT,
};
