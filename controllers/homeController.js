const { Router } = require("express");
const homeService = require("../services/homeService");
const cache = require("../middlewares/cache");

const router = Router();

router.get("/images", cache(3600), homeService.getShowsImages);

module.exports = router;