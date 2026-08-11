import {Router} from "express";
import SettingsController from "../controllers/settingsController.js";
import { exportLimiter } from "../middlewares/rateLimit.js";

const router = Router();
const settingsController = new SettingsController();

router.get("/export-data", exportLimiter, settingsController.exportData);

export default router;