const userSeasonRepository = require("../repositories/userSeasonRepository");
const userShowRepository = require("../repositories/userShowRepository");

const getCountByType = async (req, res) => {
    try {
        const { type } = req.query;
        let response = null;

        switch (type) {
            case "shows":
                response = (await userShowRepository.getByUserId(req.user.id)).rowCount;
                break;
            case "episodes":
                response = (await userSeasonRepository.getTotalEpisodesByUserId(req.user.id))["rows"][0].total;
                break;
            default:
                throw new Error("Invalid type");
        }
        res.status(200).json(response);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getTimeByType = async (req, res) => {
    try {
        const { type } = req.query;
        let response = null;

        switch (type) {
            case "total":
                response = (await userSeasonRepository.getTotalTimeByUserId(req.user.id))["rows"][0]["time"];
                break;
            case "years":
                response = (await userSeasonRepository.getTimeHourByUserIdGroupByYear(req.user.id))["rows"];
                break;
            case "month":
                response = (await userSeasonRepository.getTimeCurrentMonthByUserId(req.user.id))["rows"][0].time;
                break;
            case "best-month":
                response = (await userSeasonRepository.getRecordViewingTimeMonth(req.user.id))["rows"][0];
                break;
            case "rank":
                response = (await userSeasonRepository.getRankingViewingTimeByShows(req.user.id))["rows"];
                break;
            default:
                throw new Error("Invalid type");
        }
        res.status(200).json(response);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

const getCountGroupedByTypeByPeriod = async (req, res) => {
    try {
        const { type, period } = req.query;
        let response = null;

        if (type === "seasons") {
            if (period === "years") {
                response = (await userSeasonRepository.getNbSeasonsByUserIdGroupByYear(req.user.id))["rows"];
            } else if (period === "months") {
                response = (await userSeasonRepository.getNbSeasonsByUserIdGroupByMonth(req.user.id))["rows"];
            }
        } else if (type === "episodes" && period === "years") {
            response = (await userSeasonRepository.getNbEpisodesByUserIdGroupByYear(req.user.id))['rows'];
        }
        res.status(200).json(response);
    } catch (_) {
        res.status(500).json({ "message": "Une erreur est survenue" });
    }
}

module.exports = {
    getCountByType,
    getCountGroupedByTypeByPeriod,
    getTimeByType,
}