import { Router, Request, Response } from "express";
import https from "https";
import http from "http";
import playdl from "play-dl";

const router = Router();

// ── Search result cache (5 min TTL) ────────────────────────────────────────
const SEARCH_CACHE_TTL = 5 * 60_000;
const searchCache = new Map<string, { data: unknown; expiresAt: number }>();

function getCachedSearch(key: string) {
  const entry = searchCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  searchCache.delete(key);
  return null;
}
function setCachedSearch(key: string, data: unknown) {
  searchCache.set(key, { data, expiresAt: Date.now() + SEARCH_CACHE_TTL });
}

// ── Video info cache (5 min TTL) ───────────────────────────────────────────
const VIDEO_CACHE_TTL = 5 * 60_000;
const videoCache = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();

function getCachedVideo(videoId: string) {
  const entry = videoCache.get(videoId);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  videoCache.delete(videoId);
  return null;
}
function setCachedVideo(videoId: string, data: Record<string, unknown>) {
  videoCache.set(videoId, { data, expiresAt: Date.now() + VIDEO_CACHE_TTL });
}

// ── Invidious instances with penalty tracking ──────────────────────────────
const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.artemislena.eu",
  "https://invidious.privacydev.net",
  "https://yewtu.be",
];

const PENALTY_MS = 30_000;
const penalised = new Map<string, number>();

function sortedInstances(): string[] {
  return [...INVIDIOUS_INSTANCES].sort(
    (a, b) => (penalised.get(a) ?? 0) - (penalised.get(b) ?? 0),
  );
}

function invidiousFetch(path: string, timeoutMs = 4000): Promise<unknown> {
  const instances = sortedInstances();
  const attempt = (instance: string): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(`${instance}${path}`, {
      signal: controller.signal,
      headers: { "User-Agent": "MadaraMusic/1.0" },
    })
      .then((r) => {
        clearTimeout(timer);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        penalised.set(instance, Date.now() + PENALTY_MS);
        throw err;
      });
  };
  return Promise.any(instances.map(attempt));
}

async function fetchVideoInfoInvidious(videoId: string): Promise<Record<string, unknown>> {
  const cached = getCachedVideo(videoId);
  if (cached) return cached;
  const data = (await invidiousFetch(`/api/v1/videos/${videoId}`)) as Record<string, unknown>;
  setCachedVideo(videoId, data);
  return data;
}

function extractAudioUrl(data: Record<string, unknown>): string {
  const adaptiveFormats = (data["adaptiveFormats"] as Array<Record<string, unknown>>) ?? [];
  const audioFormats = adaptiveFormats
    .filter((f) => String(f["type"] ?? "").startsWith("audio/"))
    .sort((a, b) => (Number(b["bitrate"]) || 0) - (Number(a["bitrate"]) || 0));
  if (audioFormats.length > 0) return String(audioFormats[0]["url"] ?? "");
  const formatStreams = (data["formatStreams"] as Array<Record<string, unknown>>) ?? [];
  if (formatStreams.length > 0) return String(formatStreams[0]["url"] ?? "");
  return "";
}

function proxyAudioUrl(audioUrl: string, req: Request, res: Response, disposition?: string) {
  const parsedUrl = new URL(audioUrl);
  const isHttps = parsedUrl.protocol === "https:";
  const protocol = isHttps ? https : http;
  const reqRange = typeof req.headers["range"] === "string" ? req.headers["range"] : undefined;
  const options: http.RequestOptions = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MadaraMusic/1.0)",
      ...(reqRange ? { Range: reqRange } : {}),
    },
  };
  const proxyReq = protocol.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode ?? 200);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (disposition) res.setHeader("Content-Disposition", disposition);
    for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
      if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]!);
    }
    proxyRes.pipe(res);
  });
  proxyReq.on("error", () => { if (!res.headersSent) res.status(502).json({ error: "Proxy error" }); });
  req.on("close", () => proxyReq.destroy());
  proxyReq.end();
}

