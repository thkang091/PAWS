import { Platform } from "react-native";

export const colors = {
  background: "#FFF8ED",
  backgroundSoft: "#F7EEDC",
  card: "#FFFCF6",
  cardMuted: "#F3E9D8",
  primary: "#4F8F62",
  primaryDark: "#2F6443",
  primarySoft: "#DCEBDB",
  secondary: "#D98745",
  secondarySoft: "#F6D9B9",
  accent: "#DDE87A",
  accentSoft: "#F2F5CC",
  text: "#243226",
  textMuted: "#6D776C",
  textSubtle: "#8B9289",
  border: "#E5D8C3",
  borderStrong: "#CFC6B3",
  white: "#FFFFFF",
  silver: "#AAB2BC",
  silverSoft: "#EEF1F4",
  gold: "#D8A33E",
  goldSoft: "#FAE8BC",
  error: "#C94B4B",
  errorSoft: "#F8DEDE",
  warning: "#B77719",
  warningSoft: "#F8E6C8",
  success: "#3F8D5A",
  successSoft: "#DDF0E3",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 32,
  display: 44,
} as const;

export const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const shadows = {
  soft: Platform.select({
    ios: {
      shadowColor: "#2F2417",
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    default: {
      elevation: 3,
    },
  }),
  raised: Platform.select({
    ios: {
      shadowColor: "#2F2417",
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
    },
    default: {
      elevation: 5,
    },
  }),
} as const;

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  iconSizes,
  shadows,
} as const;
