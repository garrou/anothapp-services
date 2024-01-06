const favoriteRepository = require("../repositories/favoriteRepository");

const getFavorites = async (req, res) => {
    try {
        const { id } = req.query;
        const userId = id ?? req.user.id;
        
        if (!userId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const resp = await favoriteRepository.getFavorites(userId);
        res.status(200).json(resp["rows"]);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const isFavorite = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const isFavorite = await favoriteRepository.isFavorite(req.user.id, showId);
        console.log(isFavorite)
        res.status(200).json(isFavorite);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const addFavorite = async (req, res) => {
    try {
        const { showId } = req.body;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await favoriteRepository.addFavorite(req.user.id, showId);
        res.sendStatus(201);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const deleteFavorite = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await favoriteRepository.deleteFavorite(req.user.id, showId);
        res.sendStatus(204);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    addFavorite,
    deleteFavorite,
    getFavorites,
    isFavorite,
};
