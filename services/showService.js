const { getImageUrl } = require("../helpers/image");
const userSeasonRepository = require("../repositories/userSeasonRepository");
const userShowRepository = require("../repositories/userShowRepository");
const userWatchRepository = require("../repositories/userWatchRepository");
const seasonRepository = require("../repositories/seasonRepository");
const showRepository = require("../repositories/showRepository");
const { search } = require("../services/searchService");
const Season = require("../models/Season");
const Show = require("../models/Show");

const MONTH = ["0", "1", "2", "3", "6", "12"];

const addShow = async (req, res) => {
    try {
        const { id, title, images, kinds } = req.body;

        if (!id || !title) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const exists = await userShowRepository.checkShowExistsByUserIdByShowId(req.user.id, id);

        if (exists) {
            return res.status(409).json({ "message": "Cette série est déjà dans votre collection" });
        }
        const isNewShow = await showRepository.isNewShow(id);

        if (isNewShow) {
            await showRepository.createShow(id, title, getImageUrl(images), kinds);
        }
        await userShowRepository.create(req.user.id, id);

        res.status(201).json({
            "id": id,
            "title": title,
            "poster": getImageUrl(images),
        });
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
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ "message": "Requête invalide" });
    }
    const show = await userShowRepository.getShowByUserIdByShowId(req.user.id, id);
    
    if (!show) {
        return res.status(404).json({ "message": "Série introuvable "});
    }
    const seasons =  await userSeasonRepository.getDistinctByUserIdByShowId(req.user.id, id);
    const time = await userSeasonRepository.getViewingTimeByUserIdByShowId(req.user.id, id);

    return res.status(200).json({
        "serie": new Show(show),
        "seasons": seasons.map(season => new Season(season)),
        "time": time,
    });
}

const getShows = async (req, res) => {
    try {
        const { title, limit, kind } = req.query;
        let rows = null;

        if (title) {
            rows = await userShowRepository.getShowsByUserIdByTitle(req.user.id, title);

            if (rows.length === 0) {
                return res.status(200).json(await search(title));
            }
        } else if (kind) {
            rows = await userShowRepository.getShowsByUserIdByKind(req.user.id, kind);
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
        const { number, episode, image, duration } = req.body;
        const showId = req.params.id;

        if (!number || !episode || !showId || !duration) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const rows = await seasonRepository.getSeasonByShowIdByNumber(showId, number);

        if (rows.length === 0) {
            await seasonRepository.createSeason(episode, number, image, showId, duration);
        }
        await userSeasonRepository.create(req.user.id, showId, number);
        res.status(201).json(rows.length === 1 ? rows[0] : null);
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
        const infos = rows.map(e => ({ id: e.id, addedAt: e.added_at }));
        res.status(200).json(infos);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getViewingTimeByShowIdBySeason = async (req, res) => {
    try {
        const { id, num } = req.params;

        if (!id || !num) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const time = await userSeasonRepository.getViewingTimeByUserIdByShowIdByNumber(req.user.id, id, num);
        res.status(200).json(time);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getViewedByMonthAgo = async (req, res) => {
    try {
        const { month, id } = req.query;
        const userId = id ?? req.user.id;

        if (!MONTH.includes(month)) {
            return res.status(400).json({ "message": `Choix non valide ${month}` });
        }
        const rows = await userSeasonRepository.getViewedByMonthAgo(userId, month);
        res.status(200).json(rows);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getNotStartedShows = async (req, res) => {
    try {
        const rows = await userShowRepository.getNotStartedShowsByUserId(req.user.id);
        res.status(200).json(rows);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getShowsToContinue = async (req, res) => {
    try {
        const rows = await userWatchRepository.getShowsToContinueByUserId(req.user.id);
        res.status(200).json(rows);
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

const getShowsToResume = async (req, res) => {
    try {
        const rows = await userShowRepository.getShowsToResumeByUserId(req.user.id);
        res.status(200).json(rows);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    addSeasonByShowId,
    addShow,
    deleteByShowId,
    getNotStartedShows,
    getSeasonInfosByShowIdBySeason,
    getShow,
    getShows,
    getShowsToContinue,
    getShowsToResume,
    getViewedByMonthAgo,
    getViewingTimeByShowIdBySeason,
    updateFavoriteByShowId,
    updateWatchingByShowId
};