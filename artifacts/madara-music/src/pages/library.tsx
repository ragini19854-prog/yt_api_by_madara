import { SignInButton } from "@clerk/react";
import { useGetPlaylists, useGetFavorites, getGetPlaylistsQueryKey } from "@workspace/api-client-react";
import { PlaylistCard } from "../components/PlaylistCard";
import { TrackCard } from "../components/TrackCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Play } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { useOptionalAuth } from "../contexts/AuthContext";
import { clerkEnabled } from "@/lib/clerk";

export default function Library() {
  const { isSignedIn, userId } = useOptionalAuth();
  const { playAll } = usePlayer();

  const { data: playlists, isLoading: loadingPlaylists } = useGetPlaylists(
    { userId: userId || "" },
    { query: { enabled: !!userId, queryKey: getGetPlaylistsQueryKey({ userId: userId || "" }) } }
  );

  const { data: favorites, isLoading: loadingFavorites } = useGetFavorites(
    { userId: userId || "" },
    { query: { enabled: !!userId, queryKey: ["getFavorites", userId] } }
  );

  if (!isSignedIn) {
    return (
      <div className="p-6 md:p-12 flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(230,57,70,0.2)]">
          <Play className="w-10 h-10 text-primary translate-x-1" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Your Library Awaits</h1>
        <p className="text-white/60 mb-8 leading-relaxed">Sign in to save your favorite tracks, create custom playlists, and sync your music across all devices.</p>
        {clerkEnabled ? (
          <SignInButton mode="modal">
            <button className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 shadow-[0_0_20px_rgba(230,57,70,0.4)]">
              Sign In to Access
            </button>
          </SignInButton>
        ) : (
          <p className="text-white/40 text-sm">Sign-in isn't configured for this deployment yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-12 max-w-7xl mx-auto">
      {/* Liked Songs Quick Access */}
      {favorites && favorites.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight">Liked Songs</h2>
            <button 
              onClick={() => playAll(favorites)}
              className="text-sm font-medium text-primary hover:text-white transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" /> Play All
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {favorites.slice(0, 6).map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        </section>
      )}

      {/* Playlists */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Your Playlists</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {loadingPlaylists ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="aspect-square w-full rounded-xl bg-white/5" />
                <Skeleton className="h-4 w-3/4 bg-white/5" />
                <Skeleton className="h-3 w-1/2 bg-white/5" />
              </div>
            ))
          ) : playlists && playlists.length > 0 ? (
            playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))
          ) : (
            <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
              <p className="text-white/50">You don't have any playlists yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
