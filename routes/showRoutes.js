import {Router} from "express";
import ShowController from "../controllers/showController.js";

const router = Router();
const showController = new ShowController();

router.post("/", showController.addShow);

router.get("/", showController.getShows);

router.get("/:id", showController.getShow);

router.delete("/:id", showController.deleteByShowId);

router.patch("/:id", showController.updateByShowId);

router.post("/:id/seasons", showController.addSeasonByShowId);

router.get("/:id/seasons/:num", showController.getSeasonInfosByShowIdBySeason);

router.post("/:id/episodes", showController.addEpisodeByShowId);

router.get("/:id/seasons/:num/episodes", showController.getEpisodesByShowIdBySeason);

router.get("/:id/episodes/:episodeId", showController.getEpisodeInfosByShowIdByEpisode);

export default router;