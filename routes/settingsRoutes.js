import {Router} from "express";
import SettingsController from "../controllers/settingsController.js";

const router = Router();
const settingsController = new SettingsController();

router.get("/export-data", settingsController.exportData);

export default router;