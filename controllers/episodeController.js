import EpisodeService from "../services/episodeService.js";

export default class EpisodeController {

    constructor() {
        this._episodeService = new EpisodeService();
    }

    watchByEpisodeId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const views = await this._episodeService.watch(req.userId, id);
            res.status(200).json({views});
        } catch (e) {
            next(e);
        }
    }

    unwatchByEpisodeId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const views = await this._episodeService.unwatch(req.userId, id);
            res.status(200).json({views});
        } catch (e) {
            next(e);
        }
    }
}
