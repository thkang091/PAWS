import { accent, scene, text } from "@/constants/design";

/**
 * Number Trail's visual system, one place for the map, the glyphs and the panels. The two digits never differ by colour
 * alone: digit one is a solid gold line, digit two a deep green line with a white dotted centre, and the link between
 * them a thin dashed ink line.
 */
export const NT = {
  one: accent.band,
  two: "#2F7D6D",
  twoCentre: "#FFFFFF",
  link: text.primary,
  /** The finish stretch of an exact-length course: a solid ink line to the finish flag. */
  finish: text.primary,
  approach: text.tertiary,
  walked: text.primary,
  done: 1,
  todo: 0.38,
  board: scene.cream,
  street: "#FFFFFF",
  block: "#EFE8D6",
  park: scene.meadow,
} as const;

/** Map line widths in points. Completed streets are drawn heavier. */
export const LINE = { digit: 7, digitDone: 9, centre: 2.5, link: 3, finish: 4, approach: 3, walked: 3 } as const;
export const DASH = { link: [2, 9], twoCentre: [1, 8], approach: [6, 6] } as const;

export const digitColor = (k: 0 | 1) => (k === 0 ? NT.one : NT.two);
