import EpisodeService from "../services/episodeService.js";

export default class EpisodeController {
    constructor() {
        this._episodeService = new EpisodeService();
    }

    deleteByEpisodeId = async (req, res, next) => {
        try {
            const {id} = req.params;
            await this._episodeService.deleteByEpisodeId(req.userId, id);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    updateByEpisodeId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {platform, viewedAt} = req.body;
            await this._episodeService.updateByEpisodeId(req.userId, id, platform, viewedAt);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }
}
