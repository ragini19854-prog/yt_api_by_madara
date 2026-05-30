import { useParams } from "wouter";
import { useGetPlaylist, getGetPlaylistQueryKey } from "@workspace/api-client-react";
import { Play, Pause, ListMusic, Clock, Heart } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function PlaylistDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { play, playAll, pause, currentTrack, isPlaying } = usePlayer();

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
    <div className="pb-8">
      {/* Header */}
      <div className="relative pt-24 pb-8 px-6 md:px-8 bg-gradient-to-b from-white/10 to-background border-b border-white/5">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xl -z-10" />
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-end max-w-6xl mx-auto">
          <div className="w-48 h-48 md:w-64 md:h-64 shrink-0 shadow-2xl rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
            {playlist.coverUrl ? (
              <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
            ) : (
              <ListMusic className="w-20 h-20 text-white/20" />
            )}
          </div>
          <div className="flex-1 w-full">
            <span className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2 block">Playlist</span>
            <h1 className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tight line-clamp-2">{playlist.name}</h1>
            <p className="text-white/60 mb-6 max-w-2xl">{playlist.description}</p>
            <div className="flex items-center gap-4">
              <button 
                onClick={handlePlayAll}
                className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-[0_0_30px_rgba(230,57,70,0.4)] hover:scale-105 transition-transform"
              >
                <Play className="w-6 h-6 fill-current ml-1" />
              </button>
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
                  <div 
                    key={`${track.id}-${index}`}
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
                      <button className="text-white/50 hover:text-white" onClick={(e) => {
                        e.stopPropagation();
                        // Like logic here if needed
                      }}>
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
