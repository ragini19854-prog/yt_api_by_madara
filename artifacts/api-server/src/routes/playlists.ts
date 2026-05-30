import { Router } from "express";
import { db, playlistsTable, playlistTracksTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

router.get("/playlists", async (req, res) => {
  const userId = typeof req.query["userId"] === "string" ? req.query["userId"] : "";
  if (!userId) {
    res.status(400).json({ error: "userId required" });
    return;
  }
  try {
    const rows = await db.select().from(playlistsTable).where(eq(playlistsTable.userId, userId));
    const counts = await db
      .select({ playlistId: playlistTracksTable.playlistId, count: sql<number>`count(*)::int` })
      .from(playlistTracksTable)
      .groupBy(playlistTracksTable.playlistId);

    const countMap = new Map(counts.map((c) => [c.playlistId, c.count]));
    const result = rows.map((p) => ({
      ...p,
      trackCount: countMap.get(p.id) ?? 0,
      createdAt: p.createdAt.toISOString(),
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "get playlists failed");
    res.status(500).json({ error: "Failed to get playlists" });
  }
});

router.post("/playlists", async (req, res) => {
  const { name, description, coverUrl, userId, isPublic } = req.body as Record<string, unknown>;
  if (!name || !userId) {
    res.status(400).json({ error: "name and userId required" });
    return;
  }
  try {
    const [playlist] = await db
      .insert(playlistsTable)
      .values({
        name: String(name),
        description: description ? String(description) : null,
        coverUrl: coverUrl ? String(coverUrl) : null,
        userId: String(userId),
        isPublic: Boolean(isPublic ?? false),
      })
      .returning();
    res.status(201).json({ ...playlist, trackCount: 0, createdAt: playlist!.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "create playlist failed");
    res.status(500).json({ error: "Failed to create playlist" });
  }
});

router.get("/playlists/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [playlist] = await db.select().from(playlistsTable).where(eq(playlistsTable.id, id));
    if (!playlist) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    const tracks = await db.select().from(playlistTracksTable).where(eq(playlistTracksTable.playlistId, id));
    res.json({
      ...playlist,
      createdAt: playlist.createdAt.toISOString(),
      tracks: tracks.map((t) => ({
        id: t.trackId,
        title: t.trackTitle,
        artist: t.trackArtist,
        album: null,
        thumbnail: t.trackThumbnail,
        previewUrl: t.previewUrl,
        duration: t.duration,
        genre: null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "get playlist failed");
    res.status(500).json({ error: "Failed to get playlist" });
  }
});

router.patch("/playlists/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { name, description, coverUrl, isPublic } = req.body as Record<string, unknown>;
  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates["name"] = String(name);
    if (description !== undefined) updates["description"] = String(description);
    if (coverUrl !== undefined) updates["coverUrl"] = String(coverUrl);
    if (isPublic !== undefined) updates["isPublic"] = Boolean(isPublic);

    const [updated] = await db
      .update(playlistsTable)
      .set(updates)
      .where(eq(playlistsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Playlist not found" });
      return;
    }
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playlistTracksTable)
      .where(eq(playlistTracksTable.playlistId, id));
    res.json({ ...updated, trackCount: countRow?.count ?? 0, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "update playlist failed");
    res.status(500).json({ error: "Failed to update playlist" });
  }
});

router.delete("/playlists/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db.delete(playlistTracksTable).where(eq(playlistTracksTable.playlistId, id));
    await db.delete(playlistsTable).where(eq(playlistsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "delete playlist failed");
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

router.post("/playlists/:id/tracks", async (req, res) => {
  const playlistId = Number(req.params["id"]);
  if (isNaN(playlistId)) {
    res.status(400).json({ error: "Invalid playlist id" });
    return;
  }
  const { trackId, trackTitle, trackArtist, trackThumbnail, previewUrl, duration } = req.body as Record<string, unknown>;
  if (!trackId || !trackTitle || !trackArtist || !trackThumbnail || !previewUrl) {
    res.status(400).json({ error: "Missing required track fields" });
    return;
  }
  try {
    const [track] = await db
      .insert(playlistTracksTable)
      .values({
        playlistId,
        trackId: String(trackId),
        trackTitle: String(trackTitle),
        trackArtist: String(trackArtist),
        trackThumbnail: String(trackThumbnail),
        previewUrl: String(previewUrl),
        duration: Number(duration ?? 30),
      })
      .returning();
    res.status(201).json({
      ...track,
      addedAt: track!.addedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "add track to playlist failed");
    res.status(500).json({ error: "Failed to add track" });
  }
});

router.delete("/playlists/:id/tracks/:trackId", async (req, res) => {
  const playlistId = Number(req.params["id"]);
  const trackId = req.params["trackId"];
  if (isNaN(playlistId) || !trackId) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  try {
    await db
      .delete(playlistTracksTable)
      .where(and(eq(playlistTracksTable.playlistId, playlistId), eq(playlistTracksTable.trackId, trackId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "remove track from playlist failed");
    res.status(500).json({ error: "Failed to remove track" });
  }
});

export default router;
