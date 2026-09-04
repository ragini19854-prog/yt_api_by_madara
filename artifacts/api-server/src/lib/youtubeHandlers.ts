import { Request, Response } from "express";
import https from "https";
import http from "http";
import { Innertube } from "youtubei.js";

// ── Singleton Innertube session (reused across requests) ──────────────────
let _yt: Innertube | null = null;
let _ytInitPromise: Promise<Innertube> | null = null;

async function getYT(): Promise<Innertube> {
  if (_yt) return _yt;
  if (_ytInitPromise) return _ytInitPromise;
  _ytInitPromise = Innertube.create({ generate_session_locally: true }).then((yt) => {
    _yt = yt;
    _ytInitPromise = null;
    return yt;
  });
  return _ytInitPromise;
}

// Pre-warm session on startup
getYT().catch(() => {});

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

// ── Format URL cache (55 min TTL — YouTube URLs expire in ~6h) ─────────────
const FORMAT_CACHE_TTL = 55 * 60_000;
const formatCache = new Map<string, { url: string; expiresAt: number }>();

function getCachedFormat(videoId: string) {
  const entry = formatCache.get(videoId);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  formatCache.delete(videoId);
  return null;
}
function setCachedFormat(videoId: string, url: string) {
  formatCache.set(videoId, { url, expiresAt: Date.now() + FORMAT_CACHE_TTL });
}

// ── Proxy a direct audio URL through to the client ─────────────────────────
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

