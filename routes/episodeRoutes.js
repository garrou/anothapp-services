import {Router} from "express";
import EpisodeController from "../controllers/episodeController.js";

const router = Router();
const episodeController = new EpisodeController();

router.post("/:id/watch", episodeController.watchByEpisodeId);

router.delete("/:id/watch", episodeController.unwatchByEpisodeId);

export default router;
