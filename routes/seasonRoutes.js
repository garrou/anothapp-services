import {Router} from "express";
import SeasonController from "../controllers/seasonController.js";

const router = Router();
const seasonController = new SeasonController();

router.get("/", seasonController.getSeasons);

router.get("/:id/episodes", seasonController.getEpisodesBySeasonId);

router.post("/:id/episodes/:episodeId", seasonController.addEpisodeViewing);

router.delete("/:id", seasonController.deleteBySeasonId);

router.patch("/:id", seasonController.updateBySeasonId);

export default router;