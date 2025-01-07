import SeasonService from "../services/seasonService.js";

export default class SeasonController {

    constructor() {
        this._seasonService = new SeasonService();
    }

    deleteBySeasonId = async (req, res, next) => {
        try {
            const {id} = req.params;
            await this._seasonService.deleteBySeasonId(req.userId, id);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    getSeasons = async (req, res, next) => {
        try {
            const {year, month} = req.query;
            const response = await this._seasonService.getSeasons(req.userId, year, month);
            res.status(200).json(response);
        } catch (e) {
            next(e);
        }
    }

    updateBySeasonId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {platform} = req.body;
            await this._seasonService.updateBySeasonId(req.userId, id, platform);
            res.sendStatus(200);
        } catch (e) {
            next(e);
        }
    }
}