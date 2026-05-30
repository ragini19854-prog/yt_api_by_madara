import { Router } from "express";
import { db, playHistoryTable, playlistsTable, favoritesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/history", async (req, res) => {
  const userId = typeof req.query["userId"] === "string" ? req.query["userId"] : "";
  const limit = Number(req.query["limit"]) || 20;
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(playHistoryTable)
      .where(eq(playHistoryTable.userId, userId))
      .orderBy(desc(playHistoryTable.playedAt))
      .limit(limit);

    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      if (seen.has(r.trackId)) return false;
      seen.add(r.trackId);
      return true;
    });

    const tracks = unique.map((h) => ({
      id: h.trackId,
      title: h.trackTitle,
      artist: h.trackArtist,
      album: null,
      thumbnail: h.trackThumbnail,
      previewUrl: h.previewUrl,
      duration: h.duration,
      genre: null,
    }));
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "get history failed");
    res.status(500).json({ error: "Failed to get history" });
  }
});

router.post("/history", async (req, res) => {
  const { userId, trackId, trackTitle, trackArtist, trackThumbnail, previewUrl, duration } =
    req.body as Record<string, unknown>;
  if (!userId || !trackId || !trackTitle || !trackArtist || !trackThumbnail || !previewUrl) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  try {
    await db.insert(playHistoryTable).values({
      userId: String(userId),
      trackId: String(trackId),
      trackTitle: String(trackTitle),
      trackArtist: String(trackArtist),
      trackThumbnail: String(trackThumbnail),
      previewUrl: String(previewUrl),
      duration: Number(duration ?? 30),
    });
    res.status(201).json({ message: "Recorded" });
  } catch (err) {
    req.log.error({ err }, "record play failed");
    res.status(500).json({ error: "Failed to record play" });
  }
});

router.get("/stats/user/:userId", async (req, res) => {
  const { userId } = req.params as { userId: string };
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  try {
    const [totalPlaysRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playHistoryTable)
      .where(eq(playHistoryTable.userId, userId));

    const uniqueTracksRows = await db
      .selectDistinct({ trackId: playHistoryTable.trackId })
      .from(playHistoryTable)
      .where(eq(playHistoryTable.userId, userId));

    const topArtistRows = await db
      .select({ artist: playHistoryTable.trackArtist, count: sql<number>`count(*)::int` })
      .from(playHistoryTable)
      .where(eq(playHistoryTable.userId, userId))
      .groupBy(playHistoryTable.trackArtist)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    const [playlistCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playlistsTable)
      .where(eq(playlistsTable.userId, userId));

    const [favCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(favoritesTable)
      .where(eq(favoritesTable.userId, userId));

    res.json({
      totalPlays: totalPlaysRow?.count ?? 0,
      uniqueTracks: uniqueTracksRows.length,
      playlistCount: playlistCountRow?.count ?? 0,
      favoriteCount: favCountRow?.count ?? 0,
      topArtists: topArtistRows.map((r) => r.artist),
    });
  } catch (err) {
    req.log.error({ err }, "get user stats failed");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
