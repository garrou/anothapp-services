import StatService from "../services/statService.js";

export default class StatController {
    constructor() {
        this._statService = new StatService();
    }

    getStats = async (req, res, next) => {
        try {
            const {id} = req.query;
            const stats = await this._statService.getStats(req.userId, id);
            res.status(200).json(stats);
        } catch (e) {
            next(e);
        }
    }

    getWrapped = async (req, res, next) => {
        try {
            const {year} = req.query;
            const wrapped = await this._statService.getWrapped(req.userId, year);
            res.status(200).json(wrapped);
        } catch (e) {
            next(e);
        }
    }

}