const { Router } = require("express");
const searchService = require("../services/searchService");

const router = Router();

router.get("/shows", searchService.discoverShows);

router.get("/shows/:showId", searchService.getByShowId);

router.get("/shows/:showId/seasons", searchService.getSeasonsByShowId);

router.get("/shows/:showId/seasons/:num/episodes", searchService.getEpisodesByShowIdBySeason);

router.get("/shows/:showId/characters", searchService.getCharactersByShowId);

router.get("/shows/:showId/similars", searchService.getSimilarsByShowId);

router.get("/shows/:showId/images", searchService.getImagesByShowId);

router.get("/kinds", searchService.getKinds);

router.get("/persons/:personId", searchService.getPersonById);

module.exports = router;