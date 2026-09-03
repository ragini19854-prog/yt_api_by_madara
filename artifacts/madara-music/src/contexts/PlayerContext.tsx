import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Track } from "@workspace/api-client-react";
import { useRecordPlay } from "@workspace/api-client-react";
import { useOptionalAuth } from "./AuthContext";

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
  cueVideoById(videoId: string): void;
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

function extractVideoId(track: Track): string | null {
  if (track.videoId) return track.videoId;
  try {
    const url = new URL(track.previewUrl, window.location.origin);
    return url.searchParams.get("videoId");
  } catch {
    return null;
  }
}

// Fetch tracks related to the given seed track.
// Prefers the /related endpoint (YouTube's own recommendations for this videoId),
// which avoids re-fetching the same song. Falls back to a text search if the
// seed has no videoId or the related endpoint fails.
async function fetchRelatedTracks(track: Track, excludeIds: Set<string>): Promise<Track[]> {
  try {
    const videoId = track.videoId
      ?? (() => { try { return new URL(track.previewUrl, window.location.origin).searchParams.get("videoId"); } catch { return null; } })();

    if (videoId) {
      const res = await fetch(`/api/music/youtube/related?videoId=${encodeURIComponent(videoId)}&limit=10`);
      if (res.ok) {
        const data = (await res.json()) as Track[];
        const fresh = data.filter((t) => !excludeIds.has(t.id));
        if (fresh.length > 0) return fresh.slice(0, 5);
      }
    }

    // Fallback: text search but exclude already-played tracks
    const q = encodeURIComponent(`${track.title} ${track.artist}`);
    const res = await fetch(`/api/music/youtube/search?q=${q}&limit=10`);
    if (!res.ok) return [];
    const data = (await res.json()) as Track[];
    return data.filter((t) => !excludeIds.has(t.id)).slice(0, 5);
  } catch {
    return [];
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack]     = useState<Track | null>(null);
  const [queue, setQueue]                   = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex]     = useState(-1);
  const [isPlaying, setIsPlaying]           = useState(false);
  const [currentTime, setCurrentTime]       = useState(0);
  const [duration, setDuration]             = useState(0);
  const [volumeInternal, setVolumeInternal] = useState(100); // 0-100 for YT API
  const [isMuted, setIsMuted]               = useState(false);
  const [repeatMode, setRepeatMode]         = useState<"none" | "one" | "all">("none");
  const [shuffle, setShuffle]               = useState(false);
  const [autoplay, setAutoplay]             = useState(true);
  const [isResolving, setIsResolving]       = useState(false);

  const ytPlayerRef     = useRef<YTPlayer | null>(null);
  const ytReadyRef      = useRef(false);
  const pendingVideoRef = useRef<string | null>(null);
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoplayingRef  = useRef(false);
  // stable ref to latest next() so YT onStateChange closure can call it
  const nextRef         = useRef<() => void>(() => {});
  // prevent double-loading when play() already triggered loadVideoById
  const userInitiatedLoadRef = useRef(false);

  const recordPlay = useRecordPlay();
  const { user } = useOptionalAuth();

  // ── Polling currentTime (YT has no timeupdate event) ──────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      try {
        const p = ytPlayerRef.current;
        if (!p) return;
        setCurrentTime(p.getCurrentTime());
        const dur = p.getDuration();
        if (dur > 0) setDuration(dur);
      } catch { /* ok */ }
    }, 500);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // ── Core: load a video into the YT player ─────────────────────────────────
  // Call this synchronously inside user-gesture handlers when possible so
  // the browser's autoplay policy allows audio without extra prompts.
  const loadVideoIntoPlayer = useCallback((videoId: string) => {
    setIsResolving(true);
    setCurrentTime(0);
    setDuration(0);
    if (ytReadyRef.current && ytPlayerRef.current) {
      ytPlayerRef.current.loadVideoById(videoId);
    } else {
      // Player not ready yet — queue the video; onReady will pick it up
      pendingVideoRef.current = videoId;
    }
  }, []);

  // ── Initialise YouTube IFrame Player once ─────────────────────────────────
  useEffect(() => {
    const buildPlayer = () => {
      // Guard: only build once, and only when the container div exists
      if (ytPlayerRef.current) return;
      const el = document.getElementById("yt-player-container");
      if (!el) return;

      const player: YTPlayer = new window.YT.Player("yt-player-container", {
        height: "1",
        width: "1",
        videoId: "",
        playerVars: {
          autoplay: 1,         // allow autoplay for loadVideoById
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,   // hide video annotations
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            ytReadyRef.current = true;
            target.setVolume(volumeInternal);
            // Play anything queued before the player was ready
            if (pendingVideoRef.current) {
              target.loadVideoById(pendingVideoRef.current);
              pendingVideoRef.current = null;
            }
          },
          onStateChange: ({ data }) => {
            const PLAYING   = 1;
            const PAUSED    = 2;
            const ENDED     = 0;
            const BUFFERING = 3;

            if (data === PLAYING) {
              setIsPlaying(true);
              setIsResolving(false);
              startPolling();
            } else if (data === PAUSED) {
              setIsPlaying(false);
              stopPolling();
            } else if (data === ENDED) {
              stopPolling();
              setIsPlaying(false);
              nextRef.current();
            } else if (data === BUFFERING) {
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
      // API already loaded (e.g. cached from previous navigation)
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

  // ── Record play history when currentTrack changes ─────────────────────────
  // NOTE: video loading is done synchronously in play()/playAll()/next()/prev()
  // so autoplay policy is respected. This effect only handles side-effects
  // (history recording) and loads the video for programmatic track changes.
  useEffect(() => {
    if (!currentTrack) return;

    if (userInitiatedLoadRef.current) {
      // Video already loaded by play() / playAll() in the click handler
      userInitiatedLoadRef.current = false;
    } else {
      // Programmatic change (next, prev, autoplay queue)
      const videoId = extractVideoId(currentTrack);
      if (videoId) loadVideoIntoPlayer(videoId);
    }

    if (user?.id) {
      const videoId = extractVideoId(currentTrack);
      recordPlay.mutate({
        data: {
          userId: user.id,
          trackId: currentTrack.id,
          trackTitle: currentTrack.title,
          trackArtist: currentTrack.artist,
          trackThumbnail: currentTrack.thumbnail,
          previewUrl: currentTrack.previewUrl,
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

  // ── play() — called directly from user click; load video synchronously ────
  const play = useCallback((track: Track) => {
    const videoId = extractVideoId(track);
    if (videoId) {
      userInitiatedLoadRef.current = true; // tell useEffect not to double-load
      loadVideoIntoPlayer(videoId);        // synchronous inside click handler
    }
    setCurrentTrack(track);
    setQueue((prev) => {
      const idx = prev.findIndex((t) => t.id === track.id);
      if (idx !== -1) { setCurrentIndex(idx); return prev; }
      setCurrentIndex(prev.length);
      return [...prev, track];
    });
  }, [loadVideoIntoPlayer]);

  // ── playAll() — called from user click; load first track synchronously ────
  const playAll = useCallback((tracks: Track[], startIndex = 0) => {
    const track = tracks[startIndex];
    if (!track) return;
    const videoId = extractVideoId(track);
    if (videoId) {
      userInitiatedLoadRef.current = true;
      loadVideoIntoPlayer(videoId);
    }
    setQueue(tracks);
    setCurrentIndex(startIndex);
    setCurrentTrack(track);
  }, [loadVideoIntoPlayer]);

  // ── next() — programmatic; useEffect will handle loading ──────────────────
  const next = useCallback(() => {
    setQueue((q) => {
      setCurrentIndex((idx) => {
        if (q.length === 0) return idx;

        if (repeatMode === "one") {
          // Re-load same video
          const videoId = extractVideoId(q[idx]);
          if (videoId) loadVideoIntoPlayer(videoId);
          return idx;
        }

        let nextIdx = shuffle ? Math.floor(Math.random() * q.length) : idx + 1;
        if (nextIdx >= q.length) {
          if (repeatMode === "all") {
            nextIdx = 0;
          } else {
            const seed = q[idx];
            if (autoplay && seed && !autoplayingRef.current) {
              autoplayingRef.current = true;
              // Pass the full set of already-queued track IDs so related
              // tracks are genuinely fresh (not songs already played/queued).
              const alreadyPlayed = new Set(q.map((t) => t.id));
              fetchRelatedTracks(seed, alreadyPlayed).then((related) => {
                autoplayingRef.current = false;
                if (related.length > 0) {
                  setQueue((prev) => {
                    const merged = [...prev, ...related];
                    const newIdx = prev.length;
                    setCurrentIndex(newIdx);
                    setCurrentTrack(merged[newIdx]);
                    return merged;
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
  }, [shuffle, repeatMode, pause, autoplay, loadVideoIntoPlayer]);

  useEffect(() => { nextRef.current = next; }, [next]);

  // ── prev() ─────────────────────────────────────────────────────────────────
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

  const toggleShuffle   = useCallback(() => setShuffle((s) => !s), []);
  const toggleAutoplay  = useCallback(() => setAutoplay((a) => !a), []);
  const toggleRepeat    = useCallback(() =>
    setRepeatMode((r) => r === "none" ? "all" : r === "all" ? "one" : "none"), []);
  const addToQueue = useCallback((track: Track) =>
    setQueue((prev) => [...prev, track]), []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack, queue, isPlaying, currentTime, duration,
        volume: volumeInternal / 100,
        isMuted, repeatMode, shuffle, autoplay, isResolving,
        play, pause, resume, next, prev, seek, setVolume,
        toggleMute, toggleShuffle, toggleRepeat, toggleAutoplay, addToQueue, playAll,
      }}
    >
      {children}
      {/* Hidden YouTube player container — must stay in DOM */}
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
