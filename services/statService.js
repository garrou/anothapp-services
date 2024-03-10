const userSeasonRepository = require("../repositories/userSeasonRepository");
const userShowRepository = require("../repositories/userShowRepository");

const getCountByType = async (req, res) => {
    try {
        const { type, id } = req.query;
        const userId = id ?? req.user.id;
        let total = 0;

        switch (type) {
            case "shows":
                total = await userShowRepository.getTotalShowsByUserId(userId);
                break;
            case "episodes":
                total = await userSeasonRepository.getTotalEpisodesByUserId(userId);
                break;
            case "seasons":
                total = await userSeasonRepository.getTotalSeasonsByUserId(userId);
                break;
            default:
                throw new Error("Invalid type");
        }
        res.status(200).json(total);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getTimeByType = async (req, res) => {
    try {
        const { type, id } = req.query;
        const userId = id ?? req.user.id;
        let response = null;

        switch (type) {
            case "total":
                response = await userSeasonRepository.getTotalTimeByUserId(userId);
                break;
            case "years":
                response = await userSeasonRepository.getTimeHourByUserIdGroupByYear(userId);
                break;
            case "month":
                response = await userSeasonRepository.getTimeCurrentMonthByUserId(userId);
                break;
            case "best-month":
                response = await userSeasonRepository.getRecordViewingTimeMonth(userId);
                break;
            case "rank":
                response = (await userSeasonRepository.getRankingViewingTimeByShows(userId)).reverse();
                break;
            default:
                throw new Error("Invalid type");
        }
        res.status(200).json(response ?? []);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getCountGroupedByTypeByPeriod = async (req, res) => {
    try {
        const { type, period, id } = req.query;
        const userId = id ?? req.user.id;
        let response = null;

        switch (type) {
            case "seasons":
                response = await getNbSeasonsByUserIdByPeriod(userId, period);
                break;
            case "episodes":
                response = await getNbEpisodesByUserIdByPeriod(userId, period);
                break;
            case "kinds":
                response = await getNbKindsByUserId(userId);
                break;
            default:
                throw new Error("Invalid type");
        }
        res.status(200).json(response ?? []);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

/**
 * @param {string} userId
 * @param {string} period
 * @return Promise
 */
const getNbSeasonsByUserIdByPeriod = async (userId, period) => {
    switch (period) {
        case "years":
            return await userSeasonRepository.getNbSeasonsByUserIdGroupByYear(userId);
        case "months":
            return await userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(userId);
        case "current-year":
            return await userSeasonRepository.getNbSeasonsByUserIdByCurrentYear(userId);
        default:
            throw new Error("Invalid period");
    }
}

/**
 * @param {string} userId
 * @param {string} period 
 * @return Promise
 */
const getNbEpisodesByUserIdByPeriod = async (userId, period) => {
    switch (period) {
        case "years":
            return await userSeasonRepository.getNbEpisodesByUserIdGroupByYear(userId);
        default:
            throw new Error("Invalid period");
    }
}

/**
 * @param {string} userId
 * @return Promise
 */
const getNbKindsByUserId = async (userId) => {
    const kindsMap = new Map();
    const rows = await userShowRepository.getKindsByUserId(userId);

    rows.forEach((row) => row["kinds"]
        .split(";")
        .forEach((kind) => {
            const val = kindsMap.get(kind);
            !val ? kindsMap.set(kind, 1) : kindsMap.set(kind, val + 1);
        })
    );
    return Array
        .from(kindsMap, ([kind, occur]) => ({ "label": kind, "value": occur }))
        .sort((a, b) => b.value - a.value)
        .splice(0, 10)
        .reverse();
}

module.exports = {
    getCountByType,
    getCountGroupedByTypeByPeriod,
    getTimeByType,
}