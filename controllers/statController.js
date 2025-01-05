import StatService from "../services/statService.js";

export default class StatController {
    constructor() {
        this.statService = new StatService();
    }

    getStats = async (req, res, next) => {
        try {
            const { id } = req.query;
            const stats = await this.statService.getStats(id ?? req.userId);
            res.status(200).json(stats);
        } catch (e) {
            next(e);
        }
    }

    getCountByType = async (req, res, next) => {
        try {
            const { type, id } = req.query;
            const total = await this.statService.getCountByUserIdByType(id ?? req.userId, type);
            res.status(200).json(total);
        } catch (e) {
            next(e);
        }
    }

    getTimeByType = async (req, res, next) => {
        try {
            const { type, id } = req.query;
            const response = await this.statService.getTimeByUserIdByType(id ?? req.userId, type);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    getCountGroupedByTypeByPeriod = async (req, res, next) => {
        try {
            const { type, period, id } = req.query;
            const response = await this.statService.getGroupedCountByUserIdByTypeByPeriod(id ?? req.userId, type, period);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }
}