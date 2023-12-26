const favoriteRepository = require("../repositories/favoriteRepository");

const getFavorites = async (req, res) => {
    try {
        const resp = await favoriteRepository.getFavoritesByUserId(req.user.id);
        res.status(200).json(resp["rows"]);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const addFavorites = async (req, res) => {
    try {
        // TODO: body
        await favoriteRepository.addFavorites(req.user.id, 10);
        res.sendStatus(201);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    addFavorites,
    getFavorites
};