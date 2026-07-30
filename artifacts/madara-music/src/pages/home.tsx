import { useState } from "react";
import { useGetTrending, useGetGenres } from "@workspace/api-client-react";
import { TrackCard } from "../components/TrackCard";
import { GenreCard } from "../components/GenreCard";
import { Play, Search, Bot, Youtube, Music2, ArrowRight } from "lucide-react";
import { usePlayer } from "../contexts/PlayerContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function Home() {
  const { data: rawTrendingTracks, isLoading: loadingTrending } = useGetTrending({ limit: 12 });
  const trendingTracks = Array.isArray(rawTrendingTracks) ? rawTrendingTracks : undefined;
  const { data: rawGenres, isLoading: loadingGenres } = useGetGenres();
  const genres = Array.isArray(rawGenres) ? rawGenres : undefined;
  const { playAll } = usePlayer();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const heroTrack = trendingTracks?.[0];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-12">

      {/* ── Search bar ── */}
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search any song, artist or album…"
          className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-36 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-lg"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition-all"
        >
          Search
        </button>
      </form>

      {/* ── Source badges ── */}
      <div className="flex justify-center gap-3 -mt-6">
        <span className="flex items-center gap-1.5 text-white/40 text-xs">
          <Music2 className="w-3 h-3" /> iTunes
        </span>
        <span className="text-white/20 text-xs">+</span>
        <span className="flex items-center gap-1.5 text-white/40 text-xs">
          <Youtube className="w-3 h-3 text-red-400" /> YouTube (full songs, no API)
        </span>
      </div>

      {/* ── Hero ── */}
      {heroTrack ? (
        <div className="relative h-[380px] rounded-3xl overflow-hidden group">
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
            <button
              onClick={() => playAll(trendingTracks!, 0)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-full font-bold transition-all hover:scale-105 shadow-[0_0_20px_rgba(230,57,70,0.4)]"
            >
              <Play className="w-5 h-5 fill-current" />
              Listen Now
            </button>
          </div>
        </div>
      ) : loadingTrending ? (
        <Skeleton className="h-[380px] w-full rounded-3xl bg-white/5" />
      ) : null}

      {/* ── Trending ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Trending Now</h2>
          <button
            onClick={() => navigate("/search")}
            className="text-sm text-white/40 hover:text-primary transition-colors flex items-center gap-1"
          >
            See all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
          {loadingTrending
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3">
                  <Skeleton className="aspect-square w-full rounded-xl bg-white/5" />
                  <Skeleton className="h-4 w-3/4 bg-white/5" />
                  <Skeleton className="h-3 w-1/2 bg-white/5" />
                </div>
              ))
            : trendingTracks?.map((track) => (
                <TrackCard key={track.id} track={track} />
              ))}
        </div>
      </section>

      {/* ── Bot promo banner ── */}
      <section
        onClick={() => navigate("/bot")}
        className="cursor-pointer rounded-2xl border border-white/10 bg-gradient-to-r from-primary/10 via-white/3 to-indigo-500/10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-5 hover:border-primary/30 transition-all group"
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 border border-primary/20 shrink-0 group-hover:scale-110 transition-transform">
          <Bot className="w-7 h-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-bold text-lg">Free Discord &amp; Telegram Music Bots</h3>
            <span className="text-xs bg-primary/20 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-medium">Free</span>
          </div>
          <p className="text-white/50 text-sm">
            Copy-paste bot code powered by Madara Music. Plays full songs, 24/7 uptime, no paid APIs.
            Run 100+ bots simultaneously.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["discord.py included", "telegram.py included", "requirements.txt", "Anti-tamper", "24/7 keep-alive"].map((tag) => (
              <span key={tag} className="text-xs bg-white/5 border border-white/10 text-white/50 px-2.5 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all shrink-0">
          Get Bot Code <ArrowRight className="w-4 h-4" />
        </div>
      </section>

      {/* ── Genres ── */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Explore Genres</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {loadingGenres
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl bg-white/5" />
              ))
            : genres?.slice(0, 12).map((genre) => (
                <GenreCard key={genre.id} genre={genre} />
              ))}
        </div>
      </section>

    </div>
  );
}
