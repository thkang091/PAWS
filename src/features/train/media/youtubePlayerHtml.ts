import type { YouTubeSegment } from "./trainingYouTube";

export type YouTubeCommand = { sequence: number; type: "pause" | "play"; at?: number };
export type YouTubeEvent = { type: "ready" } | { type: "ended" } | { type: "time"; seconds: number; state: number } | { type: "rate"; rate: number } | { type: "error"; code: number };

export function parseYouTubeEvent(raw: string): YouTubeEvent | null {
  try {
    const value = JSON.parse(raw);
    if (value?.channel !== "paws-youtube") return null;
    if (value.type === "ready") return { type: "ready" };
    if (value.type === "ended") return { type: "ended" };
    if (value.type === "error" && Number.isFinite(value.code)) return { type: "error", code: value.code };
    if (value.type === "rate" && Number.isFinite(value.rate) && value.rate > 0) return { type: "rate", rate: value.rate };
    if (value.type === "time" && Number.isFinite(value.seconds) && Number.isFinite(value.state)) {
      return { type: "time", seconds: value.seconds, state: value.state };
    }
  } catch { /* Ignore messages from the embedded video's own frames. */ }
  return null;
}

// The same official IFrame API document is used by browser and OS WebViews.
// No PAWS elements are placed over the player; source video/audio/ads stay intact.
export function youtubePlayerHtml(segment: YouTubeSegment, origin: string, initialAt = segment.startSeconds,
  options: { showControls?: boolean; playbackRate?: number } = {}) {
  const config = JSON.stringify({ ...segment, origin, initialAt, showControls: options.showControls ?? false, playbackRate: options.playbackRate ?? 0.6 }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body,#player{margin:0;width:100%;height:100%;background:#141414;overflow:hidden}</style></head><body><div id="player"></div><script>
  const config=${config};
  function closestRate(available,preferred) {
    const rates=available.filter(function(rate){return Number.isFinite(rate) && rate>0;});
    if(!rates.length) return 1;
    return rates.reduce(function(best,rate){return Math.abs(rate-preferred)<Math.abs(best-preferred)?rate:best;});
  }
  let player, ready=false, announcedReady=false, timer, preferredRate=config.playbackRate, restoreRate=true, endArmed=false;
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
    const payload=JSON.stringify(Object.assign({channel:'paws-youtube'},event));
    if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
    else window.parent.postMessage(payload,config.origin);
  }
  function range(at) { return {videoId:config.videoId,startSeconds:at,endSeconds:config.endSeconds}; }
  window.pawsYouTubeCommand=function(command) {
    if(!ready || !command) return;
    if(command.type==='pause') { endArmed=false; player.pauseVideo(); }
    if(command.type==='play' && Number.isFinite(command.at)) {
      restoreRate=true; endArmed=false;
      player.loadVideoById(range(Math.max(config.startSeconds,Math.min(config.endSeconds-0.05,command.at))));
    }
  };
  window.addEventListener('message',function(event) {
    if(event.source!==window.parent || event.origin!==config.origin) return;
    if(event.data && event.data.channel==='paws-command') window.pawsYouTubeCommand(event.data.command);
  });
  document.addEventListener('visibilitychange',function(){if(document.hidden && ready) { endArmed=false; player.pauseVideo(); }});
  window.onYouTubeIframeAPIReady=function() {
    player=new YT.Player('player',{width:'100%',height:'100%',videoId:config.videoId,
      // No cc_load_policy=1: retain the viewer's caption preference. There is
      // no documented force-off value. Controls can be reopened outside video.
      playerVars:{playsinline:1,controls:config.showControls?1:0,fs:config.showControls?1:0,iv_load_policy:3,autoplay:0,origin:config.origin},
      events:{onReady:function(){
        ready=true; player.cueVideoById(range(config.initialAt));
        timer=setInterval(function(){
          const seconds=player.getCurrentTime(),state=player.getPlayerState();
          emit({type:'time',seconds:seconds,state:state});
        },250);
      },onStateChange:function(event){
        if(event.data===1) endArmed=true;
        if(event.data===5) endArmed=false;
        // Only a range that actually played may continue the same clip. Cueing,
        // duplicate ENDED events and navigation pauses must never skip footage.
        if(event.data===0 && endArmed) { endArmed=false; emit({type:'ended'}); }
        if(event.data===5 || event.data===1) {
          applyRate(event.data);
          // Wait for the initial cue to finish before accepting a cross-segment
          // play request; otherwise the pending cue can overwrite that request.
          if(!announcedReady){announcedReady=true;emit({type:'ready'});}
        }
      },
      onPlaybackRateChange:function(event){if(!restoreRate) preferredRate=event.data;emit({type:'rate',rate:event.data});},
      onError:function(event){emit({type:'error',code:event.data});}}
    });
  };
  // The host removes this entire document on navigation. Calling destroy during
  // pagehide races YouTube's own iframe teardown; only stop our polling here.
  window.addEventListener('pagehide',function(){clearInterval(timer);});
  </script><script src="https://www.youtube.com/iframe_api" onerror="emit({type:'error',code:-1})"></script></body></html>`;
}