// ── Get best audio format URL for a video ─────────────────────────────────
// Tries multiple YouTube client types in order: TV_EMBEDDED and IOS bypass
// most bot-detection / age-gating; ANDROID and MWEB are additional fallbacks.
async function getAudioUrl(videoId: string): Promise<string> {
  const cached = getCachedFormat(videoId);
  if (cached) return cached;

  const yt = await getYT();

  // IOS client is most reliable for bypassing "Sign in to confirm" errors.
  // TV_EMBEDDED also bypasses age/streaming restrictions without cookies.
  // The API takes { client } options object, not a bare string.
  const clients: Array<"IOS" | "TV_EMBEDDED" | "ANDROID" | "MWEB" | "WEB"> = [
    "IOS", "TV_EMBEDDED", "ANDROID", "MWEB", "WEB"
  ];
  let lastErr: unknown;

  for (const client of clients) {
    try {
      const info = await yt.getBasicInfo(videoId, { client });
      const format = info.chooseFormat({ type: "audio", quality: "best", format: "any" });
      if (format?.url) {
        setCachedFormat(videoId, format.url);
        return format.url;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  // Last resort: full info (slower but most thorough)
  try {
    const info = await yt.getInfo(videoId);
    const format = info.chooseFormat({ type: "audio", quality: "best", format: "any" });
    if (format?.url) {
      setCachedFormat(videoId, format.url);
      return format.url;
    }
  } catch (e) {
    lastErr = e;
  }

  throw lastErr ?? new Error("No audio format URL available");
}

// ── Convert innertube video result to Track shape ──────────────────────────
function videoToTrack(v: {
  id?: string;
  title?: { text?: string } | string;
  author?: { name?: string } | string;
  thumbnails?: Array<{ url?: string }>;
  duration?: { seconds?: number };
}) {
  const videoId = v.id ?? "";
  const title =
    typeof v.title === "string" ? v.title : (v.title as { text?: string })?.text ?? "Unknown";
  const artist =
    typeof v.author === "string" ? v.author : (v.author as { name?: string })?.name ?? "YouTube";
  const thumb =
    (v.thumbnails as Array<{ url?: string }>)?.[0]?.url ??
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const duration =
    typeof (v.duration as { seconds?: number })?.seconds === "number"
      ? (v.duration as { seconds: number }).seconds
      : 0;
  return {
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
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────

// Search endpoint
export async function searchHandler(req: Request, res: Response) {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  const limit = Math.min(Number(req.query["limit"]) || 10, 25);
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const cacheKey = `search:${q}:${limit}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const yt = await getYT();
    const results = await yt.search(q, { type: "video" });
    const videos = (results.videos ?? []).slice(0, limit);
    const tracks = videos.map((v) => videoToTrack(v as Parameters<typeof videoToTrack>[0]));
    setCachedSearch(cacheKey, tracks);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "YouTube search failed");
    res.status(500).json({ error: "YouTube search failed" });
  }
}

// Resolve endpoint: find first matching video + return stream URL
export async function resolveHandler(req: Request, res: Response) {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  const cacheKey = `resolve:${q}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const yt = await getYT();
    const results = await yt.search(q, { type: "video" });
    const first = results.videos?.[0];
    if (!first) { res.status(404).json({ error: "No results" }); return; }

    const track = videoToTrack(first as Parameters<typeof videoToTrack>[0]);
    const firstId = (first as { id?: string }).id ?? "";
    const result = {
      videoId: firstId,
      streamUrl: `/api/music/youtube/stream?videoId=${firstId}`,
      title: track.title,
      duration: track.duration,
      thumbnail: track.thumbnail,
    };
    setCachedSearch(cacheKey, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "YouTube resolve failed");
    res.status(500).json({ error: "YouTube resolve failed" });
  }
}

// Stream endpoint
export async function streamHandler(req: Request, res: Response) {
  const videoId = typeof req.query["videoId"] === "string" ? req.query["videoId"] : "";
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" }); return;
  }

  try {
    const audioUrl = await getAudioUrl(videoId);
    proxyAudioUrl(audioUrl, req, res);
  } catch (err) {
    req.log.error({ err }, "Stream failed");
    if (!res.headersSent) res.status(500).json({ error: "Stream unavailable" });
  }
}

// Related tracks endpoint — returns tracks related to a given videoId.
// Uses Innertube's watch/next page to get YouTube's own recommendations,
// which are far more accurate than a plain text search.
export async function relatedHandler(req: Request, res: Response) {
  const videoId = typeof req.query["videoId"] === "string" ? req.query["videoId"] : "";
  const limit   = Math.min(Number(req.query["limit"]) || 10, 25);
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" }); return;
  }

  const cacheKey = `related:${videoId}:${limit}`;
  const cached = getCachedSearch(cacheKey);
  if (cached) { res.json(cached); return; }

  try {
    const yt = await getYT();
    const info = await yt.getInfo(videoId);

    // `watch_next_feed` is the sidebar "Up next" list — exactly what we want.
    const related = (info.watch_next_feed ?? []) as Array<{
      id?: string;
      title?: { text?: string } | string;
      author?: { name?: string } | string;
      thumbnails?: Array<{ url?: string }>;
      duration?: { seconds?: number };
    }>;

    const tracks = related
      .filter((v) => v.id && v.id !== videoId) // exclude current track
      .slice(0, limit)
      .map((v) => videoToTrack(v));

    setCachedSearch(cacheKey, tracks);
    res.json(tracks);
  } catch (err) {
    // Fallback: do a text search based on the video title
    try {
      const yt = await getYT();
      const info = await yt.getBasicInfo(videoId, { client: "IOS" });
      const title  = typeof info.basic_info?.title === "string" ? info.basic_info.title : "";
      const author = typeof info.basic_info?.author === "string" ? info.basic_info.author : "";
      const q      = `${title} ${author}`.trim() || "music";
      const results = await yt.search(q, { type: "video" });
      const tracks = (results.videos ?? [])
        .filter((v) => (v as { id?: string }).id !== videoId)
        .slice(0, limit)
        .map((v) => videoToTrack(v as Parameters<typeof videoToTrack>[0]));
      setCachedSearch(cacheKey, tracks);
      res.json(tracks);
    } catch (fallbackErr) {
      req.log.error({ err, fallbackErr }, "Related tracks failed");
      res.status(500).json({ error: "Related tracks unavailable" });
    }
  }
}

// Download endpoint
export async function downloadHandler(req: Request, res: Response) {
  const videoId = typeof req.query["videoId"] === "string" ? req.query["videoId"] : "";
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" }); return;
  }

  try {
    const audioUrl = await getAudioUrl(videoId);
    proxyAudioUrl(audioUrl, req, res, `attachment; filename="${videoId}.webm"`);
  } catch (err) {
    req.log.error({ err }, "Download failed");
    if (!res.headersSent) res.status(500).json({ error: "Download unavailable" });
  }
}
