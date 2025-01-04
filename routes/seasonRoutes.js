import { Router } from "express";
import seasonService from "../services/seasonService.js";

const router = Router();

router.get("/", seasonService.getSeasons);

router.delete("/:id", seasonService.deleteBySeasonId);

router.patch("/:id", seasonService.updateBySeasonId);

export default router;