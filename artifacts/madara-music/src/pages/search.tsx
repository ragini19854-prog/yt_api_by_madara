import { useState, useEffect } from "react";
import { useSearchMusic, useSearchYoutube } from "@workspace/api-client-react";
import { TrackCard } from "../components/TrackCard";
import { Search as SearchIcon, Youtube, Music2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Search() {
  const searchParams = new URLSearchParams(window.location.search);
  const initialGenre = searchParams.get("genre");

  const [query, setQuery] = useState("");
  const [genre] = useState(initialGenre || "");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [tab, setTab] = useState<"all" | "itunes" | "youtube">("all");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(handler);
  }, [query]);

  const enabled = debouncedQuery.length > 0;

  const { data: itunesResults, isLoading: isLoadingItunes } = useSearchMusic(
    { q: debouncedQuery, limit: 20 },
    { query: { enabled, queryKey: ["searchMusic", debouncedQuery] } },
  );

  const { data: youtubeResults, isLoading: isLoadingYoutube } = useSearchYoutube(
    { q: debouncedQuery, limit: 10 },
    { query: { enabled, queryKey: ["searchYoutube", debouncedQuery] } },
  );

  const itTracks = itunesResults ?? [];
  const ytTracks = youtubeResults ?? [];

  const visibleItunes =
    tab === "all" || tab === "itunes" ? itTracks : [];
  const visibleYoutube =
    tab === "all" || tab === "youtube" ? ytTracks : [];

  const isLoading = isLoadingItunes || isLoadingYoutube;
  const hasResults = itTracks.length > 0 || ytTracks.length > 0;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Search bar */}
      <div className="sticky top-0 z-20 pt-4 pb-5 bg-background/80 backdrop-blur-xl">
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="text"
            placeholder="Search songs, artists, albums — iTunes + YouTube"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-6 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-lg"
          />
        </div>

        {/* Source filter tabs — only visible when searching */}
        {enabled && (
          <div className="flex gap-2 mt-4">
            {(["all", "itunes", "youtube"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                  tab === t
                    ? "bg-primary text-white shadow-lg"
                    : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                {t === "youtube" && <Youtube className="w-3.5 h-3.5" />}
                {t === "itunes" && <Music2 className="w-3.5 h-3.5" />}
                {t === "all" ? "All Sources" : t === "itunes" ? "Madara / iTunes" : "YouTube"}
                {t === "youtube" && ytTracks.length > 0 && (
                  <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                    {ytTracks.length}
                  </span>
                )}
                {t === "itunes" && itTracks.length > 0 && (
                  <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
                    {itTracks.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {!enabled ? (
        <div className="text-center py-24 text-white/30">
          <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-xl">Search across iTunes and YouTube</p>
          <p className="text-sm mt-1 opacity-60">Type anything above to start</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-8">
          {[0, 1].map((s) => (
            <div key={s}>
              <Skeleton className="h-5 w-40 bg-white/5 mb-4 rounded" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-3">
                    <Skeleton className="aspect-square w-full rounded-xl bg-white/5" />
                    <Skeleton className="h-4 w-3/4 bg-white/5" />
                    <Skeleton className="h-3 w-1/2 bg-white/5" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : !hasResults ? (
        <div className="text-center py-20">
          <p className="text-white/50 text-lg">No results for "{debouncedQuery}"</p>
          <p className="text-white/30 text-sm mt-1">Try a different spelling or artist name</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* iTunes / Madara results */}
          {visibleItunes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Music2 className="w-4 h-4 text-primary" />
                <h2 className="text-lg font-bold text-white">
                  On Madara Music
                </h2>
                <span className="text-white/30 text-sm">{itTracks.length} tracks</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {visibleItunes.map((track) => (
                  <TrackCard key={track.id} track={track} />
                ))}
              </div>
            </section>
          )}

          {/* YouTube results */}
          {visibleYoutube.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Youtube className="w-4 h-4 text-red-500" />
                <h2 className="text-lg font-bold text-white">From YouTube</h2>
                <span className="text-white/30 text-sm">{ytTracks.length} videos</span>
                <span className="ml-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                  No API key
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {visibleYoutube.map((track) => (
                  <TrackCard key={track.id} track={track} showYoutubeBadge />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
