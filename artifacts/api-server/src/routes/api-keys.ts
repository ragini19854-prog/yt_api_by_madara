import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

function generateKey(): string {
  return "mm_" + crypto.randomBytes(32).toString("hex");
}

// GET /api/keys — list all API keys for the current user
router.get("/keys", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const keys = await db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.userId, userId))
      .orderBy(apiKeysTable.createdAt);
    // Mask the key value for security — show only first 12 + last 4 chars
    const masked = keys.map((k) => ({
      ...k,
      key: k.key.slice(0, 12) + "••••••••••••••••••••••••" + k.key.slice(-4),
    }));
    res.json(masked);
  } catch (err) {
    req.log.error({ err }, "List API keys failed");
    res.status(500).json({ error: "Failed to list keys" });
  }
});

// POST /api/keys — generate a new API key
router.post("/keys", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const name: string = (req.body?.name as string) || "Default Key";

  try {
    const key = generateKey();
    const [created] = await db
      .insert(apiKeysTable)
      .values({ userId, key, name, active: true })
      .returning();

    // Return the full key ONCE — it won't be shown in full again
    res.status(201).json({ ...created, revealed: true });
  } catch (err) {
    req.log.error({ err }, "Create API key failed");
    res.status(500).json({ error: "Failed to create key" });
  }
});

// DELETE /api/keys/:id — revoke an API key
router.delete("/keys/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params["id"]);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid key id" }); return; }

  try {
    await db
      .delete(apiKeysTable)
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete API key failed");
    res.status(500).json({ error: "Failed to delete key" });
  }
});

// PATCH /api/keys/:id — rename a key
router.patch("/keys/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = Number(req.params["id"]);
  if (!id || isNaN(id)) { res.status(400).json({ error: "Invalid key id" }); return; }

  const name: string = (req.body?.name as string) || "Key";

  try {
    const [updated] = await db
      .update(apiKeysTable)
      .set({ name })
      .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Key not found" }); return; }
    res.json({ ...updated, key: updated.key.slice(0, 12) + "••••••••••••••••••••••••" + updated.key.slice(-4) });
  } catch (err) {
    req.log.error({ err }, "Rename API key failed");
    res.status(500).json({ error: "Failed to rename key" });
  }
});

export default router;
