import {Router} from "express";
import EpisodeController from "../controllers/episodeController.js";

const router = Router();
const episodeController = new EpisodeController();

router.delete("/:id", episodeController.deleteByEpisodeId);

router.patch("/:id", episodeController.updateByEpisodeId);

export default router;
