import {Router} from "express";
import StatController from "../controllers/statController.js";

const router = Router();
const statController = new StatController();

router.get("/", statController.getStats);

router.get("/wrapped", statController.getWrapped);

router.get("/leaderboard", statController.getLeaderboard);

export default router;