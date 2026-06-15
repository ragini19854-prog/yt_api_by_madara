import { Router, Request, Response } from "express";
import https from "https";
import http from "http";
import playdl from "play-dl";

const router = Router();

// ── In-memory video info cache (Invidious fallback) ────────────────────────
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

// ── Invidious fallback (used only when play-dl fails) ──────────────────────
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
  const now = Date.now();
  return [...INVIDIOUS_INSTANCES].sort((a, b) => {
    return (penalised.get(a) ?? 0) - (penalised.get(b) ?? 0);
  }).filter(() => true); // always return all, sorted by penalty
}

async function invidiousFetch(path: string): Promise<unknown> {
  const instances = sortedInstances();
  const attempt = (instance: string): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
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
  try {
    return await Promise.any(instances.map(attempt));
  } catch {
    throw new Error("All Invidious instances unreachable");
  }
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

// ── Stream audio: play-dl first, Invidious fallback ───────────────────────
async function streamAudio(videoId: string, req: Request, res: Response, disposition?: string) {
  // ── Primary: play-dl (direct YouTube, no third-party server) ─────────────
  try {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const info = await playdl.video_info(ytUrl);
    const fmt = info.format.find((f) => f.mimeType?.startsWith("audio/")) ?? info.format[0];
    if (fmt?.url) {
      // Got a direct URL — proxy it without involving play-dl streams (more reliable)
      return proxyAudioUrl(fmt.url, req, res, disposition);
    }
  } catch {
    // fall through to Invidious
  }

  // ── Fallback: Invidious ───────────────────────────────────────────────────
  try {
    const data = await fetchVideoInfoInvidious(videoId);
    const audioUrl = extractAudioUrl(data);
    if (!audioUrl) { res.status(404).json({ error: "No audio stream available" }); return; }
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
  try {
    // play-dl search
    const results = await playdl.search(q, { limit: 1, source: { youtube: "video" } });
    if (results.length > 0) {
      const v = results[0];
      const videoId = v.id ?? "";
      const thumb = v.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      res.json({
        videoId,
        streamUrl: `/api/music/youtube/stream?videoId=${videoId}`,
        title: v.title ?? "",
        duration: v.durationInSec ?? 0,
        thumbnail: thumb,
      });
      return;
    }
  } catch { /* fall through */ }

  // Invidious fallback
  try {
    const data = (await invidiousFetch(
      `/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`,
    )) as Array<Record<string, unknown>>;
    const first = data.find((item) => item["type"] === "video");
    if (!first) { res.status(404).json({ error: "No results found" }); return; }
    const videoId = String(first["videoId"] ?? "");
    const thumbnails = (first["videoThumbnails"] as Array<{ url: string; quality: string }>) ?? [];
    const thumb = thumbnails.find((t) => t.quality === "high")?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    res.json({
      videoId,
      streamUrl: `/api/music/youtube/stream?videoId=${videoId}`,
      title: String(first["title"] ?? ""),
      duration: typeof first["lengthSeconds"] === "number" ? first["lengthSeconds"] : 0,
      thumbnail: thumb,
    });
  } catch (err) {
    req.log.error({ err }, "YouTube resolve failed");
    res.status(500).json({ error: "YouTube resolve failed" });
  }
});

router.get("/music/youtube/search", async (req, res) => {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  const limit = Math.min(Number(req.query["limit"]) || 10, 25);
  if (!q) { res.status(400).json({ error: "q is required" }); return; }

  // ── play-dl primary ───────────────────────────────────────────────────────
  try {
    const results = await playdl.search(q, { limit, source: { youtube: "video" } });
    if (results.length > 0) {
      const tracks = results.map((v) => {
        const videoId = v.id ?? "";
        const thumb = v.thumbnails?.[0]?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        return {
          id: `yt_${videoId}`,
          title: v.title ?? "Unknown",
          artist: v.channel?.name ?? "YouTube",
          album: null,
          thumbnail: thumb,
          previewUrl: `/api/music/youtube/stream?videoId=${videoId}`,
          duration: v.durationInSec ?? 0,
          genre: null,
          source: "youtube",
          videoId,
        };
      });
      res.json(tracks);
      return;
    }
  } catch { /* fall through */ }

  // ── Invidious fallback ────────────────────────────────────────────────────
  try {
    const data = (await invidiousFetch(
      `/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`,
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
        return {
          id: `yt_${videoId}`,
          title: String(item["title"] ?? "Unknown"),
          artist: String(item["author"] ?? "YouTube"),
          album: null,
          thumbnail: thumb,
          previewUrl: `/api/music/youtube/stream?videoId=${videoId}`,
          duration: typeof item["lengthSeconds"] === "number" ? item["lengthSeconds"] : 0,
          genre: null,
          source: "youtube",
          videoId,
        };
      });
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
