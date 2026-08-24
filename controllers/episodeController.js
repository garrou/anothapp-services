import EpisodeService from "../services/episodeService.js";

export default class EpisodeController {

    constructor() {
        this._episodeService = new EpisodeService();
    }

    getViewedByMonthAgo = async (req, res, next) => {
        try {
            const {month} = req.query;
            const timeline = await this._episodeService.getViewedByMonthAgo(req.userId, month);
            res.status(200).json(timeline);
        } catch (e) {
            next(e);
        }
    }

    updateViewing = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {watchedAt, platformId} = req.body;
            await this._episodeService.updateViewing(req.userId, id, watchedAt, platformId);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    deleteViewing = async (req, res, next) => {
        try {
            const {id} = req.params;
            await this._episodeService.deleteViewing(req.userId, id);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }
}
