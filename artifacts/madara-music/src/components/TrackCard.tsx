import { Track } from "@workspace/api-client-react";
import { usePlayer } from "../contexts/PlayerContext";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackCardProps {
  track: Track;
  onClick?: () => void;
}

export function TrackCard({ track, onClick }: TrackCardProps) {
  const { play, pause, currentTrack, isPlaying } = usePlayer();
  const isCurrentTrack = currentTrack?.id === track.id;

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentTrack && isPlaying) {
      pause();
    } else {
      play(track);
    }
  };

  return (
    <div 
      onClick={() => {
        if (onClick) onClick();
        else play(track);
      }}
      className="group relative flex flex-col p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(230,57,70,0.15)] border border-white/5"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden mb-4 shadow-lg">
        <img 
          src={track.thumbnail} 
          alt={track.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
        />
        <div className={cn(
          "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-300",
          isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <button 
            onClick={handlePlayPause}
            className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            {isCurrentTrack && isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </button>
        </div>
      </div>
      <div className="flex flex-col min-w-0">
        <h3 className="font-semibold text-white truncate group-hover:text-primary transition-colors">{track.title}</h3>
        <p className="text-sm text-white/60 truncate mt-1">{track.artist}</p>
      </div>
    </div>
  );
}
