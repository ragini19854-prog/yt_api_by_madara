import { useParams } from "wouter";
import { useGetPlaylist, getGetPlaylistQueryKey } from "@workspace/api-client-react";
import { Play, Pause, ListMusic, Clock, Heart, Share2, Check, Lock, Globe } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function ShareModal({ playlistId, onClose }: { playlistId: number; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/share`, { method: "POST" });
      const data = await res.json() as { shareToken: string };
      setShareToken(data.shareToken);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = shareToken ? `${window.location.origin}/shared/${shareToken}` : null;

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-[hsl(240,10%,8%)] border border-white/10 rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-white">Share Playlist</h3>
            <p className="text-xs text-white/50">Anyone with the link can view</p>
          </div>
        </div>

        {!shareToken ? (
          <button
            onClick={handleShare}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? "Generating link..." : "Generate Share Link"}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10">
              <p className="flex-1 text-xs text-white/70 truncate">{shareUrl}</p>
              <button onClick={handleCopy} className="shrink-0 p-1 text-primary hover:text-primary/80 transition-colors">
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-center text-white/40">
              {copied ? "✓ Link copied!" : "Click the icon to copy link"}
            </p>
          </div>
        )}

        <button onClick={onClose} className="w-full mt-4 py-2 text-sm text-white/40 hover:text-white transition-colors">
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

export default function PlaylistDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { play, playAll, pause, currentTrack, isPlaying } = usePlayer();
  const [shareOpen, setShareOpen] = useState(false);

  const { data: playlist, isLoading } = useGetPlaylist(
    id,
    { query: { enabled: !!id, queryKey: getGetPlaylistQueryKey(id) } }
  );

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row gap-8">
          <Skeleton className="w-64 h-64 rounded-xl bg-white/5" />
          <div className="flex-1 space-y-4 pt-4">
            <Skeleton className="w-24 h-4 bg-white/5" />
            <Skeleton className="w-3/4 h-12 bg-white/5" />
            <Skeleton className="w-1/2 h-4 bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return <div className="p-12 text-center text-white/50">Playlist not found</div>;
  }

  const isPlayingThisPlaylist = currentTrack && playlist.tracks.some(t => t.id === currentTrack.id) && isPlaying;

  const handlePlayAll = () => {
    if (playlist.tracks.length > 0) {
      playAll(playlist.tracks);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      <div className="pb-8">
        {/* Header */}
        <div className="relative pt-24 pb-8 px-6 md:px-8 bg-gradient-to-b from-white/10 to-background border-b border-white/5">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xl -z-10" />
          {playlist.tracks[0] && (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-10 blur-2xl scale-110 -z-20 pointer-events-none"
              style={{ backgroundImage: `url(${playlist.tracks[0].thumbnail})` }}
            />
          )}
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-end max-w-6xl mx-auto">
            <motion.div
              className="w-48 h-48 md:w-64 md:h-64 shrink-0 shadow-2xl rounded-xl overflow-hidden bg-white/5 flex items-center justify-center"
              whileHover={{ scale: 1.02 }}
            >
              {playlist.coverUrl ? (
                <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
              ) : playlist.tracks[0] ? (
                <img src={playlist.tracks[0].thumbnail} alt={playlist.name} className="w-full h-full object-cover" />
              ) : (
                <ListMusic className="w-20 h-20 text-white/20" />
              )}
            </motion.div>
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-white/60">Playlist</span>
                {(playlist as { isPublic?: boolean }).isPublic ? (
                  <span className="flex items-center gap-1 text-xs text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                    <Globe className="w-3 h-3" /> Public
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tight line-clamp-2">{playlist.name}</h1>
              <p className="text-white/60 mb-6 max-w-2xl">{playlist.description}</p>
              <div className="flex items-center gap-3">
                <motion.button 
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlayAll}
                  className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_0_30px_rgba(230,57,70,0.4)] hover:scale-105 transition-transform"
                >
                  {isPlayingThisPlaylist ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShareOpen(true)}
                  className="w-12 h-12 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                  title="Share playlist"
                >
                  <Share2 className="w-5 h-5" />
                </motion.button>
                <span className="text-white/60 font-medium">{playlist.tracks.length} tracks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tracks List */}
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          {playlist.tracks.length === 0 ? (
            <div className="text-center py-20 text-white/50 border border-dashed border-white/10 rounded-xl bg-white/5">
              No tracks in this playlist yet.
            </div>
          ) : (
            <div className="flex flex-col w-full">
              <div className="grid grid-cols-[40px_1fr_minmax(120px,200px)_60px_60px] gap-4 px-4 py-3 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-white/50">
                <div className="text-center">#</div>
                <div>Title</div>
                <div className="hidden md:block">Album</div>
                <div className="text-center"><Clock className="w-4 h-4 inline-block" /></div>
                <div></div>
              </div>
              
              <div className="mt-2 space-y-1">
                {playlist.tracks.map((track, index) => {
                  const isCurrent = currentTrack?.id === track.id;
                  
                  return (
                    <motion.div 
                      key={`${track.id}-${index}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => play(track)}
                      className="grid grid-cols-[40px_1fr_minmax(120px,200px)_60px_60px] gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group items-center"
                    >
                      <div className="text-center text-white/50 group-hover:hidden">
                        {isCurrent ? <Play className="w-4 h-4 fill-primary text-primary mx-auto animate-pulse" /> : index + 1}
                      </div>
                      <div className="text-center hidden group-hover:block">
                        <Play className="w-4 h-4 fill-white text-white mx-auto" />
                      </div>
                      
                      <div className="flex items-center gap-3 min-w-0">
                        <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                        <div className="flex flex-col min-w-0">
                          <span className={cn("font-medium truncate", isCurrent ? "text-primary" : "text-white")}>{track.title}</span>
                          <span className="text-sm text-white/50 truncate">{track.artist}</span>
                        </div>
                      </div>
                      
                      <div className="hidden md:block text-sm text-white/50 truncate">
                        {track.album || "Unknown Album"}
                      </div>
                      
                      <div className="text-sm text-white/50 text-center">
                        {formatTime(track.duration)}
                      </div>
                      
                      <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-white/50 hover:text-white" onClick={(e) => { e.stopPropagation(); }}>
                          <Heart className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {shareOpen && <ShareModal playlistId={id} onClose={() => setShareOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
