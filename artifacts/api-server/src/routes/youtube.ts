import { Router } from "express";
import {
  searchHandler,
  resolveHandler,
  streamHandler,
  relatedHandler,
  downloadHandler,
} from "../lib/youtubeHandlers";

// Internal routes used by the Madara Music website itself. Left open
// (no API key) so guest visitors can search and play music without
// signing in — that's the core free product. External/programmatic
// access (bots etc.) should use the API-key-protected surface mounted
// at /api/v1/youtube/* instead — see routes/publicApi.ts.
const router = Router();

router.get("/music/youtube/search", searchHandler);
router.get("/music/youtube/resolve", resolveHandler);
router.get("/music/youtube/stream", streamHandler);
router.get("/music/youtube/related", relatedHandler);
router.get("/music/youtube/download", downloadHandler);

export default router;
