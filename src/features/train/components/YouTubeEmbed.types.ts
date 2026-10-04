import type { YouTubeCommand, YouTubeEvent } from "../media/youtubePlayerHtml";
import type { YouTubeSegment } from "../media/trainingYouTube";

export type YouTubeEmbedProps = {
  segment: YouTubeSegment;
  initialAt: number;
  showControls?: boolean;
  playbackRate?: number;
  command: YouTubeCommand | null;
  onEvent: (event: YouTubeEvent) => void;
};
