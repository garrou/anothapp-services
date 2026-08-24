import {Router} from "express";
import EpisodeController from "../controllers/episodeController.js";

const router = Router();
const episodeController = new EpisodeController();

router.get("/", episodeController.getViewedByMonthAgo);

router.patch("/:id", episodeController.updateViewing);

router.delete("/:id", episodeController.deleteViewing);

export default router;
