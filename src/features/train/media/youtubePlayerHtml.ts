import type { YouTubeSegment } from "./trainingYouTube";

export type YouTubeCommand = { sequence: number; type: "pause" | "play" | "allowPlayback"; at?: number; segment?: YouTubeSegment };
export type YouTubeEvent = ({ type: "ready" } | { type: "ended" } | { type: "time"; seconds: number; state: number }
  | { type: "rate"; rate: number } | { type: "mute"; muted: boolean } | { type: "error"; code: number }) & { request?: number };

export function parseYouTubeEvent(raw: string): YouTubeEvent | null {
  try {
    const value = JSON.parse(raw);
    if (value?.channel !== "paws-youtube") return null;
    if (value.request !== undefined && (!Number.isSafeInteger(value.request) || value.request < 0)) return null;
    const scope = value.request === undefined ? {} : { request: value.request };
    if (value.type === "ready") return { type: "ready", ...scope };
    if (value.type === "ended") return { type: "ended", ...scope };
    if (value.type === "error" && Number.isFinite(value.code)) return { type: "error", code: value.code, ...scope };
    if (value.type === "mute" && typeof value.muted === "boolean") return { type: "mute", muted: value.muted, ...scope };
    if (value.type === "rate" && Number.isFinite(value.rate) && value.rate > 0) return { type: "rate", rate: value.rate, ...scope };
    if (value.type === "time" && Number.isFinite(value.seconds) && Number.isFinite(value.state)) {
      return { type: "time", seconds: value.seconds, state: value.state, ...scope };
    }
  } catch { /* Ignore messages from the embedded video's own frames. */ }
  return null;
}

