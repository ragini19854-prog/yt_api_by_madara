import { createContext, useContext, useState, useRef, useEffect, ReactNode } from "react";
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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordPlay = useRecordPlay();
  const { user } = useUser();

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    
    const handleEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play();
      } else {
        next();
      }
    };

    audio.addEventListener("loadeddata", setAudioData);
    audio.addEventListener("timeupdate", setAudioTime);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadeddata", setAudioData);
      audio.removeEventListener("timeupdate", setAudioTime);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
    };
  }, [repeatMode]);

  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.src = currentTrack.previewUrl;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        if (user?.id) {
          recordPlay.mutate({
            data: {
              userId: user.id,
              trackId: currentTrack.id,
              trackTitle: currentTrack.title,
              trackArtist: currentTrack.artist,
              trackThumbnail: currentTrack.thumbnail,
              previewUrl: currentTrack.previewUrl,
              duration: currentTrack.duration
            }
          });
        }
      }).catch(e => console.error("Playback failed:", e));
    }
  }, [currentTrack, user?.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  const play = (track: Track) => {
    setCurrentTrack(track);
    if (!queue.find(t => t.id === track.id)) {
      setQueue(prev => [...prev, track]);
      setCurrentIndex(queue.length);
    } else {
      setCurrentIndex(queue.findIndex(t => t.id === track.id));
    }
  };

  const playAll = (tracks: Track[], startIndex = 0) => {
    setQueue(tracks);
    setCurrentIndex(startIndex);
    setCurrentTrack(tracks[startIndex]);
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resume = () => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const next = () => {
    if (queue.length === 0) return;
    
    let nextIndex = currentIndex + 1;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      if (repeatMode === "all") {
        nextIndex = 0;
      } else {
        pause();
        return;
      }
    }
    
    setCurrentIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
  };

  const prev = () => {
    if (queue.length === 0) return;
    
    if (currentTime > 3) {
      seek(0);
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    
    setCurrentIndex(prevIndex);
    setCurrentTrack(queue[prevIndex]);
  };

  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (val: number) => {
    setVolumeState(Math.max(0, Math.min(1, val)));
    if (val > 0 && isMuted) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted(!isMuted);
  
  const toggleShuffle = () => setShuffle(!shuffle);
  
  const toggleRepeat = () => {
    setRepeatMode(prev => prev === "none" ? "all" : prev === "all" ? "one" : "none");
  };

  const addToQueue = (track: Track) => {
    setQueue(prev => [...prev, track]);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        shuffle,
        play,
        pause,
        resume,
        next,
        prev,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        playAll,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
