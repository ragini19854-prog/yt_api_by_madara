import { Genre } from "@workspace/api-client-react";
import { Link } from "wouter";

interface GenreCardProps {
  genre: Genre;
}

const GENRE_COLORS: Record<string, string> = {
  Pop: "from-pink-500 to-rose-500",
  Rock: "from-blue-500 to-cyan-500",
  "Hip Hop": "from-purple-500 to-indigo-500",
  "R&B": "from-orange-500 to-red-500",
  Electronic: "from-emerald-500 to-teal-500",
  Classical: "from-amber-500 to-orange-500",
  Jazz: "from-violet-500 to-purple-500",
  Country: "from-lime-500 to-green-500",
};

export function GenreCard({ genre }: GenreCardProps) {
  const gradient = GENRE_COLORS[genre.name] || "from-gray-500 to-slate-500";

  return (
    <Link href={`/search?genre=${encodeURIComponent(genre.name)}`}>
      <div className={`relative h-32 rounded-xl overflow-hidden cursor-pointer group bg-gradient-to-br ${gradient} p-4 hover:shadow-[0_8px_30px_rgba(255,255,255,0.1)] transition-all hover:-translate-y-1`}>
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-300" />
        <h3 className="relative z-10 text-xl font-bold text-white mt-auto tracking-tight">{genre.name}</h3>
      </div>
    </Link>
  );
}