// The same official IFrame API document is used by browser and OS WebViews.
// No PAWS elements are placed over the player; source video/audio/ads stay intact.
export function youtubePlayerHtml(segment: YouTubeSegment, origin: string, initialAt = segment.startSeconds,
  options: { showControls?: boolean; playbackRate?: number; muted?: boolean } = {}) {
  const config = JSON.stringify({ ...segment, origin, initialAt, showControls: options.showControls ?? false, playbackRate: options.playbackRate ?? 0.6, muted: options.muted ?? true }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body,#player{margin:0;width:100%;height:100%;background:#141414;overflow:hidden}</style></head><body><div id="player"></div><script>
  const config=${config};
  function closestRate(available,preferred) {
    const rates=available.filter(function(rate){return Number.isFinite(rate) && rate>0;});
    if(!rates.length) return 1;
    return rates.reduce(function(best,rate){return Math.abs(rate-preferred)<Math.abs(best-preferred)?rate:best;});
  }
  let player, ready=false, announcedReady=false, timer, preferredRate=config.playbackRate, restoreRate=true, endArmed=false;
  let active=config, request=0, suspended=false, playWhenCued=false, lastMuted;
  function matchesVideo() {
    const url=player.getVideoUrl();
    const match=typeof url==='string' && url.match(/[?&]v=([^&]+)/);
    return match && match[1]===active.videoId;
  }
  function matchesActive() {
    // Old source events can arrive after loadVideoById. Use the documented
    // video URL and source clock before accepting readiness/time/end events.
    const seconds=player.getCurrentTime();
    return matchesVideo() && seconds>=active.startSeconds-0.25 && seconds<=active.endSeconds+0.5;
  }
  function reportMute() {
    const muted=player.isMuted();
    if(muted!==lastMuted){lastMuted=muted;emit({type:'mute',muted:muted});}
  }
  function applyRate(state) {
    if(!restoreRate) return;
    const rates=player.getAvailablePlaybackRates();
    const target=closestRate(rates,preferredRate);
    // Metadata may still be loading at CUED; try again when playback starts.
    if(rates.length===1 && target===1 && state!==1) return;
    restoreRate=false; preferredRate=target;
    player.setPlaybackRate(target);
  }
  function emit(event) {
    const payload=JSON.stringify(Object.assign({channel:'paws-youtube',request:request},event));
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
    else window.parent.postMessage(payload,config.origin);
  }
  function acceptState(state) {
    if(!ready) return;
    const matches=matchesActive();
    if(state===1 && suspended) {
      player.pauseVideo();
      if(matches && !announcedReady){announcedReady=true;emit({type:'ready'});}
      return;
    }
    // The first cue is already tied to config. Its thumbnail can report time
    // 0 and no video URL until playback, so do not block the first play request.
    if(!matches && !(state===5 && request===0)) return;
    if(state===1) {endArmed=true;playWhenCued=false;}
    if(state===5) endArmed=false;
    // A caption request can overlap the initial cue finishing. If the target
    // remains CUED, complete that explicit play request once; never autoplay
    // the initial thumbnail or restart after a pause/background event.
    if(state===5 && request>0) {
      if(playWhenCued && !suspended){playWhenCued=false;player.playVideo();}
      return;
    }
    // Late / duplicate ENDED events must never skip a newly requested range.
    if(state===0 && endArmed && player.getCurrentTime()>=active.endSeconds-0.25) { endArmed=false; emit({type:'ended'}); }
    if(state===5 || state===1) {
      applyRate(state);
      if(!announcedReady){announcedReady=true;emit({type:'ready'});}
    }
  }
  function range(at) { return {videoId:active.videoId,startSeconds:at,endSeconds:active.endSeconds}; }
  window.pawsYouTubeCommand=function(command) {
    if(!ready || !command) return;
    // Returning to the screen permits the viewer's own YouTube play button,
    // without starting playback or loading anything automatically.
    if(command.type==='allowPlayback') suspended=false;
    if(command.type==='pause') { suspended=true; endArmed=false; playWhenCued=false; player.pauseVideo(); }
    if(command.type==='play' && Number.isFinite(command.at)) {
      const target=command.segment || active;
      if(!/^[\\w-]{11}$/.test(target.videoId) || !Number.isFinite(target.startSeconds) || !Number.isFinite(target.endSeconds) || target.endSeconds<=target.startSeconds) return;
      active=target; request=command.sequence || 0;
      restoreRate=true; endArmed=false; announcedReady=false; suspended=false; playWhenCued=true;
      // Reuse this player and WebView, including the viewer's mute preference.
      // loadVideoById retains endSeconds; seekTo would discard that boundary.
      player.loadVideoById(range(Math.max(active.startSeconds,Math.min(active.endSeconds-0.05,command.at))));
    }
  };
  window.addEventListener('message',function(event) {
    if(event.source!==window.parent || event.origin!==config.origin) return;
    if(event.data && event.data.channel==='paws-command') window.pawsYouTubeCommand(event.data.command);
  });
  document.addEventListener('visibilitychange',function(){if(document.hidden && ready) { suspended=true; endArmed=false; playWhenCued=false; player.pauseVideo(); }});
  window.onYouTubeIframeAPIReady=function() {
    player=new YT.Player('player',{width:'100%',height:'100%',videoId:config.videoId,
      // No cc_load_policy=1: retain the viewer's caption preference. There is
      // no documented force-off value. Controls can be reopened outside video.
      playerVars:{playsinline:1,controls:config.showControls?1:0,fs:config.showControls?1:0,iv_load_policy:3,autoplay:0,origin:config.origin},
      events:{onReady:function(){
        ready=true;
        if(config.muted) player.mute(); else player.unMute();
        reportMute();
        player.cueVideoById(range(config.initialAt));
        timer=setInterval(function(){
          reportMute();
          const seconds=player.getCurrentTime(),state=player.getPlayerState();
          // A seek may begin at an earlier keyframe. Accept it once its clock
          // reaches the requested range, even without another state event.
          acceptState(state);
          if(announcedReady && matchesActive()) emit({type:'time',seconds:seconds,state:state});
        },250);
      },onStateChange:function(event){acceptState(event.data);},
      onPlaybackRateChange:function(event){if(!restoreRate) preferredRate=event.data;emit({type:'rate',rate:event.data});},
      onError:function(event){emit({type:'error',code:event.data});}}
    });
  };
  // The host removes this entire document on navigation. Calling destroy during
  // pagehide races YouTube's own iframe teardown; only stop our polling here.
  window.addEventListener('pagehide',function(){clearInterval(timer);});
  </script><script src="https://www.youtube.com/iframe_api" onerror="emit({type:'error',code:-1})"></script></body></html>`;
}
