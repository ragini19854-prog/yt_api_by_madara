import { Router } from "express";

const router = Router();

const GENRES = [
  { id: "pop", name: "Pop" },
  { id: "rock", name: "Rock" },
  { id: "hiphop", name: "Hip-Hop" },
  { id: "electronic", name: "Electronic" },
  { id: "jazz", name: "Jazz" },
  { id: "classical", name: "Classical" },
  { id: "rnb", name: "R&B" },
  { id: "country", name: "Country" },
  { id: "metal", name: "Metal" },
  { id: "indie", name: "Indie" },
  { id: "anime", name: "Anime" },
  { id: "kpop", name: "K-Pop" },
];

const TRENDING_QUERIES = [
  "pop hits 2024",
  "top chart songs",
  "viral music 2024",
  "trending hits",
];

async function fetchITunes(term: string, limit = 20): Promise<unknown[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: unknown[] };
  return data.results ?? [];
}

function mapTrack(item: Record<string, unknown>) {
  return {
    id: String(item["trackId"] ?? item["collectionId"] ?? Math.random()),
    title: String(item["trackName"] ?? item["collectionName"] ?? "Unknown"),
    artist: String(item["artistName"] ?? "Unknown Artist"),
    album: item["collectionName"] ? String(item["collectionName"]) : null,
    thumbnail: item["artworkUrl100"]
      ? String(item["artworkUrl100"]).replace("100x100", "300x300")
      : "https://via.placeholder.com/300",
    previewUrl: String(item["previewUrl"] ?? ""),
    duration: typeof item["trackTimeMillis"] === "number" ? item["trackTimeMillis"] / 1000 : 0,
    genre: item["primaryGenreName"] ? String(item["primaryGenreName"]) : null,
    source: "itunes",
  };
}

router.get("/music/search", async (req, res) => {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  const limit = Number(req.query["limit"]) || 20;
  if (!q) {
    res.status(400).json({ error: "Query parameter q is required" });
    return;
  }
  try {
    const raw = await fetchITunes(q, limit);
    const tracks = (raw as Record<string, unknown>[])
      .filter((t) => t["previewUrl"])
      .map(mapTrack);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "music search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/music/trending", async (req, res) => {
  const limit = Number(req.query["limit"]) || 20;
  const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
  try {
    const raw = await fetchITunes(query, limit);
    const tracks = (raw as Record<string, unknown>[])
      .filter((t) => t["previewUrl"])
      .map(mapTrack);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "trending fetch failed");
    res.status(500).json({ error: "Failed to fetch trending" });
  }
});

router.get("/music/genres", (_req, res) => {
  res.json(GENRES);
});

router.get("/music/by-genre", async (req, res) => {
  const genre = typeof req.query["genre"] === "string" ? req.query["genre"] : "";
  const limit = Number(req.query["limit"]) || 20;
  if (!genre) {
    res.status(400).json({ error: "genre parameter required" });
    return;
  }
  try {
    const raw = await fetchITunes(`${genre} music`, limit);
    const tracks = (raw as Record<string, unknown>[])
      .filter((t) => t["previewUrl"])
      .map(mapTrack);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "genre fetch failed");
    res.status(500).json({ error: "Failed to fetch genre tracks" });
  }
});

export default router;
