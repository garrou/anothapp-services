import {Router} from "express";
import AchievementController from "../controllers/achievementController.js";
import cache from "../middlewares/cache.js";
import { TIERS_CACHE_TTL_SECONDS } from "../constants/achievements.js";

const router = Router();
const achievementController = new AchievementController();

router.get("/", achievementController.getAchievements);

router.get("/tiers", cache(TIERS_CACHE_TTL_SECONDS), achievementController.getTiers);

export default router;