// ── Stream: race play-dl and Invidious — first good URL wins ───────────────
async function streamAudio(videoId: string, req: Request, res: Response, disposition?: string) {
  // Check video cache first (fastest path)
  const cachedInfo = getCachedVideo(videoId);
  if (cachedInfo) {
    const audioUrl = extractAudioUrl(cachedInfo);
    if (audioUrl) return proxyAudioUrl(audioUrl, req, res, disposition);
  }

  // Race play-dl vs Invidious — whichever resolves first with a URL wins
  const playdlAttempt = (async () => {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await playdl.video_info(ytUrl);
    const fmt = info.format.find((f) => f.mimeType?.startsWith("audio/")) ?? info.format[0];
    if (!fmt?.url) throw new Error("No audio format");
    return fmt.url;
  })();

  const invidiousAttempt = (async () => {
    const data = await fetchVideoInfoInvidious(videoId);
    const url = extractAudioUrl(data);
    if (!url) throw new Error("No audio URL from Invidious");
    return url;
  })();

  try {
    const audioUrl = await Promise.any([playdlAttempt, invidiousAttempt]);
    proxyAudioUrl(audioUrl, req, res, disposition);
  } catch (err) {
    req.log.error({ err }, "streamAudio: both play-dl and Invidious failed");
    if (!res.headersSent) res.status(500).json({ error: "Audio stream unavailable" });
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────

router.get("/music/youtube/resolve", async (req, res) => {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const cacheKey = `resolve:${q}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) { res.json(cached); return; }

  // Race play-dl and Invidious for the first result
  const playdlSearch = (async () => {
    const results = await playdl.search(q, { limit: 1, source: { youtube: "video" } });
    if (!results.length) throw new Error("No results");
    const v = results[0];
    const videoId = v.id ?? "";
    return {
      videoId,
      streamUrl: `/api/music/youtube/stream?videoId=${videoId}`,
      title: v.title ?? "",
      duration: v.durationInSec ?? 0,
      thumbnail: v.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  })();

  const invidiousSearch = (async () => {
    const data = (await invidiousFetch(
      `/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`,
      3000,
    )) as Array<Record<string, unknown>>;
    const first = data.find((item) => item["type"] === "video");
    if (!first) throw new Error("No results from Invidious");
    const videoId = String(first["videoId"] ?? "");
    const thumbnails = (first["videoThumbnails"] as Array<{ url: string; quality: string }>) ?? [];
    const thumb =
      thumbnails.find((t) => t.quality === "high")?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      videoId,
      streamUrl: `/api/music/youtube/stream?videoId=${videoId}`,
      title: String(first["title"] ?? ""),
      duration: typeof first["lengthSeconds"] === "number" ? first["lengthSeconds"] : 0,
      thumbnail: thumb,
    };
  })();

  try {
    const result = await Promise.any([playdlSearch, invidiousSearch]);
    setCachedSearch(cacheKey, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "YouTube resolve failed");
    res.status(500).json({ error: "YouTube resolve failed" });
  }
});

router.get("/music/youtube/search", async (req, res) => {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  const limit = Math.min(Number(req.query["limit"]) || 10, 25);
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const cacheKey = `search:${q}:${limit}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) { res.json(cached); return; }

  const toTrack = (videoId: string, title: string, artist: string, thumb: string, duration: number) => ({
    id: `yt_${videoId}`,
    title,
    artist,
    album: null,
    thumbnail: thumb,
    previewUrl: `/api/music/youtube/stream?videoId=${videoId}`,
    duration,
    genre: null,
    source: "youtube",
    videoId,
  });

  // Race play-dl and Invidious — take whichever has results first
  const playdlSearch = (async () => {
    const results = await playdl.search(q, { limit, source: { youtube: "video" } });
    if (!results.length) throw new Error("No results");
    return results.map((v) => {
      const videoId = v.id ?? "";
      return toTrack(
        videoId,
        v.title ?? "Unknown",
        v.channel?.name ?? "YouTube",
        v.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        v.durationInSec ?? 0,
      );
    });
  })();

  const invidiousSearch = (async () => {
    const data = (await invidiousFetch(
      `/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`,
      3000,
    )) as Array<Record<string, unknown>>;
    const tracks = data
      .filter((item) => item["type"] === "video")
      .slice(0, limit)
      .map((item) => {
        const videoId = String(item["videoId"] ?? "");
        const thumbnails = (item["videoThumbnails"] as Array<{ url: string; quality: string }>) ?? [];
        const thumb =
          thumbnails.find((t) => t.quality === "high")?.url ??
          thumbnails[0]?.url ??
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        return toTrack(
          videoId,
          String(item["title"] ?? "Unknown"),
          String(item["author"] ?? "YouTube"),
          thumb,
          typeof item["lengthSeconds"] === "number" ? item["lengthSeconds"] : 0,
        );
      });
    if (!tracks.length) throw new Error("No results from Invidious");
    return tracks;
  })();

  try {
    const tracks = await Promise.any([playdlSearch, invidiousSearch]);
    setCachedSearch(cacheKey, tracks);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "YouTube search failed");
    res.status(500).json({ error: "YouTube search failed" });
  }
});

router.get("/music/youtube/stream", async (req, res) => {
  const videoId = typeof req.query["videoId"] === "string" ? req.query["videoId"] : "";
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" }); return;
  }
  await streamAudio(videoId, req, res);
});

router.get("/music/youtube/download", async (req, res) => {
  const videoId = typeof req.query["videoId"] === "string" ? req.query["videoId"] : "";
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" }); return;
  }
  await streamAudio(videoId, req, res, `attachment; filename="${videoId}.webm"`);
});

export default router;
