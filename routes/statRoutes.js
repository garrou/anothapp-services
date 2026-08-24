import {Router} from "express";
import StatController from "../controllers/statController.js";

const router = Router();
const statController = new StatController();

router.get("/", statController.getStats);

export default router;