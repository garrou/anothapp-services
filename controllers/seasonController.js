import SeasonService from "../services/seasonService.js";

export default class SeasonController {

    constructor() {
        this._seasonService = new SeasonService();
    }

    /**
     * @returns {Promise<void>}
     */
    deleteBySeasonId = async (req, res, next) => {
        try {
            const {id} = req.params;
            await this._seasonService.deleteBySeasonId(req.userId, id);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    getEpisodesBySeasonId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const episodes = await this._seasonService.getEpisodesBySeasonId(req.userId, id);
            res.status(200).json(episodes);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    addEpisodeViewing = async (req, res, next) => {
        try {
            const {id, episodeId} = req.params;
            await this._seasonService.addEpisodeViewing(req.userId, id, episodeId);
            res.sendStatus(201);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    addAllEpisodesViewing = async (req, res, next) => {
        try {
            const {id} = req.params;
            await this._seasonService.addAllEpisodesViewing(req.userId, id);
            res.sendStatus(201);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    updateBySeasonId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {platform, viewedAt} = req.body;
            await this._seasonService.updateBySeasonId(req.userId, id, platform, viewedAt);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }

    /**
     * @returns {Promise<void>}
     */
    updateWatchedWith = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {friendIds} = req.body;
            await this._seasonService.updateWatchedWith(req.userId, id, friendIds);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }
}