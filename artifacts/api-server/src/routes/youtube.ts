import { Router } from "express";
import https from "https";
import http from "http";

const router = Router();

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.artemislena.eu",
  "https://invidious.privacydev.net",
  "https://yewtu.be",
];

// ── Instance health tracker ────────────────────────────────────────────────
// Tracks the last instance that succeeded so it gets tried first next time.
// Failed instances are deprioritized for PENALTY_MS milliseconds.
const PENALTY_MS = 30_000;
const lastWorking: { instance: string; at: number } | null = null as never;
const penalised = new Map<string, number>(); // instance -> penalty-until timestamp

function sortedInstances(): string[] {
  const now = Date.now();
  const working = INVIDIOUS_INSTANCES.filter((i) => (penalised.get(i) ?? 0) < now);
  const penalized = INVIDIOUS_INSTANCES.filter((i) => (penalised.get(i) ?? 0) >= now);
  if (lastWorking && working.includes((lastWorking as unknown as { instance: string }).instance)) {
    const best = (lastWorking as unknown as { instance: string }).instance;
    return [best, ...working.filter((i) => i !== best), ...penalized];
  }
  return [...working, ...penalized];
}

function markFailed(instance: string) {
  penalised.set(instance, Date.now() + PENALTY_MS);
}

// ── In-memory video info cache ─────────────────────────────────────────────
// Avoids re-fetching /api/v1/videos/:id for stream AND download on same videoId
const VIDEO_CACHE_TTL = 5 * 60_000; // 5 minutes
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

// ── Core fetch: race all instances simultaneously ──────────────────────────
// Uses Promise.any() — resolves as soon as the FIRST instance replies OK.
// Individual timeout is 4s; failing instances are penalised for 30s.
const PER_INSTANCE_TIMEOUT = 4_000;

async function invidiousFetch(path: string): Promise<unknown> {
  const instances = sortedInstances();

  const attempt = (instance: string): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_INSTANCE_TIMEOUT);
    return fetch(`${instance}${path}`, {
      signal: controller.signal,
      headers: { "User-Agent": "MadaraMusic/1.0" },
    })
      .then((res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        markFailed(instance);
        throw err;
      });
  };

  // Race all healthy instances; fall back to sequential only when all fail
  try {
    return await Promise.any(instances.map(attempt));
  } catch {
    throw new Error("All Invidious instances unreachable");
  }
}

// ── Fetch video info with cache ────────────────────────────────────────────
async function fetchVideoInfo(videoId: string): Promise<Record<string, unknown>> {
  const cached = getCachedVideo(videoId);
  if (cached) return cached;
  const data = (await invidiousFetch(`/api/v1/videos/${videoId}`)) as Record<string, unknown>;
  setCachedVideo(videoId, data);
  return data;
}

// ── Extract best audio URL from video data ─────────────────────────────────
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

// ── Proxy audio bytes ──────────────────────────────────────────────────────
function proxyAudio(
  audioUrl: string,
  req: Parameters<Router>[0],
  res: Parameters<Router>[1],
  disposition?: string,
) {
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

  proxyReq.on("error", (err) => {
    (req as unknown as { log: { error: (...a: unknown[]) => void } }).log.error(
      { err },
      "Audio proxy error",
    );
    if (!res.headersSent) res.status(502).json({ error: "Audio proxy failed" });
  });

  req.on("close", () => proxyReq.destroy());
  proxyReq.end();
}

// ── Routes ─────────────────────────────────────────────────────────────────

router.get("/music/youtube/resolve", async (req, res) => {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  if (!q) { res.status(400).json({ error: "Query parameter q is required" }); return; }
  try {
    const data = (await invidiousFetch(
      `/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`,
    )) as Array<Record<string, unknown>>;

    const first = data.find((item) => item["type"] === "video");
    if (!first) { res.status(404).json({ error: "No video results found" }); return; }

    const videoId = String(first["videoId"] ?? "");
    const thumbnails = (first["videoThumbnails"] as Array<{ url: string; quality: string }>) ?? [];
    const thumb =
      thumbnails.find((t) => t.quality === "high")?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

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
  if (!q) { res.status(400).json({ error: "Query parameter q is required" }); return; }
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
  try {
    const data = await fetchVideoInfo(videoId);
    const audioUrl = extractAudioUrl(data);
    if (!audioUrl) { res.status(404).json({ error: "No audio stream available" }); return; }
    proxyAudio(audioUrl, req, res);
  } catch (err) {
    req.log.error({ err }, "YouTube stream error");
    if (!res.headersSent) res.status(500).json({ error: "YouTube stream failed" });
  }
});

router.get("/music/youtube/download", async (req, res) => {
  const videoId = typeof req.query["videoId"] === "string" ? req.query["videoId"] : "";
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" }); return;
  }
  try {
    const data = await fetchVideoInfo(videoId);
    const audioUrl = extractAudioUrl(data);
    if (!audioUrl) { res.status(404).json({ error: "No audio stream available" }); return; }
    proxyAudio(audioUrl, req, res, `attachment; filename="${videoId}.webm"`);
  } catch (err) {
    req.log.error({ err }, "YouTube download error");
    if (!res.headersSent) res.status(500).json({ error: "YouTube download failed" });
  }
});

export default router;
