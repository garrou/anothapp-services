const userSeasonRepository = require("../repositories/userSeasonRepository");
const userShowRepository = require("../repositories/userShowRepository");
const seasonRepository = require("../repositories/seasonRepository");
const showRepository = require("../repositories/showRepository");
const Season = require("../models/Season");
const Show = require("../models/Show");
const { idValidShow } = require("../helpers/validator");
const { cumulate } = require("../helpers/utils");
const UserSeason = require("../models/UserSeason");

/**
 * @param {string} userId
 * @param {string} status
 * @param {string?} friendId
 * @returns Promise
 */
const getShowsByStatus = (userId, status, friendId) => {
    switch (status) {
        case "resume":
            return userShowRepository.getShowsToResumeByUserId(userId);
        case "not-started":
            return userShowRepository.getNotStartedShowsByUserId(userId);
        case "continue":
            return userShowRepository.getShowsToContinueByUserId(userId);
        case "favorite":
            return userShowRepository.getFavoritesByUserId(userId);
        case "shared":
            if (!friendId) throw new Error("Requête invalide");
            return userShowRepository.getSharedShowsWithFriend(userId, friendId);
        default:
            throw new Error("Requête invalide");
    }
}

const addShow = async (req, res) => {
    try {
        if (!idValidShow(req.body)) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const { id, title, poster, kinds, duration, seasons, country, list } = req.body;
        const addInList = !!list;

        const exists = await userShowRepository.checkShowExistsByUserIdByShowId(req.user.id, id, addInList);

        if (exists) {
            return res.status(409).json({ "message": `Cette série est déjà dans votre ${addInList ? "liste" : "collection"}` });
        }
        const isNewShow = await showRepository.isNewShow(id);

        if (isNewShow) {
            await showRepository.createShow(id, title, poster, kinds.join(";"), duration, parseInt(seasons), country);
        }
        await userShowRepository.create(req.user.id, id, addInList);
        res.status(201).json({ "message": "ok" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const deleteByShowId = async (req, res) => {
    try {
        const { id } = req.params;
        const { list } = req.query;
        const deleteInList = (/true/i).test(list);

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        await userShowRepository.deleteByUserIdShowId(req.user.id, id, deleteInList);
        res.status(200).json({ "message": "ok" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getShow = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ "message": "Requête invalide" });
        }/*
        const show = await userShowRepository.getShowByUserIdByShowId(req.user.id, id);

        if (!show) {
            return res.status(404).json({ "message": "Série introuvable" });
        }*/
        const seasons = await userSeasonRepository.getDistinctByUserIdByShowId(req.user.id, id);
        const [time, nbEpisodes] = await userSeasonRepository.getTimeEpisodesByUserIdByShowId(req.user.id, id);
        const episodes = cumulate(seasons);
        const mapSeasons = seasons.map((s, i) => new Season(s, `${episodes[i] + 1} - ${episodes[i + 1]}`));
        return res.status(200).json({
            // "serie": new Show(show),
            "seasons": mapSeasons,
            "time": time,
            "episodes": nbEpisodes
        });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getShows = async (req, res) => {
    try {
        const { title, limit, kind, status, friendId, platform } = req.query;
        let rows = null;

        if (title) {
            rows = await userShowRepository.getShowsByUserIdByTitle(req.user.id, title);
        } else if (kind) {
            rows = await userShowRepository.getShowsByUserIdByKind(req.user.id, kind);
        } else if (status) {
            rows = await getShowsByStatus(req.user.id, status, friendId);
        } else if (platform) {
            rows = await userShowRepository.getShowsByUserIdByPlatform(req.user.id, platform);
        } else {
            rows = await userShowRepository.getShowsByUserId(req.user.id, limit);
        }
        res.status(200).json(rows.map((row) => new Show(row)));
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const addSeasonByShowId = async (req, res) => {
    try {
        const { season, serie } = req.body;

        if (!serie || !serie.id || !season || !season.number || !season.episodes) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const rows = await seasonRepository.getSeasonByShowIdByNumber(serie.id, season.number);

        if (rows.length === 0) {
            await seasonRepository.createSeason(season.episodes, season.number, season.image ?? serie.poster, serie.id);
        }
        await userSeasonRepository.create(req.user.id, serie.id, season.number);
        res.status(201).json({ "message": "ok" });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getSeasonInfosByShowIdBySeason = async (req, res) => {
    try {
        const { id, num } = req.params;

        if (!id || !num) {
            return res.status(400).json({ "message": "Requête invalide" });
        }
        const rows = await userSeasonRepository.getInfosByUserIdByShowId(req.user.id, id, num);
        // const time = await userSeasonRepository.getViewingTimeByUserIdByShowIdByNumber(req.user.id, id, num);
        const seasons = rows.map(row => new UserSeason(row));
        res.status(200).json(seasons);
    } catch (e) {
        res.status(500).json({ "message": e.message });
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
        res.status(200).json({ "value": result });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}



module.exports = {
    addSeasonByShowId,
    addShow,
    deleteByShowId,
    getSeasonInfosByShowIdBySeason,
    getShow,
    getShows,
    updateByShowId
};