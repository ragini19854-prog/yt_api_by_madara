import { Router } from "express";
import { db, favoritesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/favorites", async (req, res) => {
  const userId = typeof req.query["userId"] === "string" ? req.query["userId"] : "";
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  try {
    const rows = await db.select().from(favoritesTable).where(eq(favoritesTable.userId, userId));
    const tracks = rows.map((f) => ({
      id: f.trackId,
      title: f.trackTitle,
      artist: f.trackArtist,
      album: null,
      thumbnail: f.trackThumbnail,
      previewUrl: f.previewUrl,
      duration: f.duration,
      genre: null,
    }));
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "get favorites failed");
    res.status(500).json({ error: "Failed to get favorites" });
  }
});

router.post("/favorites", async (req, res) => {
  const { userId, trackId, trackTitle, trackArtist, trackThumbnail, previewUrl, duration } =
    req.body as Record<string, unknown>;
  if (!userId || !trackId || !trackTitle || !trackArtist || !trackThumbnail || !previewUrl) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    const existing = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.userId, String(userId)), eq(favoritesTable.trackId, String(trackId))));
    if (existing.length > 0) {
      res.status(201).json({ message: "Already favorited" });
      return;
    }
    await db.insert(favoritesTable).values({
      userId: String(userId),
      trackId: String(trackId),
      trackTitle: String(trackTitle),
      trackArtist: String(trackArtist),
      trackThumbnail: String(trackThumbnail),
      previewUrl: String(previewUrl),
      duration: Number(duration ?? 30),
    });
    res.status(201).json({ message: "Favorited" });
  } catch (err) {
    req.log.error({ err }, "add favorite failed");
    res.status(500).json({ error: "Failed to add favorite" });
  }
});

router.delete("/favorites/:userId/:trackId", async (req, res) => {
  const { userId, trackId } = req.params as { userId: string; trackId: string };
  if (!userId || !trackId) {
    res.status(400).json({ error: "userId and trackId required" });
    return;
  }
  try {
    await db
      .delete(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.trackId, trackId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "remove favorite failed");
    res.status(500).json({ error: "Failed to remove favorite" });
  }
});

router.get("/favorites/check", async (req, res) => {
  const trackId = typeof req.query["trackId"] === "string" ? req.query["trackId"] : "";
  const userId = typeof req.query["userId"] === "string" ? req.query["userId"] : "";
  if (!trackId || !userId) {
    res.status(400).json({ error: "trackId and userId required" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(favoritesTable)
      .where(and(eq(favoritesTable.userId, userId), eq(favoritesTable.trackId, trackId)));
    res.json({ isFavorite: rows.length > 0 });
  } catch (err) {
    req.log.error({ err }, "check favorite failed");
    res.status(500).json({ error: "Failed to check favorite" });
  }
});

export default router;
