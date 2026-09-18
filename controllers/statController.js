import StatService from "../services/statService.js";

export default class StatController {
    constructor() {
        this._statService = new StatService();
    }

    /**
     * @returns {Promise<void>}
     */
    getStats = async (req, res, next) => {
        try {
            const {id} = req.query;
            const stats = await this._statService.getStats(req.userId, id);
            res.status(200).json(stats);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    getWrapped = async (req, res, next) => {
        try {
            const {year} = req.query;
            const wrapped = await this._statService.getWrapped(req.userId, year);
            res.status(200).json(wrapped);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    getLeaderboard = async (req, res, next) => {
        try {
            const leaderboard = await this._statService.getLeaderboard(req.userId);
            res.status(200).json(leaderboard);
        } catch (e) {
            next(e);
        }
    }

}