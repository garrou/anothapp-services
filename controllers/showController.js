const { Router } = require("express");
const showService = require("../services/showService");

const router = Router();

router.post("/", showService.addShow);

router.get("/", showService.getShows);

router.get("/:id", showService.getShow);

router.delete("/:id", showService.deleteByShowId);

router.patch("/:id/watching", showService.updateWatchingByShowId);

router.patch("/:id/favorite", showService.updateFavoriteByShowId);

router.post("/:id/seasons", showService.addSeasonByShowId);

router.get("/:id/seasons/:num", showService.getSeasonInfosByShowIdBySeason);

router.get("/:id/seasons/:num/time", showService.getViewingTimeByShowIdBySeason);

router.get("/viewed", showService.getViewedByMonthAgo);

router.get("/continue", showService.getShowsToContinue);

router.get("/resume", showService.getShowsToResume);

router.get("/not-started", showService.getNotStartedShows);

module.exports = router;