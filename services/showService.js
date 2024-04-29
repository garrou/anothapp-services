const userSeasonRepository = require("../repositories/userSeasonRepository");
const userShowRepository = require("../repositories/userShowRepository");
const seasonRepository = require("../repositories/seasonRepository");
const showRepository = require("../repositories/showRepository");
const { search } = require("../services/searchService");
const Season = require("../models/Season");
const Show = require("../models/Show");
const { cumulate } = require("../helpers/utils");

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
            return userShowRepository.getShowsToContinueByUserId(userId);
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
        const [time, nbEpisodes] = await userSeasonRepository.getTimeEpisodesByUserIdByShowId(req.user.id, id);
        const episodes = cumulate(seasons);
        const mapSeasons = seasons.map((s, i) => {
            const season = new Season(s);
            season.interval = `${episodes[i] + 1} - ${episodes[i + 1]}`;
            return season;
        });
        
        return res.status(200).json({
            "serie": new Show(show),
            "seasons": mapSeasons,
            "time": time,
            "episodes": nbEpisodes
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

const updateByShowId = async (req, res) => {
    try {
        const { id } = req.params;
        const { favorite, watch } = req.body;
        let result = null;

        if (!id || (!favorite && !watch)) {
            return res.status(400).json({ "message": "Requête invalide" });
        } else if (favorite) {
            result = await userShowRepository.updateFavoriteByUserIdByShowId(req.user.id, id);
        } else if (watch) {
            result = await userShowRepository.updateWatchingByUserIdByShowId(req.user.id, id);
        }
        res.status(200).json({ "favorite": result });
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
    updateByShowId,
};