const { Router } = require("express");
const favoriteService = require("../services/favoriteService");
const router = Router();

router.get("/", favoriteService.getFavorites);

router.post("/", favoriteService.addFavorites);

module.exports = router;