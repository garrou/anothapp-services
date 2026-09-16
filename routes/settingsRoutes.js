import {Router} from "express";
import SettingsController from "../controllers/settingsController.js";
import { exportLimiter, importLimiter } from "../middlewares/rateLimit.js";

const router = Router();
const settingsController = new SettingsController();

router.get("/export-data", exportLimiter, settingsController.exportData);
router.post("/import-data", importLimiter, settingsController.importData);

export default router;