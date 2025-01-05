import {Router} from "express";
import StatController from "../controllers/statController.js";

const router = Router();
const statController = new StatController();

router.get("/", statController.getStats);

router.get("/count", statController.getCountByType);

router.get("/time", statController.getTimeByType);

router.get("/grouped-count", statController.getCountGroupedByTypeByPeriod);

export default router;