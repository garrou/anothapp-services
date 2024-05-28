const userSeasonRepository = require("../repositories/userSeasonRepository");
const userShowRepository = require("../repositories/userShowRepository");

const getStats = async (req, res) => {
    try {
        const { id } = req.query;
        const userId = id ?? req.user.id;
        res.status(200).json({
            "monthTime": await getTimeByUserIdByType(userId, "month"),
            "totalTime": await getTimeByUserIdByType(userId, "total"),
            "nbSeries": await getCountByUserIdByType(userId, "shows"),
            "nbSeasons": await getCountByUserIdByType(userId, "seasons"),
            "nbEpisodes": await getCountByUserIdByType(userId, "episodes"),
            "bestMonth": (await getTimeByUserIdByType(userId, "best-month"))[0],
        });
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getCountByType = async (req, res) => {
    try {
        const { type, id } = req.query;
        const userId = id ?? req.user.id;
        const total = getCountByUserIdByType(userId, type);
        res.status(200).json(total);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getTimeByType = async (req, res) => {
    try {
        const { type, id } = req.query;
        const userId = id ?? req.user.id;
        const response = await getTimeByUserIdByType(userId, type);
        res.status(200).json(response);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

const getCountGroupedByTypeByPeriod = async (req, res) => {
    try {
        const { type, period, id } = req.query;
        const userId = id ?? req.user.id;
        const response = await getGroupedCountByUserIdByTypeByPeriod(userId, type, period);
        res.status(200).json(response);
    } catch (e) {
        res.status(500).json({ "message": e.message });
    }
}

/**
 * @param {string} userId 
 * @param {string} type 
 * @returns Promise
 */
const getCountByUserIdByType = (userId, type) => {
    switch (type) {
        case "shows":
            return userShowRepository.getTotalShowsByUserId(userId);
        case "episodes":
            return userSeasonRepository.getTotalEpisodesByUserId(userId);
        case "seasons":
            return userSeasonRepository.getTotalSeasonsByUserId(userId);
        default:
            throw new Error("Invalid type");
    }
}

/**
 * @param {string} userId 
 * @param {string} type 
 * @returns Promise
 */
const getTimeByUserIdByType = (userId, type) => {
    switch (type) {
        case "total":
            return userSeasonRepository.getTotalTimeByUserId(userId);
        case "years":
            return userSeasonRepository.getTimeHourByUserIdGroupByYear(userId);
        case "month":
            return userSeasonRepository.getTimeCurrentMonthByUserId(userId);
        case "best-month":
            return userSeasonRepository.getRecordViewingTimeMonth(userId, 1);
        case "rank":
            return userSeasonRepository.getRankingViewingTimeByShows(userId);
        default:
            throw new Error("Invalid type");
    }
}

/**
 * @param {string} userId 
 * @param {string} type 
 * @param {string} period
 * @return Promise
 */
const getGroupedCountByUserIdByTypeByPeriod = (userId, type, period) => {
    switch (type) {
        case "seasons":
            return getNbSeasonsByUserIdByPeriod(userId, period);
        case "episodes":
            return getNbEpisodesByUserIdByPeriod(userId, period);
        case "kinds":
            return getNbKindsByUserId(userId);
        case "best-months":
            return userSeasonRepository.getRecordViewingTimeMonth(userId, 10);
        default:
            throw new Error("Invalid type");
    }
}

/**
 * @param {string} userId
 * @param {string} period
 * @return Promise
 */
const getNbSeasonsByUserIdByPeriod = (userId, period) => {
    switch (period) {
        case "years":
            return userSeasonRepository.getNbSeasonsByUserIdGroupByYear(userId);
        case "year":
            return userSeasonRepository.getNbSeasonsByUserIdGroupByMonthByCurrentYear(userId);
        case "months":
            return userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(userId);
        default:
            throw new Error("Invalid period");
    }
}

/**
 * @param {string} userId
 * @param {string} period 
 * @return Promise
 */
const getNbEpisodesByUserIdByPeriod = (userId, period) => {
    switch (period) {
        case "years":
            return userSeasonRepository.getNbEpisodesByUserIdGroupByYear(userId);
        case "year":
            return userSeasonRepository.getNbEpisodesByUserIdGroupByMonthByCurrentYear(userId);
        default:
            throw new Error("Invalid period");
    }
}

/**
 * @param {string} userId
 * @return Promise<any[]>
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
    getStats,
    getTimeByType,
}