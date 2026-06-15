import { useParams } from "wouter";
import { useEffect, useState } from "react";
import { Play, ListMusic, Clock } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Track } from "@workspace/api-client-react";

interface SharedPlaylistData {
  id: number;
  name: string;
  description?: string;
  coverUrl?: string;
  tracks: Track[];
}

export default function SharedPlaylist() {
  const params = useParams();
  const token = (params as Record<string, string>)["token"];
  const { play, playAll, currentTrack, isPlaying } = usePlayer();
  const [playlist, setPlaylist] = useState<SharedPlaylistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/playlists/share/${token}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json() as Promise<SharedPlaylistData>;
      })
      .then((data) => {
        if (data) setPlaylist(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
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

  if (notFound || !playlist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <ListMusic className="w-16 h-16 text-white/20 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Playlist not found</h1>
        <p className="text-white/50">This playlist may be private or the link has expired.</p>
      </div>
    );
  }

  const isPlayingThis = currentTrack && playlist.tracks.some(t => t.id === currentTrack.id) && isPlaying;

  return (
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
          <div className="w-48 h-48 md:w-64 md:h-64 shrink-0 shadow-2xl rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
            {playlist.coverUrl ? (
              <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
            ) : playlist.tracks[0] ? (
              <img src={playlist.tracks[0].thumbnail} alt={playlist.name} className="w-full h-full object-cover" />
            ) : (
              <ListMusic className="w-20 h-20 text-white/20" />
            )}
          </div>
          <div className="flex-1 w-full">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 block">Shared Playlist</span>
            <h1 className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tight line-clamp-2">{playlist.name}</h1>
            {playlist.description && <p className="text-white/60 mb-6 max-w-2xl">{playlist.description}</p>}
            <div className="flex items-center gap-4">
              <motion.button 
                whileTap={{ scale: 0.95 }}
                onClick={() => playlist.tracks.length > 0 && playAll(playlist.tracks)}
                className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_0_30px_rgba(230,57,70,0.4)] hover:scale-105 transition-transform"
              >
                <Play className="w-6 h-6 fill-current ml-1" />
              </motion.button>
              <span className="text-white/60 font-medium">{playlist.tracks.length} tracks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tracks */}
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {playlist.tracks.length === 0 ? (
          <div className="text-center py-20 text-white/50 border border-dashed border-white/10 rounded-xl bg-white/5">
            No tracks in this playlist.
          </div>
        ) : (
          <div className="flex flex-col w-full">
            <div className="grid grid-cols-[40px_1fr_60px_60px] gap-4 px-4 py-3 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-white/50">
              <div className="text-center">#</div>
              <div>Title</div>
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
                    className="grid grid-cols-[40px_1fr_60px_60px] gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group items-center"
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
                    <div className="text-sm text-white/50 text-center">{formatTime(track.duration)}</div>
                    <div />
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
