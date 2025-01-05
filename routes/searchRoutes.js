import {Router} from "express";
import SearchController from "../controllers/searchController.js";

const router = Router();
const searchController = new SearchController();

router.get("/images", searchController.getImages);

router.get("/shows", searchController.getShows);

router.get("/shows/:showId", searchController.getByShowId);

router.get("/shows/:showId/seasons", searchController.getSeasonsByShowId);

router.get("/shows/:showId/seasons/:num/episodes", searchController.getEpisodesByShowIdBySeason);

router.get("/shows/:showId/characters", searchController.getCharactersByShowId);

router.get("/shows/:showId/similars", searchController.getSimilarsByShowId);

router.get("/shows/:showId/images", searchController.getImagesByShowId);

router.get("/kinds", searchController.getKinds);

router.get("/platforms", searchController.getPlatforms);

router.get("/persons/:personId", searchController.getPersonById);

export default router;