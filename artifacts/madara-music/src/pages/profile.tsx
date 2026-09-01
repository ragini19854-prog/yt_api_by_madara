import { useAuth, useUser, SignInButton } from "@clerk/react";
import { Play, Headphones, ListMusic, Heart, User, LogOut } from "lucide-react";
import { useLocalLibrary } from "../lib/localLibrary";
import { clerkEnabled } from "../lib/clerk";

export default function Profile() {
  const { history, getStats } = useLocalLibrary();
  const stats = getStats();

  return (
    <div className="p-6 md:p-8 space-y-12 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center gap-8 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-background shadow-2xl relative z-10 shrink-0 bg-white/10 flex items-center justify-center">
          <ProfileAvatar />
        </div>
        <div className="flex-1 text-center md:text-left relative z-10">
          <ProfileIdentity />
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-6">Your Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Play />} label="Total Plays" value={stats.totalPlays} />
          <StatCard icon={<Headphones />} label="Unique Tracks" value={stats.uniqueTracks} />
          <StatCard icon={<ListMusic />} label="Playlists" value={stats.playlistCount} />
          <StatCard icon={<Heart />} label="Favorites" value={stats.favoriteCount} />
        </div>
      </div>

      {/* Top Artists */}
      {stats.topArtists.length > 0 && (
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
          {history.length > 0 ? (
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

function ProfileAvatar() {
  return clerkEnabled ? <ClerkProfileAvatar /> : <User className="w-12 h-12 text-white/50" />;
}

function ClerkProfileAvatar() {
  const { user } = useUser();

  return user?.imageUrl ? (
    <img
      src={user.imageUrl}
      alt={user.fullName || "Profile"}
      className="w-full h-full object-cover"
    />
  ) : (
    <User className="w-12 h-12 text-white/50" />
  );
}

function ProfileIdentity() {
  return clerkEnabled ? <ClerkProfileIdentity /> : <GuestProfileIdentity />;
}

function ClerkProfileIdentity() {
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();

  return (
    <>
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
        {user?.fullName || "Listener"}
      </h1>
      <p className="text-white/50 mb-6">
        {user?.primaryEmailAddress?.emailAddress || "Your music stays on this device."}
      </p>
      {isSignedIn ? (
        <button
          onClick={() => signOut()}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mx-auto md:mx-0"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      ) : (
        <SignInButton mode="modal">
          <button className="flex items-center gap-2 text-sm text-primary hover:text-white transition-colors mx-auto md:mx-0">
            <User className="w-4 h-4" /> Sign in to sync account
          </button>
        </SignInButton>
      )}
    </>
  );
}

function GuestProfileIdentity() {
  return (
    <>
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Guest Listener</h1>
      <p className="text-white/50 mb-6">Your music stays on this device.</p>
      <span className="flex items-center gap-2 text-sm text-white/40 mx-auto md:mx-0">
        <User className="w-4 h-4" /> Guest mode · local library
      </span>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 text-primary flex items-center justify-center mb-4">
        {icon}
      </div>
      <div className="text-3xl font-black text-white mb-1">
        {value || 0}
      </div>
      <div className="text-sm text-white/50 uppercase tracking-wider font-semibold">{label}</div>
    </div>
  );
}
