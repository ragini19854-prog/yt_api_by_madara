import { usePlayer } from "../../contexts/PlayerContext";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { FullPlayer } from "./FullPlayer";

export function MiniPlayer() {
  const { 
    currentTrack, isPlaying, play, pause, resume, next, prev,
    currentTime, duration, seek, volume, setVolume,
    isMuted, toggleMute, shuffle, toggleShuffle, repeatMode, toggleRepeat
  } = usePlayer();

  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-background/80 backdrop-blur-2xl border-t border-border z-40 flex items-center px-4 md:px-6">
        <div className="absolute top-0 left-0 w-full h-1 bg-white/5 cursor-pointer group" onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const p = (e.clientX - rect.left) / rect.width;
          seek(p * duration);
        }}>
          <div className="h-full bg-primary relative" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex-1 flex items-center gap-4">
          <div 
            className="w-14 h-14 rounded-md overflow-hidden relative group cursor-pointer"
            onClick={() => setIsFullPlayerOpen(true)}
          >
            <img 
              src={currentTrack.thumbnail} 
              alt={currentTrack.title} 
              className={cn("w-full h-full object-cover transition-transform", isPlaying && "animate-[spin_10s_linear_infinite]")}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-white line-clamp-1">{currentTrack.title}</div>
            <div className="text-xs text-muted-foreground line-clamp-1">{currentTrack.artist}</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={toggleShuffle} className={cn("text-muted-foreground hover:text-white hidden sm:block transition-colors", shuffle && "text-primary")}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={prev} className="text-muted-foreground hover:text-white transition-colors">
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button 
              onClick={isPlaying ? pause : resume} 
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </button>
            <button onClick={next} className="text-muted-foreground hover:text-white transition-colors">
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button onClick={toggleRepeat} className={cn("text-muted-foreground hover:text-white hidden sm:block transition-colors", repeatMode !== "none" && "text-primary")}>
              <Repeat className="w-4 h-4" />
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 mt-1 w-full max-w-md">
            <span className="text-[10px] text-muted-foreground w-8 text-right">{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer group" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const p = (e.clientX - rect.left) / rect.width;
              seek(p * duration);
            }}>
              <div className="h-full bg-primary relative" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] text-muted-foreground w-8">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-4 hidden md:flex">
          <button onClick={toggleMute} className="text-muted-foreground hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const p = (e.clientX - rect.left) / rect.width;
            setVolume(p);
          }}>
            <div className="h-full bg-white relative" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
          </div>
        </div>
      </div>

      <FullPlayer isOpen={isFullPlayerOpen} onClose={() => setIsFullPlayerOpen(false)} />
    </>
  );
}
