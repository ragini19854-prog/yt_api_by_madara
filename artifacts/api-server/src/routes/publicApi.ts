import { Router } from "express";
import { requireApiKey } from "../middlewares/apiKeyAuth";
import {
  searchHandler,
  resolveHandler,
  streamHandler,
  relatedHandler,
  downloadHandler,
} from "../lib/youtubeHandlers";

// Public, API-key-gated surface for external integrations — Telegram/
// Discord bots and anything else outside the website itself. Mounted at
// /api/v1 (see routes/index.ts). Same underlying YouTube search/stream
// logic as the website's own routes, just behind requireApiKey.
const router = Router();

router.use(requireApiKey);

router.get("/youtube/search", searchHandler);
router.get("/youtube/resolve", resolveHandler);
router.get("/youtube/stream", streamHandler);
router.get("/youtube/related", relatedHandler);
router.get("/youtube/download", downloadHandler);

export default router;
