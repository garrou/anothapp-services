const { Router } = require("express");
const seasonService = require("../services/seasonService");

const router = Router();

router.get("/", seasonService.getSeasons);

router.delete("/:id", seasonService.deleteBySeasonId);

router.patch("/:id", seasonService.updateBySeasonId);

module.exports = router;