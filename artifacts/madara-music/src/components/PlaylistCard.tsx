import { Playlist } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ListMusic } from "lucide-react";

interface PlaylistCardProps {
  playlist: Playlist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  return (
    <Link href={`/playlist/${playlist.id}`}>
      <div className="group relative flex flex-col p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(123,45,139,0.15)] border border-white/5">
        <div className="relative aspect-square rounded-lg overflow-hidden mb-4 bg-white/10 flex items-center justify-center shadow-lg">
          {playlist.coverUrl ? (
            <img 
              src={playlist.coverUrl} 
              alt={playlist.name} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            />
          ) : (
            <ListMusic className="w-12 h-12 text-white/30" />
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <h3 className="font-semibold text-white truncate group-hover:text-primary transition-colors">{playlist.name}</h3>
          <p className="text-sm text-white/60 truncate mt-1">{playlist.trackCount || 0} tracks</p>
        </div>
      </div>
    </Link>
  );
}
