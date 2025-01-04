import { Router } from "express";
import statService from "../services/statService.js";

const router = Router();

router.get("/", statService.getStats);

router.get("/count", statService.getCountByType);

router.get("/time", statService.getTimeByType);

router.get("/grouped-count", statService.getCountGroupedByTypeByPeriod);

export default router;