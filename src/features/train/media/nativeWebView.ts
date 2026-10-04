import { TurboModuleRegistry } from "react-native";

// Importing react-native-webview evaluates getEnforcing immediately. Older
// development binaries must pass this non-throwing check BEFORE that import.
export function loadNativeWebView(): typeof import("react-native-webview").WebView | null {
  if (!TurboModuleRegistry.get("RNCWebViewModule")) return null;
  return require("react-native-webview").WebView;
}
