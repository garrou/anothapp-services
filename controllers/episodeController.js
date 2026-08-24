import EpisodeService from "../services/episodeService.js";

export default class EpisodeController {

    constructor() {
        this._episodeService = new EpisodeService();
    }

    updateViewing = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {watchedAt} = req.body;
            await this._episodeService.updateViewing(req.userId, id, watchedAt);
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
