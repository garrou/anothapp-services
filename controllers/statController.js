import StatService from "../services/statService.js";

export default class StatController {
    constructor() {
        this._statService = new StatService();
    }

    getStats = async (req, res, next) => {
        try {
            const {id} = req.query;
            const stats = await this._statService.getStats(id ?? req.userId);
            res.status(200).json(stats);
        } catch (e) {
            next(e);
        }
    }

}