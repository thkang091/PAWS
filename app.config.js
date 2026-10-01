const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? null;
// Keep local AI credentials out of EAS metadata and cloud build manifests.
const includeLocalAiKey =
  process.env.EXPO_NO_DOTENV !== "1" && process.env.EAS_BUILD !== "true";

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    "expo-video",
    [
      "react-native-maps",
      GOOGLE_MAPS_API_KEY
        ? { iosGoogleMapsApiKey: GOOGLE_MAPS_API_KEY, androidGoogleMapsApiKey: GOOGLE_MAPS_API_KEY }
        : {},
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "PAWS uses your location during a walk to draw the route and track distance.",
      },
    ],
  ],
  extra: {
    ...config.extra,
    ...(includeLocalAiKey
      ? {
          geminiApiKey:
            process.env.GEMINI_API_KEY ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? null,
        }
      : {}),
    googleMapsConfigured: Boolean(GOOGLE_MAPS_API_KEY),
    googleMapsKey: GOOGLE_MAPS_API_KEY,
  },
});
