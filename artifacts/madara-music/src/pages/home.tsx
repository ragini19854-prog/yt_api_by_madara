import { useGetTrending, useGetGenres } from "@workspace/api-client-react";
import { TrackCard } from "../components/TrackCard";
import { GenreCard } from "../components/GenreCard";
import { Play } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: trendingTracks, isLoading: loadingTrending } = useGetTrending({ limit: 12 });
  const { data: genres, isLoading: loadingGenres } = useGetGenres();
  const { playAll } = usePlayer();

  const heroTrack = trendingTracks?.[0];

  return (
    <div className="p-6 md:p-8 space-y-12">
      {/* Hero Section */}
      {heroTrack ? (
        <div className="relative h-[400px] rounded-3xl overflow-hidden group">
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
            style={{ backgroundImage: `url(${heroTrack.thumbnail})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
          
          <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full max-w-3xl">
            <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-bold uppercase tracking-widest rounded-full mb-4 inline-block backdrop-blur-md border border-primary/20">
              Featured Track
            </span>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
              {heroTrack.title}
            </h1>
            <p className="text-lg text-white/70 mb-8 font-medium">{heroTrack.artist}</p>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => playAll(trendingTracks, 0)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-full font-bold transition-all hover:scale-105 shadow-[0_0_20px_rgba(230,57,70,0.4)]"
              >
                <Play className="w-5 h-5 fill-current" />
                Listen Now
              </button>
            </div>
          </div>
        </div>
      ) : loadingTrending ? (
        <Skeleton className="h-[400px] w-full rounded-3xl bg-white/5" />
      ) : null}

      {/* Trending Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Trending Now</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
          {loadingTrending ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="aspect-square w-full rounded-xl bg-white/5" />
                <Skeleton className="h-4 w-3/4 bg-white/5" />
                <Skeleton className="h-3 w-1/2 bg-white/5" />
              </div>
            ))
          ) : trendingTracks?.map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      </section>

      {/* Genres Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Explore Genres</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {loadingGenres ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl bg-white/5" />
            ))
          ) : genres?.slice(0, 12).map((genre) => (
            <GenreCard key={genre.id} genre={genre} />
          ))}
        </div>
      </section>
    </div>
  );
}
