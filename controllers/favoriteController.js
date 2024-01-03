const { Router } = require("express");
const favoriteService = require("../services/favoriteService");
const router = Router();

router.get("/", favoriteService.getFavorites);

router.get("/:showId", favoriteService.getFavorite);

router.post("/", favoriteService.addFavorite);

router.delete("/:showId", favoriteService.deleteFavorite);

module.exports = router;