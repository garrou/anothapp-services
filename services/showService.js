const userSeasonRepository = require("../repositories/userSeasonRepository");
const userShowRepository = require("../repositories/userShowRepository");
const userWatchRepository = require("../repositories/userWatchRepository");
const seasonRepository = require("../repositories/seasonRepository");
const showRepository = require("../repositories/showRepository");
const { search } = require("../services/searchService");
const Season = require("../models/Season");
const Show = require("../models/Show");

/**
 * @param {string} userId
 * @param {string} status
 * @returns Promise
 */
const getShowsByStatus = async (userId, status) => {
    switch (status) {
        case "resume":
            return userShowRepository.getShowsToResumeByUserId(userId);
        case "not-started":
            return userShowRepository.getNotStartedShowsByUserId(userId);
        case "continue":
            return userWatchRepository.getShowsToContinueByUserId(userId);
        case "favorite":
            return userShowRepository.getFavorites(userId);
        default:
            throw new Error("Invalid status");
    }
}

const addShow = async (req, res) => {
    try {
        const { id, title, poster, kinds, duration } = req.body;

        if (!id || !title || !poster || !kinds || !duration) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const exists = await userShowRepository.checkShowExistsByUserIdByShowId(req.user.id, id);

        if (exists) {
            return res.status(409).json({ "message": "Cette série est déjà dans votre collection" });
        }
        const isNewShow = await showRepository.isNewShow(id);

        if (isNewShow) {
            await showRepository.createShow(id, title, poster, kinds.join(";"), duration);
        }
        await userShowRepository.create(req.user.id, id);
        res.status(201).json({ "message": "ok" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const deleteByShowId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await userShowRepository.deleteByUserIdShowId(req.user.id, id);
        res.status(200).json({ "message": "ok" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getShow = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const show = await userShowRepository.getShowByUserIdByShowId(req.user.id, id);

        if (!show) {
            return res.status(404).json({ "message": "Série introuvable " });
        }
        const seasons = await userSeasonRepository.getDistinctByUserIdByShowId(req.user.id, id);
        const [time, episodes] = await userSeasonRepository.getTimeEpisodesByUserIdByShowId(req.user.id, id);

        return res.status(200).json({
            "serie": new Show(show),
            "seasons": seasons.map(season => new Season(season)),
            "time": time,
            "episodes": episodes
        });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getShows = async (req, res) => {
    try {
        const { title, limit, kind, status } = req.query;
        let rows = null;

        if (title) {
            rows = await userShowRepository.getShowsByUserIdByTitle(req.user.id, title);

            if (rows.length === 0) {
                return res.status(200).json(await search(title));
            }
        } else if (kind) {
            rows = await userShowRepository.getShowsByUserIdByKind(req.user.id, kind);
        } else if (status) {
            rows = await getShowsByStatus(req.user.id, status);
        } else {
            rows = await userShowRepository.getShowsByUserId(req.user.id, limit);
        }
        res.status(200).json(rows.map((row) => new Show(row)));
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const addSeasonByShowId = async (req, res) => {
    try {
        const { number, episodes, image } = req.body;
        const showId = req.params.id;

        if (!number || !episodes || !showId) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const rows = await seasonRepository.getSeasonByShowIdByNumber(showId, number);

        if (rows.length === 0) {
            await seasonRepository.createSeason(episodes, number, image, showId);
        }
        await userSeasonRepository.create(req.user.id, showId, number);
        res.status(201).json({ "message": "ok" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getSeasonInfosByShowIdBySeason = async (req, res) => {
    try {
        const { id, num } = req.params;

        if (!id || !num) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const rows = await userSeasonRepository.getInfosByUserIdByShowId(req.user.id, id, num);
        const time = await userSeasonRepository.getViewingTimeByUserIdByShowIdByNumber(req.user.id, id, num);
        const seasons = rows.map(row => ({ id: row.id, addedAt: row.added_at }));
        res.status(200).json({ time, seasons });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const updateWatchingByShowId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await userShowRepository.updateWatchingByUserIdByShowId(req.user.id, id);
        res.status(200).json({ "message": "ok" });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const updateFavoriteByShowId = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const favorite = await userShowRepository.updateFavoriteByUserIdByShowId(req.user.id, id);
        res.status(200).json({ "favorite": favorite });
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}



module.exports = {
    addSeasonByShowId,
    addShow,
    deleteByShowId,
    getSeasonInfosByShowIdBySeason,
    getShow,
    getShows,
    updateFavoriteByShowId,
    updateWatchingByShowId
};