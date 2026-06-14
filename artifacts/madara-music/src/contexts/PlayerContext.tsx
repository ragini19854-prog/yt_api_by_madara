import { createContext, useContext, useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Track } from "@workspace/api-client-react";
import { useRecordPlay } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";

interface PlayerContextType {
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: "none" | "one" | "all";
  shuffle: boolean;
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
  addToQueue: (track: Track) => void;
  playAll: (tracks: Track[], startIndex?: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

function isYouTubeTrack(track: Track): boolean {
  return (
    track.source === "youtube" ||
    track.previewUrl.includes("/api/music/youtube/")
  );
}

async function resolveFullAudio(track: Track): Promise<string> {
  if (isYouTubeTrack(track)) return track.previewUrl;
  try {
    const q = encodeURIComponent(`${track.title} ${track.artist} official audio`);
    const res = await fetch(`/api/music/youtube/resolve?q=${q}`);
    if (res.ok) {
      const data = (await res.json()) as { streamUrl?: string };
      if (data.streamUrl) return data.streamUrl;
    }
  } catch {
    // fall through to iTunes preview
  }
  return track.previewUrl;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"none" | "one" | "all">("none");
  const [shuffle, setShuffle] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolveAbortRef = useRef<AbortController | null>(null);
  const recordPlay = useRecordPlay();
  const { user } = useUser();

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onLoadedData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play();
      } else {
        next();
      }
    };

    audio.addEventListener("loadeddata", onLoadedData);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadeddata", onLoadedData);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
    };
  }, [repeatMode]);

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    // Cancel any previous in-flight resolve
    resolveAbortRef.current?.abort();
    resolveAbortRef.current = new AbortController();
    const signal = resolveAbortRef.current.signal;

    const loadAndPlay = async () => {
      setIsResolving(true);
      setDuration(0);
      setCurrentTime(0);

      const audioUrl = await resolveFullAudio(currentTrack);
      if (signal.aborted) return;

      setIsResolving(false);

      const audio = audioRef.current!;
      audio.src = audioUrl;

      try {
        await audio.play();
        setIsPlaying(true);
        if (user?.id) {
          recordPlay.mutate({
            data: {
              userId: user.id,
              trackId: currentTrack.id,
              trackTitle: currentTrack.title,
              trackArtist: currentTrack.artist,
              trackThumbnail: currentTrack.thumbnail,
              previewUrl: audioUrl,
              duration: currentTrack.duration,
            },
          });
        }
      } catch (e) {
        if (!signal.aborted) console.error("Playback failed:", e);
      }
    };

    loadAndPlay();
  }, [currentTrack, user?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const play = useCallback((track: Track) => {
    setCurrentTrack(track);
    setQueue((prev) => {
      if (prev.find((t) => t.id === track.id)) {
        setCurrentIndex(prev.findIndex((t) => t.id === track.id));
        return prev;
      }
      setCurrentIndex(prev.length);
      return [...prev, track];
    });
  }, []);

  const playAll = useCallback((tracks: Track[], startIndex = 0) => {
    setQueue(tracks);
    setCurrentIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [currentTrack]);

  const next = useCallback(() => {
    setQueue((q) => {
      setCurrentIndex((idx) => {
        if (q.length === 0) return idx;
        let nextIdx = idx + 1;
        if (shuffle) nextIdx = Math.floor(Math.random() * q.length);
        else if (nextIdx >= q.length) {
          if (repeatMode === "all") nextIdx = 0;
          else { pause(); return idx; }
        }
        setCurrentTrack(q[nextIdx]);
        return nextIdx;
      });
      return q;
    });
  }, [shuffle, repeatMode, pause]);

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
  }, [currentTime]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(Math.max(0, Math.min(1, val)));
    if (val > 0 && isMuted) setIsMuted(false);
  }, [isMuted]);

  const toggleMute = useCallback(() => setIsMuted((m) => !m), []);
  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const toggleRepeat = useCallback(() => {
    setRepeatMode((r) => r === "none" ? "all" : r === "all" ? "one" : "none");
  }, []);
  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        currentTrack, queue, isPlaying, currentTime, duration,
        volume, isMuted, repeatMode, shuffle, isResolving,
        play, pause, resume, next, prev, seek, setVolume,
        toggleMute, toggleShuffle, toggleRepeat, addToQueue, playAll,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within a PlayerProvider");
  return context;
}
