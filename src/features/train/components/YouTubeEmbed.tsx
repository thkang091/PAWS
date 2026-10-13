import { useEffect, useMemo, useRef } from "react";
import { Linking, Platform, Text, View } from "react-native";
import Constants from "expo-constants";
import type { WebView as WebViewInstance } from "react-native-webview";
import { loadNativeWebView } from "../media/nativeWebView";
import { parseYouTubeEvent, youtubePlayerHtml } from "../media/youtubePlayerHtml";
import type { YouTubeEmbedProps } from "./YouTubeEmbed.types";

export function YouTubeEmbed(props: YouTubeEmbedProps) {
  const WebView = loadNativeWebView();
  return WebView ? <NativeYouTubeEmbed {...props} WebView={WebView} /> : <MissingWebView onEvent={props.onEvent} />;
}

function MissingWebView({ onEvent }: Pick<YouTubeEmbedProps, "onEvent">) {
  useEffect(() => { onEvent({ type: "error", code: -2 }); }, [onEvent]);
  return <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
    <Text style={{ color: "white", textAlign: "center" }}>Open this example using the YouTube link below.</Text>
  </View>;
}

function NativeYouTubeEmbed({ segment, initialAt, command, onEvent, WebView, showControls, playbackRate, muted, title }: YouTubeEmbedProps & {
  WebView: NonNullable<ReturnType<typeof loadNativeWebView>>;
}) {
  const webview = useRef<WebViewInstance>(null);
  const appId = Platform.OS === "ios" ? Constants.expoConfig?.ios?.bundleIdentifier : Constants.expoConfig?.android?.package;
  const origin = `https://${appId?.toLowerCase()}`;
  const source = useMemo(() => ({ html: youtubePlayerHtml(segment, origin, initialAt, { showControls, playbackRate, muted }), baseUrl: `${origin}/` }), [segment, origin, initialAt, showControls, playbackRate, muted]);
  useEffect(() => {
    if (command) webview.current?.injectJavaScript(`window.pawsYouTubeCommand && window.pawsYouTubeCommand(${JSON.stringify(command)});true;`);
  }, [command]);
  return <WebView ref={webview} source={source} accessibilityLabel={title} style={{ flex: 1, backgroundColor: "#141414" }}
    // Autoplay stays off in the IFrame API. Allow the user's PAWS replay/cue
    // button to initiate playback across the native-to-WebView bridge.
    originWhitelist={["*"]} allowsInlineMediaPlayback allowsFullscreenVideo mediaPlaybackRequiresUserAction={false}
    javaScriptEnabled scrollEnabled={false} allowsBackForwardNavigationGestures={false}
    onMessage={event => { const message = parseYouTubeEvent(event.nativeEvent.data); if (message) onEvent(message); }}
    onError={() => onEvent({ type: "error", code: -1 })}
    onOpenWindow={event => { if (/^https:\/\//.test(event.nativeEvent.targetUrl)) void Linking.openURL(event.nativeEvent.targetUrl).catch(() => {}); }}
    onShouldStartLoadWithRequest={request => {
      if (request.isTopFrame && request.navigationType === "click" && /^https:\/\//.test(request.url)) {
        void Linking.openURL(request.url).catch(() => {}); return false;
      }
      return true;
    }} />;
}
