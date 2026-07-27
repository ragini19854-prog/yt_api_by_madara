import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Track } from "@workspace/api-client-react";
import { useRecordPlay } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

// ── YouTube IFrame API types ────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (element: string | HTMLElement, options: YTPlayerOptions) => YTPlayer;
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}
interface YTPlayerOptions {
  height?: string | number;
  width?: string | number;
  videoId?: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { data: number; target: YTPlayer }) => void;
    onError?: (e: { data: number }) => void;
  };
}
interface YTPlayer {
  loadVideoById(videoId: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}

// ── Context shape (public API — same as before) ────────────────────────────
interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;       // 0-1
  isMuted: boolean;
  repeatMode: "none" | "one" | "all";
  shuffle: boolean;
  autoplay: boolean;
  isResolving: boolean;
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleAutoplay: () => void;
  addToQueue: (track: Track) => void;
  playAll: (tracks: Track[], startIndex?: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

// ── Helpers ────────────────────────────────────────────────────────────────
function extractVideoId(track: Track): string | null {
  if (track.videoId) return track.videoId;
  try {
    const url = new URL(track.previewUrl, window.location.origin);
    return url.searchParams.get("videoId");
  } catch {
    return null;
  }
}

async function fetchRelatedTracks(track: Track): Promise<Track[]> {
  try {
    const q = encodeURIComponent(`${track.title} ${track.artist}`);
    const res = await fetch(`/api/music/youtube/search?q=${q}&limit=5`);
    if (!res.ok) return [];
    const data = (await res.json()) as Track[];
    return data.filter((t) => t.id !== track.id).slice(0, 5);
  } catch {
    return [];
  }
}

// ── Provider ───────────────────────────────────────────────────────────────
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack]   = useState<Track | null>(null);
  const [queue, setQueue]                 = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex]   = useState(-1);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [currentTime, setCurrentTime]     = useState(0);
  const [duration, setDuration]           = useState(0);
  // Internal volume is 0-100 (YouTube scale); context exposes 0-1
  const [volumeInternal, setVolumeInternal] = useState(100);
  const [isMuted, setIsMuted]             = useState(false);
  const [repeatMode, setRepeatMode]       = useState<"none" | "one" | "all">("none");
  const [shuffle, setShuffle]             = useState(false);
  const [autoplay, setAutoplay]           = useState(true);
  const [isResolving, setIsResolving]     = useState(false);

  const ytPlayerRef      = useRef<YTPlayer | null>(null);
  const ytReadyRef       = useRef(false);
  const pendingVideoRef  = useRef<string | null>(null);
  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayingRef   = useRef(false);
  // Stable ref so YT callbacks always call the latest next()
  const nextRef          = useRef<() => void>(() => {});

  const recordPlay = useRecordPlay();
  const { user } = useUser();

  // ── Polling for currentTime (YT has no timeupdate event) ─────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      try {
        const p = ytPlayerRef.current;
        if (!p) return;
        setCurrentTime(p.getCurrentTime());
        const dur = p.getDuration();
        if (dur > 0) setDuration(dur);
      } catch { /* player destroyed or not ready */ }
    }, 500);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── Load YouTube IFrame API once ──────────────────────────────────────────
  useEffect(() => {
    const buildPlayer = () => {
      const el = document.getElementById("yt-player-container");
      if (!el || ytPlayerRef.current) return;

      const player: YTPlayer = new window.YT.Player("yt-player-container", {
        height: "1",
        width: "1",
        videoId: "",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            ytReadyRef.current = true;
            target.setVolume(volumeInternal);
            if (pendingVideoRef.current) {
              target.loadVideoById(pendingVideoRef.current);
              pendingVideoRef.current = null;
            }
          },
          onStateChange: ({ data }) => {
            const YT_PLAYING   = 1;
            const YT_PAUSED    = 2;
            const YT_ENDED     = 0;
            const YT_BUFFERING = 3;

            if (data === YT_PLAYING) {
              setIsPlaying(true);
              setIsResolving(false);
              startPolling();
            } else if (data === YT_PAUSED) {
              setIsPlaying(false);
              stopPolling();
            } else if (data === YT_ENDED) {
              stopPolling();
              setIsPlaying(false);
              nextRef.current();
            } else if (data === YT_BUFFERING) {
              setIsResolving(true);
            }
          },
          onError: () => {
            setIsResolving(false);
            setIsPlaying(false);
          },
        },
      });
      ytPlayerRef.current = player;
    };

    if (window.YT?.Player) {
      buildPlayer();
    } else {
      window.onYouTubeIframeAPIReady = buildPlayer;
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }

    return () => {
      stopPolling();
      try { ytPlayerRef.current?.destroy(); } catch { /* ok */ }
      ytPlayerRef.current = null;
      ytReadyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load a video into the YT player ───────────────────────────────────────
  const loadVideo = useCallback((videoId: string) => {
    setIsResolving(true);
    setCurrentTime(0);
    setDuration(0);
    if (ytReadyRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(videoId);
    } else {
      pendingVideoRef.current = videoId;
    }
  }, []);

  // ── React to currentTrack changes ──────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;
    const videoId = extractVideoId(currentTrack);
    if (!videoId) { console.warn("No videoId for track:", currentTrack.title); return; }

    loadVideo(videoId);

    if (user?.id) {
      recordPlay.mutate({
        data: {
          userId: user.id,
          trackId: currentTrack.id,
          trackTitle: currentTrack.title,
          trackArtist: currentTrack.artist,
          trackThumbnail: currentTrack.thumbnail,
          previewUrl: `/api/music/youtube/stream?videoId=${videoId}`,
          duration: currentTrack.duration,
        },
      });
    }
  }, [currentTrack, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Controls ───────────────────────────────────────────────────────────────
  const pause = useCallback(() => {
    ytPlayerRef.current?.pauseVideo();
    setIsPlaying(false);
    stopPolling();
  }, [stopPolling]);

  const resume = useCallback(() => {
    ytPlayerRef.current?.playVideo();
    setIsPlaying(true);
    startPolling();
  }, [startPolling]);

  const seek = useCallback((time: number) => {
    ytPlayerRef.current?.seekTo(time, true);
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((val: number) => {
    const v = Math.max(0, Math.min(100, Math.round(val * 100)));
    setVolumeInternal(v);
    ytPlayerRef.current?.setVolume(v);
    if (val > 0) {
      setIsMuted(false);
      ytPlayerRef.current?.unMute();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      if (m) ytPlayerRef.current?.unMute();
      else ytPlayerRef.current?.mute();
      return !m;
    });
  }, []);

  const next = useCallback(() => {
    setQueue((q) => {
      setCurrentIndex((idx) => {
        if (q.length === 0) return idx;

        if (repeatMode === "one") {
          // Replay same track by reloading video
          const track = q[idx];
          if (track) {
            const vid = extractVideoId(track);
            if (vid && ytReadyRef.current && ytPlayerRef.current) {
              ytPlayerRef.current.loadVideoById(vid);
            }
          }
          return idx;
        }

        let nextIdx = shuffle ? Math.floor(Math.random() * q.length) : idx + 1;
        if (nextIdx >= q.length) {
          if (repeatMode === "all") {
            nextIdx = 0;
          } else {
            const trackForAutoplay = q[idx];
            if (autoplay && trackForAutoplay && !autoplayingRef.current) {
              autoplayingRef.current = true;
              fetchRelatedTracks(trackForAutoplay).then((related) => {
                autoplayingRef.current = false;
                if (related.length > 0) {
                  setQueue((prev) => {
                    const newQueue = [...prev, ...related];
                    const newIdx = prev.length;
                    setCurrentIndex(newIdx);
                    setCurrentTrack(newQueue[newIdx]);
                    return newQueue;
                  });
                } else {
                  pause();
                }
              });
            } else {
              pause();
            }
            return idx;
          }
        }

        setCurrentTrack(q[nextIdx]);
        return nextIdx;
      });
      return q;
    });
  }, [shuffle, repeatMode, pause, autoplay]);

  // Keep nextRef pointing at latest next()
  useEffect(() => { nextRef.current = next; }, [next]);

  const prev = useCallback(() => {
    if (currentTime > 3) { seek(0); return; }
    setQueue((q) => {
      setCurrentIndex((idx) => {
        if (q.length === 0) return idx;
        const prevIdx = idx <= 0 ? q.length - 1 : idx - 1;
        setCurrentTrack(q[prevIdx]);
        return prevIdx;
      });
      return q;
    });
  }, [currentTime, seek]);

  const play = useCallback((track: Track) => {
    setCurrentTrack(track);
    setQueue((prev) => {
      const existing = prev.findIndex((t) => t.id === track.id);
      if (existing !== -1) { setCurrentIndex(existing); return prev; }
      setCurrentIndex(prev.length);
      return [...prev, track];
    });
  }, []);

  const playAll = useCallback((tracks: Track[], startIndex = 0) => {
    setQueue(tracks);
    setCurrentIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
  }, []);

  const toggleShuffle   = useCallback(() => setShuffle((s) => !s), []);
  const toggleAutoplay  = useCallback(() => setAutoplay((a) => !a), []);
  const toggleRepeat    = useCallback(() => {
    setRepeatMode((r) => r === "none" ? "all" : r === "all" ? "one" : "none");
  }, []);
  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack, queue, isPlaying, currentTime, duration,
        volume: volumeInternal / 100,   // expose as 0-1
        isMuted, repeatMode, shuffle, autoplay, isResolving,
        play, pause, resume, next, prev, seek, setVolume,
        toggleMute, toggleShuffle, toggleRepeat, toggleAutoplay, addToQueue, playAll,
      }}
    >
      {children}
      {/* Hidden YouTube player — must be in DOM before buildPlayer() runs */}
      <div
        style={{ position: "fixed", top: -9999, left: -9999, width: 1, height: 1, overflow: "hidden", pointerEvents: "none" }}
        aria-hidden="true"
      >
        <div id="yt-player-container" />
      </div>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within a PlayerProvider");
  return context;
}
