import { Router } from "express";
import showService from "../services/showService.js";

const router = Router();

router.post("/", showService.addShow);

router.get("/", showService.getShows);

router.get("/:id", showService.getShow);

router.delete("/:id", showService.deleteByShowId);

router.patch("/:id", showService.updateByShowId);

router.post("/:id/seasons", showService.addSeasonByShowId);

router.get("/:id/seasons/:num", showService.getSeasonInfosByShowIdBySeason);

export default router;