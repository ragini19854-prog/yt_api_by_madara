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

async function invidiousFetch(path: string): Promise<unknown> {
  let lastErr: unknown;
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${instance}${path}`, {
        signal: controller.signal,
        headers: { "User-Agent": "MadaraMusic/1.0" },
      });
      clearTimeout(timer);
      if (res.ok) return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All Invidious instances unreachable");
}

router.get("/music/youtube/resolve", async (req, res) => {
  const q = typeof req.query["q"] === "string" ? req.query["q"] : "";
  if (!q) {
    res.status(400).json({ error: "Query parameter q is required" });
    return;
  }
  try {
    const data = (await invidiousFetch(
      `/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`,
    )) as Array<Record<string, unknown>>;

    const first = data.find((item) => item["type"] === "video");
    if (!first) {
      res.status(404).json({ error: "No video results found" });
      return;
    }

    const videoId = String(first["videoId"] ?? "");
    const thumbnails =
      (first["videoThumbnails"] as Array<{ url: string; quality: string }>) ?? [];
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

  if (!q) {
    res.status(400).json({ error: "Query parameter q is required" });
    return;
  }

  try {
    const data = (await invidiousFetch(
      `/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`,
    )) as Array<Record<string, unknown>>;

    const tracks = data
      .filter((item) => item["type"] === "video")
      .slice(0, limit)
      .map((item) => {
        const videoId = String(item["videoId"] ?? "");
        const thumbnails =
          (item["videoThumbnails"] as Array<{ url: string; quality: string }>) ?? [];
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
    res.status(400).json({ error: "Invalid videoId" });
    return;
  }

  try {
    const data = (await invidiousFetch(
      `/api/v1/videos/${videoId}`,
    )) as Record<string, unknown>;

    const adaptiveFormats =
      (data["adaptiveFormats"] as Array<Record<string, unknown>>) ?? [];

    const audioFormats = adaptiveFormats
      .filter((f) => {
        const type = String(f["type"] ?? "");
        return type.startsWith("audio/");
      })
      .sort((a, b) => (Number(b["bitrate"]) || 0) - (Number(a["bitrate"]) || 0));

    let audioUrl = "";

    if (audioFormats.length > 0) {
      audioUrl = String(audioFormats[0]["url"] ?? "");
    } else {
      const formatStreams =
        (data["formatStreams"] as Array<Record<string, unknown>>) ?? [];
      if (formatStreams.length > 0) {
        audioUrl = String(formatStreams[0]["url"] ?? "");
      }
    }

    if (!audioUrl) {
      res.status(404).json({ error: "No audio stream available for this video" });
      return;
    }

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
      const statusCode = proxyRes.statusCode ?? 200;
      const passHeaders = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "cache-control",
      ];
      res.status(statusCode);
      res.setHeader("Access-Control-Allow-Origin", "*");
      for (const h of passHeaders) {
        if (proxyRes.headers[h]) {
          res.setHeader(h, proxyRes.headers[h]!);
        }
      }
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      req.log.error({ err }, "YouTube audio proxy error");
      if (!res.headersSent) {
        res.status(502).json({ error: "Audio proxy failed" });
      }
    });

    req.on("close", () => proxyReq.destroy());
    proxyReq.end();
  } catch (err) {
    req.log.error({ err }, "YouTube stream error");
    if (!res.headersSent) {
      res.status(500).json({ error: "YouTube stream failed" });
    }
  }
});

router.get("/music/youtube/download", async (req, res) => {
  const videoId = typeof req.query["videoId"] === "string" ? req.query["videoId"] : "";

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    res.status(400).json({ error: "Invalid videoId" });
    return;
  }

  try {
    const data = (await invidiousFetch(
      `/api/v1/videos/${videoId}`,
    )) as Record<string, unknown>;

    const adaptiveFormats =
      (data["adaptiveFormats"] as Array<Record<string, unknown>>) ?? [];

    const audioFormats = adaptiveFormats
      .filter((f) => String(f["type"] ?? "").startsWith("audio/"))
      .sort((a, b) => (Number(b["bitrate"]) || 0) - (Number(a["bitrate"]) || 0));

    let audioUrl = "";
    if (audioFormats.length > 0) {
      audioUrl = String(audioFormats[0]["url"] ?? "");
    } else {
      const formatStreams =
        (data["formatStreams"] as Array<Record<string, unknown>>) ?? [];
      if (formatStreams.length > 0) {
        audioUrl = String(formatStreams[0]["url"] ?? "");
      }
    }

    if (!audioUrl) {
      res.status(404).json({ error: "No audio stream available" });
      return;
    }

    const parsedUrl = new URL(audioUrl);
    const isHttps = parsedUrl.protocol === "https:";
    const protocol = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MadaraMusic/1.0)" },
    };

    const proxyReq = protocol.request(options, (proxyRes) => {
      const statusCode = proxyRes.statusCode ?? 200;
      res.status(statusCode);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Disposition", `attachment; filename="${videoId}.webm"`);
      const passHeaders = ["content-type", "content-length", "content-range", "accept-ranges"];
      for (const h of passHeaders) {
        if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]!);
      }
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
      req.log.error({ err }, "YouTube download proxy error");
      if (!res.headersSent) res.status(502).json({ error: "Download proxy failed" });
    });
    req.on("close", () => proxyReq.destroy());
    proxyReq.end();
  } catch (err) {
    req.log.error({ err }, "YouTube download error");
    if (!res.headersSent) res.status(500).json({ error: "YouTube download failed" });
  }
});

export default router;
