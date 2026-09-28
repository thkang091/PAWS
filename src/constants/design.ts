import { Platform } from "react-native";
import { Easing } from "react-native-reanimated";

export const accent = {
  primary: "#F4F2C0",
  soft: "#FDFBDB",
  pressed: "#ECECB8",
  deep: "#FCD46F",
  deepPressed: "#F3C557",
  band: "#E9A73E",
} as const;

export const bg = {
  canvas: "#FFFFFF",
  surface: "#FFFFFF",
  subtle: "#F4F4F2",
  stage: "#FDFAEC",
} as const;

export const text = {
  primary: "#1C1B1A",
  secondary: "#686762",
  tertiary: "#9B9A94",
  disabled: "#BDBCB7",
  inverse: "#FFFFFF",
} as const;

export const border = {
  soft: "#E8E7E2",
  default: "#DCDAD4",
  strong: "#C8C6BF",
} as const;

export const mascot = {
  coat: "#F7F2E4",
  ink: "#1C1B1A",
} as const;

export const scene = {
  ink: "#1A1A1A",
  cream: "#FBF8F0",
  skin: "#FACEA6",
  hair: "#403227",
  sage: "#ABAE8F",
  sageDeep: "#657A59",
  meadow: "#D2D6BB",
  ball: "#FDE49B",
  forest: "#7C9860",
  ground: "#D0DCAC",
  trail: "#F5EDD8",
  shrub: "#749C68",
  shrubDeep: "#548054",
  tan: "#D6A66E",
  bandana: "#5B7964",
  aqua: "#96C8D7",
  blob: "#F8E6AC",
  blobSoft: "#FCF3DA",
} as const;

export const pastel = {
  butter: "#FCF8E0",
  sky: "#E7F1FB",
  blush: "#FBECF1",
  mint: "#E6F3EA",
  peach: "#FDEFE3",
  lilac: "#EDEBFA",
  mist: "#EFF1F3",
  pistachio: "#F1F4E6",
  seafoam: "#E7F2F2",
} as const;

export type PastelTint = keyof typeof pastel;

export const fonts = {
  display: Platform.select({ ios: undefined, default: undefined }),
  text: Platform.select({ ios: undefined, default: undefined }),
} as const;

export const type = {
  hero: { fontSize: 36, lineHeight: 37, letterSpacing: -0.72, fontWeight: "600" },
  pageTitle: { fontSize: 28, lineHeight: 31, letterSpacing: -0.56, fontWeight: "600" },
  sectionTitle: { fontSize: 20, lineHeight: 24, letterSpacing: -0.2, fontWeight: "600" },
  cardTitle: { fontSize: 16, lineHeight: 20, letterSpacing: -0.1, fontWeight: "500" },
  body: { fontSize: 16, lineHeight: 23, letterSpacing: 0, fontWeight: "400" },
  supporting: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: "400" },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0, fontWeight: "400" },
  eyebrow: { fontSize: 12, lineHeight: 16, letterSpacing: 0.96, fontWeight: "600" },
  button: { fontSize: 14, lineHeight: 14, letterSpacing: 1.2, fontWeight: "600" },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  section: 32,
  sectionLg: 40,
  block: 48,
  page: 64,
} as const;

export const radius = {
  control: 12,
  input: 16,
  card: 18,
  sheet: 32,
  pill: 999,
} as const;

export const layout = {
  gutter: 24,
  controlHeight: 56,
  iconButton: 44,
} as const;

export const icon = {
  inline: 16,
  standard: 20,
  nav: 22,
  button: 20,
  feature: 24,
} as const;

export const elevation = Platform.select({
  ios: {
    shadowColor: "#1C1B1A",
    shadowOpacity: 0.05,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 2 },
}) as object;

export const motion = {
  easing: {
    out: Easing.bezier(0.23, 1, 0.32, 1),
    inOut: Easing.bezier(0.77, 0, 0.175, 1),
    drawer: Easing.bezier(0.32, 0.72, 0, 1),
    linear: Easing.linear,
  },
  duration: {
    pressIn: 120,
    pressOut: 160,
    select: 180,
    enter: 260,
    exit: 160,
    reveal: 340,
    flourish: 460,
  },
  stagger: 55,
  spring: { duration: 420, dampingRatio: 0.72 },
  commitHold: 300,
} as const;

export const design = {
  accent,
  bg,
  text,
  border,
  mascot,
  scene,
  pastel,
  fonts,
  type,
  space,
  radius,
  layout,
  icon,
  elevation,
  motion,
} as const;
