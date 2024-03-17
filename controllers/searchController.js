const { Router } = require("express");
const searchService = require("../services/searchService");
const cache = require("../middlewares/cache");

const router = Router();

router.get("/shows", cache(3600), searchService.discoverShows);

router.get("/shows/:showId", cache(3600), searchService.getByShowId);

router.get("/shows/:showId/seasons", cache(3600), searchService.getSeasonsByShowId);

router.get("/shows/:showId/seasons/:num/episodes", cache(3600), searchService.getEpisodesByShowIdBySeason);

router.get("/shows/:showId/characters", cache(3600), searchService.getCharactersByShowId);

router.get("/shows/:showId/similars", cache(3600), searchService.getSimilarsByShowId);

router.get("/shows/:showId/images", cache(3600), searchService.getImagesByShowId);

router.get("/kinds", cache(3600), searchService.getKinds);

router.get("/persons/:personId", cache(3600), searchService.getPersonById);

module.exports = router;