import {Router} from "express";
import AchievementController from "../controllers/achievementController.js";
import cache from "../middlewares/cache.js";

const router = Router();
const achievementController = new AchievementController();

router.get("/", achievementController.getAchievements);

router.get("/tiers", cache(600), achievementController.getTiers);

export default router;
