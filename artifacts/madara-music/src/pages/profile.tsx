import { useAuth, useUser, SignInButton } from "@clerk/react";
import { useGetUserStats, getGetUserStatsQueryKey, useGetHistory } from "@workspace/api-client-react";
import { Play, Headphones, ListMusic, Heart, User, LogOut } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackCard } from "../components/TrackCard";

export default function Profile() {
  const { isSignedIn, userId, signOut } = useAuth();
  const { user } = useUser();

  const { data: stats, isLoading: loadingStats } = useGetUserStats(
    userId || "",
    { query: { enabled: !!userId, queryKey: getGetUserStatsQueryKey(userId || "") } }
  );

  const { data: history, isLoading: loadingHistory } = useGetHistory(
    { userId: userId || "", limit: 6 },
    { query: { enabled: !!userId, queryKey: ["getHistory", userId] } }
  );

  if (!isSignedIn) {
    return (
      <div className="p-6 md:p-12 flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-8 border border-white/10">
          <User className="w-10 h-10 text-white/50" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Your Profile</h1>
        <p className="text-white/60 mb-8 leading-relaxed">Sign in to view your listening statistics, recent history, and manage your account.</p>
        <SignInButton mode="modal">
          <button className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-full transition-transform hover:scale-105 shadow-[0_0_20px_rgba(230,57,70,0.4)]">
            Sign In
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center gap-8 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-2xl relative z-10 shrink-0 bg-white/10 flex items-center justify-center">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt={user.fullName || "Profile"} className="w-full h-full object-cover" />
          ) : (
            <User className="w-12 h-12 text-white/50" />
          )}
        </div>
        <div className="flex-1 text-center md:text-left relative z-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{user?.fullName || "User"}</h1>
          <p className="text-white/50 mb-6">{user?.primaryEmailAddress?.emailAddress}</p>
          <button onClick={() => signOut()} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mx-auto md:mx-0">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-6">Your Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Play />} label="Total Plays" value={stats?.totalPlays} loading={loadingStats} />
          <StatCard icon={<Headphones />} label="Unique Tracks" value={stats?.uniqueTracks} loading={loadingStats} />
          <StatCard icon={<ListMusic />} label="Playlists" value={stats?.playlistCount} loading={loadingStats} />
          <StatCard icon={<Heart />} label="Favorites" value={stats?.favoriteCount} loading={loadingStats} />
        </div>
      </div>

      {/* Top Artists */}
      {stats?.topArtists && stats.topArtists.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight mb-6">Top Artists</h2>
          <div className="flex flex-wrap gap-3">
            {stats.topArtists.map((artist, i) => (
              <span key={i} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors cursor-default">
                {artist}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent History */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Recently Played</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {loadingHistory ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-xl bg-white/5" />
            ))
          ) : history && history.length > 0 ? (
            history.map((record) => (
              <div key={record.id} className="flex flex-col gap-2">
                <div className="aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/5">
                  <img src={record.thumbnail} alt={record.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 px-1">
                  <p className="text-sm font-medium text-white truncate">{record.title}</p>
                  <p className="text-xs text-white/50 truncate">{record.artist}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-white/50 bg-white/5 rounded-xl border border-white/10 border-dashed">
              No recent listening history.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value?: number; loading: boolean }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 text-primary flex items-center justify-center mb-4">
        {icon}
      </div>
      <div className="text-3xl font-black text-white mb-1">
        {loading ? <Skeleton className="h-8 w-16 bg-white/10 mx-auto" /> : (value || 0)}
      </div>
      <div className="text-sm text-white/50 uppercase tracking-wider font-semibold">{label}</div>
    </div>
  );
}
