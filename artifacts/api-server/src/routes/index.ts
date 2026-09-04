import { Router, type IRouter } from "express";
import healthRouter from "./health";
import musicRouter from "./music";
import playlistsRouter from "./playlists";
import favoritesRouter from "./favorites";
import historyRouter from "./history";
import youtubeRouter from "./youtube";
import apiKeysRouter from "./api-keys";
import publicApiRouter from "./publicApi";

const router: IRouter = Router();

router.use(healthRouter);
router.use(musicRouter);
router.use(youtubeRouter);
router.use(playlistsRouter);
router.use(favoritesRouter);
router.use(historyRouter);
router.use(apiKeysRouter);
router.use("/v1", publicApiRouter);

export default router;
