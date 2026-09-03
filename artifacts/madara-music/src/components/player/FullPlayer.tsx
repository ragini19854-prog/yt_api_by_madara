import { usePlayer } from "../../contexts/PlayerContext";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, ChevronDown, Heart, Mic, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useOptionalAuth } from "../../contexts/AuthContext";
import { useAddFavorite, useRemoveFavorite, useCheckFavorite, getCheckFavoriteQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

type Tab = "player" | "lyrics";

function useLyrics(title: string, artist: string) {
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!title || !artist) return;
    setLyrics(null);
    setError(false);
    setLoading(true);
    const controller = new AbortController();
    fetch(`/api/music/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d: { lyrics?: string; error?: string }) => {
        if (d.lyrics) setLyrics(d.lyrics);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [title, artist]);

  return { lyrics, loading, error };
}

export function FullPlayer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { 
    currentTrack, isPlaying, pause, resume, next, prev,
    currentTime, duration, seek, volume, setVolume,
    isMuted, toggleMute, shuffle, toggleShuffle, repeatMode, toggleRepeat,
    autoplay, toggleAutoplay,
  } = usePlayer();

  const { userId } = useOptionalAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("player");

  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const { data: checkData } = useCheckFavorite(
    { trackId: currentTrack?.id || "", userId: userId || "" },
    { query: { enabled: !!currentTrack && !!userId, queryKey: getCheckFavoriteQueryKey({ trackId: currentTrack?.id || "", userId: userId || "" }) } }
  );

  const isFavorite = checkData?.isFavorite || false;

  const { lyrics, loading: lyricsLoading, error: lyricsError } = useLyrics(
    tab === "lyrics" ? (currentTrack?.title || "") : "",
    tab === "lyrics" ? (currentTrack?.artist || "") : ""
  );

  const handleToggleFavorite = () => {
    if (!userId || !currentTrack) return;
    const params = { trackId: currentTrack.id, userId };
    if (isFavorite) {
      removeFavorite.mutate(params, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getCheckFavoriteQueryKey(params) }) });
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
          className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
        >
          {/* Animated blurred background */}
          <motion.div 
            key={currentTrack.id}
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1.05 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 bg-cover bg-center blur-3xl saturate-150 pointer-events-none" 
            style={{ backgroundImage: `url(${currentTrack.thumbnail})`, opacity: 0.15 }} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/40 pointer-events-none" />

          {/* Animated equalizer bars at top */}
          {isPlaying && (
            <div className="absolute top-0 left-0 right-0 h-1 flex gap-px overflow-hidden pointer-events-none">
              {Array.from({ length: 80 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="flex-1 bg-primary/60"
                  animate={{ scaleY: [0.2, Math.random() * 0.8 + 0.2, 0.2] }}
                  transition={{ repeat: Infinity, duration: 0.4 + Math.random() * 0.6, delay: Math.random() * 0.5 }}
                  style={{ transformOrigin: "bottom" }}
                />
              ))}
            </div>
          )}

          <div className="relative flex-1 flex flex-col max-w-md mx-auto w-full p-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between py-4 shrink-0">
              <button onClick={onClose} className="p-2 -ml-2 text-white/70 hover:text-white transition-colors">
                <ChevronDown className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTab("player")}
                  className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors", tab === "player" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
                >
                  Now Playing
                </button>
                <button
                  onClick={() => setTab("lyrics")}
                  className={cn("px-3 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1", tab === "lyrics" ? "bg-white/10 text-white" : "text-white/40 hover:text-white")}
                >
                  <Mic className="w-3 h-3" /> Lyrics
                </button>
              </div>
              <div className="w-6" />
            </div>

            <AnimatePresence mode="wait">
              {tab === "player" ? (
                <motion.div
                  key="player"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col items-center justify-center py-4 overflow-y-auto"
                >
                  {/* Album art */}
                  <motion.div 
                    className="w-full aspect-square rounded-2xl overflow-hidden shadow-2xl mb-8 relative"
                    animate={isPlaying ? { boxShadow: ["0 25px 60px rgba(230,57,70,0.3)", "0 25px 60px rgba(230,57,70,0.6)", "0 25px 60px rgba(230,57,70,0.3)"] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <motion.img
                      key={currentTrack.id}
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                      initial={{ scale: 1.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.5 }}
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    )}
                  </motion.div>

                  {/* Title + favorite */}
                  <div className="w-full flex items-center justify-between mb-6">
                    <div className="flex-1 min-w-0 pr-4">
                      <motion.h2
                        key={currentTrack.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-2xl font-bold text-white truncate"
                      >
                        {currentTrack.title}
                      </motion.h2>
                      <motion.p
                        key={currentTrack.artist}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="text-lg text-white/60 truncate"
                      >
                        {currentTrack.artist}
                      </motion.p>
                    </div>
                    {userId && (
                      <motion.button
                        onClick={handleToggleFavorite}
                        whileTap={{ scale: 0.8 }}
                        whileHover={{ scale: 1.15 }}
                        className="p-2 text-white"
                      >
                        <Heart className={cn("w-6 h-6 transition-colors", isFavorite ? "fill-primary text-primary" : "text-white/70")} />
                      </motion.button>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="w-full mb-6">
                    <div className="h-1.5 bg-white/10 rounded-full cursor-pointer group relative overflow-hidden" onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      seek((e.clientX - rect.left) / rect.width * duration);
                    }}>
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary to-primary/80 relative rounded-full"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs font-medium text-white/50">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="w-full flex items-center justify-between mb-6">
                    <motion.button whileTap={{ scale: 0.8 }} onClick={toggleShuffle} className={cn("text-white/50 hover:text-white transition-colors", shuffle && "text-primary")}>
                      <Shuffle className="w-5 h-5" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.8 }} onClick={prev} className="text-white hover:scale-110 transition-transform">
                      <SkipBack className="w-8 h-8 fill-current" />
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      onClick={isPlaying ? pause : resume} 
                      className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                      animate={isPlaying ? { boxShadow: ["0 0 20px rgba(255,255,255,0.2)", "0 0 40px rgba(255,255,255,0.4)", "0 0 20px rgba(255,255,255,0.2)"] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.8 }} onClick={next} className="text-white hover:scale-110 transition-transform">
                      <SkipForward className="w-8 h-8 fill-current" />
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.8 }} onClick={toggleRepeat} className={cn("text-white/50 hover:text-white transition-colors", repeatMode !== "none" && "text-primary")}>
                      <Repeat className="w-5 h-5" />
                    </motion.button>
                  </div>

                  {/* Volume + Autoplay */}
                  <div className="w-full flex items-center gap-4">
                    <button onClick={toggleMute} className="text-white/50 hover:text-white transition-colors shrink-0">
                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer group" onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setVolume((e.clientX - rect.left) / rect.width);
                    }}>
                      <div className="h-full bg-white/60 rounded-full" style={{ width: `${isMuted ? 0 : volume * 100}%` }} />
                    </div>
                    <button
                      onClick={toggleAutoplay}
                      className={cn("flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full transition-colors shrink-0", autoplay ? "bg-primary/20 text-primary" : "text-white/30 hover:text-white/60")}
                    >
                      <Radio className="w-3 h-3" />
                      Autoplay
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="lyrics"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 overflow-y-auto py-4"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <img src={currentTrack.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                      <p className="text-xs text-white/50 truncate">{currentTrack.artist}</p>
                    </div>
                  </div>

                  {lyricsLoading && (
                    <div className="flex flex-col gap-2 animate-pulse">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="h-4 bg-white/10 rounded-full" style={{ width: `${40 + Math.random() * 50}%` }} />
                      ))}
                    </div>
                  )}

                  {lyricsError && !lyricsLoading && (
                    <div className="text-center py-16">
                      <Mic className="w-12 h-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/40 text-sm">Lyrics not available for this track</p>
                    </div>
                  )}

                  {lyrics && (
                    <motion.pre
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white/80 font-sans text-sm leading-8 whitespace-pre-wrap"
                    >
                      {lyrics}
                    </motion.pre>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
