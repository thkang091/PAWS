/** A feature added after the installed development binary was built. */
export class MissingNativeFeatureError extends Error {
  constructor(feature: string) {
    super(`${feature} needs a newer PAWS development build. Install the updated PAWS app, then try again.`);
    this.name = "MissingNativeFeatureError";
  }
}

const requireFeature = (moduleName: string, feature: string) => {
  const { Platform } = require("react-native") as typeof import("react-native");
  if (Platform.OS === "web") return;
  const { requireOptionalNativeModule } = require("expo-modules-core") as typeof import("expo-modules-core");
  if (!requireOptionalNativeModule(moduleName)) throw new MissingNativeFeatureError(feature);
};

// These packages enforce native availability at import time. Check before loading
// them so Expo Router can still discover every route in an older development app.
export const loadMedicalPdfModules = () => {
  requireFeature("ExpoPrint", "Sharing a medical PDF");
  requireFeature("ExpoSharing", "Sharing a medical PDF");
  return {
    Print: require("expo-print") as typeof import("expo-print"),
    Sharing: require("expo-sharing") as typeof import("expo-sharing"),
  };
};

export const loadWebBrowser = (feature: string): typeof import("expo-web-browser") => {
  requireFeature("ExpoWebBrowser", feature);
  return require("expo-web-browser");
};
