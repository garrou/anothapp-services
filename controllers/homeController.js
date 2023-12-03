const { Router } = require("express");
const homeService = require("../services/homeService");

const router = Router();

router.get("/images", homeService.getShowsImages);

module.exports = router;