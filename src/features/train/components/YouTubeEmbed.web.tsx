import { useEffect, useMemo, useRef } from "react";
import { parseYouTubeEvent, youtubePlayerHtml } from "../media/youtubePlayerHtml";
import type { YouTubeEmbedProps } from "./YouTubeEmbed.types";

export function YouTubeEmbed({ segment, initialAt, command, onEvent, showControls, playbackRate, muted, title }: YouTubeEmbedProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const html = useMemo(() => youtubePlayerHtml(segment, origin, initialAt, { showControls, playbackRate, muted }), [segment, origin, initialAt, showControls, playbackRate, muted]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin || typeof event.data !== "string") return;
      const message = parseYouTubeEvent(event.data);
      if (message) onEvent(message);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onEvent, origin]);
  useEffect(() => {
    if (command) frame.current?.contentWindow?.postMessage({ channel: "paws-command", command }, origin);
  }, [command, origin]);
  return <iframe ref={frame} title={title ?? `${segment.channel} training example`} srcDoc={html}
    allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen
    referrerPolicy="strict-origin-when-cross-origin" style={{ width: "100%", height: "100%", border: 0, display: "block" }} />;
}
