import { usePlayer } from "../../contexts/PlayerContext";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, ChevronDown, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@clerk/react";
import { useAddFavorite, useRemoveFavorite, useCheckFavorite, getCheckFavoriteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function FullPlayer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { 
    currentTrack, isPlaying, play, pause, resume, next, prev,
    currentTime, duration, seek, volume, setVolume,
    isMuted, toggleMute, shuffle, toggleShuffle, repeatMode, toggleRepeat
  } = usePlayer();
  
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const { data: checkData } = useCheckFavorite(
    { trackId: currentTrack?.id || "", userId: userId || "" },
    { query: { enabled: !!currentTrack && !!userId, queryKey: getCheckFavoriteQueryKey({ trackId: currentTrack?.id || "", userId: userId || "" }) } }
  );

  const isFavorite = checkData?.isFavorite || false;

  const handleToggleFavorite = () => {
    if (!userId || !currentTrack) return;
    
    const params = { trackId: currentTrack.id, userId };
    if (isFavorite) {
      removeFavorite.mutate(
        params,
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getCheckFavoriteQueryKey(params) }) }
      );
    } else {
      addFavorite.mutate(
        { data: { ...params, trackTitle: currentTrack.title, trackArtist: currentTrack.artist, trackThumbnail: currentTrack.thumbnail, previewUrl: currentTrack.previewUrl, duration: currentTrack.duration } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getCheckFavoriteQueryKey(params) }) }
      );
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isOpen && currentTrack && (
        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          {/* Blurred background */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl saturate-150 scale-110 pointer-events-none" 
            style={{ backgroundImage: `url(${currentTrack.thumbnail})` }} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />

          <div className="relative flex-1 flex flex-col max-w-md mx-auto w-full p-6">
            <div className="flex items-center justify-between py-4">
              <button onClick={onClose} className="p-2 -ml-2 text-white/70 hover:text-white transition-colors">
                <ChevronDown className="w-6 h-6" />
              </button>
              <span className="text-xs font-semibold tracking-widest text-white/50 uppercase">Now Playing</span>
              <div className="w-6" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-8">
              <motion.div 
                className={cn("w-full aspect-square rounded-2xl overflow-hidden shadow-2xl mb-8", isPlaying && "animate-[pulse_4s_ease-in-out_infinite]")}
                layoutId={`album-art-${currentTrack.id}`}
              >
                <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
              </motion.div>

              <div className="w-full flex items-center justify-between mb-8">
                <div className="flex-1 min-w-0 pr-4">
                  <h2 className="text-2xl font-bold text-white truncate">{currentTrack.title}</h2>
                  <p className="text-lg text-white/60 truncate">{currentTrack.artist}</p>
                </div>
                {userId && (
                  <button onClick={handleToggleFavorite} className="p-2 text-white hover:scale-110 transition-transform">
                    <Heart className={cn("w-6 h-6", isFavorite ? "fill-primary text-primary" : "text-white/70")} />
                  </button>
                )}
              </div>

              {/* Progress */}
              <div className="w-full mb-8">
                <div className="h-1.5 bg-white/10 rounded-full cursor-pointer group" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const p = (e.clientX - rect.left) / rect.width;
                  seek(p * duration);
                }}>
                  <div className="h-full bg-white relative rounded-full" style={{ width: `${progress}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs font-medium text-white/50">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="w-full flex items-center justify-between">
                <button onClick={toggleShuffle} className={cn("text-white/50 hover:text-white transition-colors", shuffle && "text-primary")}>
                  <Shuffle className="w-5 h-5" />
                </button>
                <button onClick={prev} className="text-white hover:scale-110 transition-transform">
                  <SkipBack className="w-8 h-8 fill-current" />
                </button>
                <button 
                  onClick={isPlaying ? pause : resume} 
                  className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>
                <button onClick={next} className="text-white hover:scale-110 transition-transform">
                  <SkipForward className="w-8 h-8 fill-current" />
                </button>
                <button onClick={toggleRepeat} className={cn("text-white/50 hover:text-white transition-colors", repeatMode !== "none" && "text-primary")}>
                  <Repeat className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
