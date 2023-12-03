const { Router } = require("express");
const statService = require("../services/statService");

const router = Router();

router.get("/count", statService.getCountByType);

router.get("/time", statService.getTimeByType);

router.get("/grouped-count", statService.getCountGroupedByTypeByPeriod);

module.exports = router;