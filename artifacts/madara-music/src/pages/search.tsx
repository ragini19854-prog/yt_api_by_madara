import { useState } from "react";
import { useSearchMusic, useGetMusicByGenre } from "@workspace/api-client-react";
import { TrackCard } from "../components/TrackCard";
import { Search as SearchIcon } from "lucide-react";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialGenre = searchParams.get("genre");
  
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState(initialGenre || "");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Simple debounce
  useState(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  });

  const { data: searchResults, isLoading: isSearching } = useSearchMusic(
    { q: debouncedQuery, limit: 20 },
    { query: { enabled: debouncedQuery.length > 0, queryKey: ["searchMusic", debouncedQuery] } }
  );

  const { data: genreResults, isLoading: isLoadingGenre } = useGetMusicByGenre(
    { genre, limit: 20 },
    { query: { enabled: genre.length > 0 && debouncedQuery.length === 0, queryKey: ["getMusicByGenre", genre] } }
  );

  const tracks = debouncedQuery.length > 0 ? searchResults : (genre.length > 0 ? genreResults : []);
  const isLoading = isSearching || isLoadingGenre;

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="sticky top-0 z-20 pt-4 pb-6 bg-background/80 backdrop-blur-xl">
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
          <input
            type="text"
            placeholder="Search for songs, artists, or albums..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-6 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-lg"
          />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-white mb-6">
          {debouncedQuery ? `Results for "${debouncedQuery}"` : genre ? `${genre} Tracks` : "Search something"}
        </h2>
        
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="aspect-square w-full rounded-xl bg-white/5" />
                <Skeleton className="h-4 w-3/4 bg-white/5" />
                <Skeleton className="h-3 w-1/2 bg-white/5" />
              </div>
            ))}
          </div>
        ) : tracks && tracks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {tracks.map((track) => (
              <TrackCard key={track.id} track={track} />
            ))}
          </div>
        ) : debouncedQuery || genre ? (
          <div className="text-center py-20">
            <p className="text-white/50 text-lg">No tracks found. Try a different search.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
