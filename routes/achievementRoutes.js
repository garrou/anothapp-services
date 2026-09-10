import {Router} from "express";
import AchievementController from "../controllers/achievementController.js";

const router = Router();
const achievementController = new AchievementController();

router.get("/", achievementController.getAchievements);

export default router;
