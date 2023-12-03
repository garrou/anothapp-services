const { Router } = require("express");
const showService = require("../services/showService");

const router = Router();

router.post("/", showService.addShow);

router.get("/", showService.getShows);

router.delete("/:id", showService.deleteByShowId);

router.patch("/:id/watching", showService.updateWatchingByShowId);

router.post("/:id/seasons", showService.addSeasonByShowId);

router.get("/:id/seasons", showService.getDistinctByShowId);

router.get("/:id/seasons/:num", showService.getSeasonInfosByShowIdBySeason);

router.get("/:id/time", showService.getViewingTimeByShowId);

router.get("/:id/seasons/:num/time", showService.getViewingTimeByShowIdBySeason);

router.get("/viewed", showService.getViewedByMonthAgo);

router.get("/continue", showService.getShowsToContinue);

router.get("/resume", showService.getShowsToResume);

router.get("/not-started", showService.getNotStartedShows);

module.exports = router;