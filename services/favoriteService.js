const favoriteRepository = require("../repositories/favoriteRepository");

const getFavorites = async (req, res) => {
    try {
        const resp = await favoriteRepository.getFavorites(req.user.id);
        res.status(200).json(resp["rows"]);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getFavorite = async (req, res) => {
    try {
        const { showId } = req.params;
        const resp = await favoriteRepository.getFavorite(req.user.id, showId);
        const isFavorite = parseInt(resp["rows"][0]["count"]) === 1;
        res.status(200).json(isFavorite);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const addFavorite = async (req, res) => {
    try {
        const { showId } = req.body;
        await favoriteRepository.addFavorite(req.user.id, showId);
        res.sendStatus(201);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const deleteFavorite = async (req, res) => {
    try {
        const { showId } = req.params;
        await favoriteRepository.deleteFavorite(req.user.id, showId);
        res.sendStatus(204);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    addFavorite,
    deleteFavorite,
    getFavorite,
    getFavorites
};