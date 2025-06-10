import ShowService from "../services/showService.js";

export default class ShowController {
    constructor() {
        this._showService = new ShowService();
    }

    addShow = async (req, res, next) => {
        try {
            const {id, list} = req.body;
            const show = await this._showService.addShow(req.userId, id, list);
            res.status(201).json(show);
        } catch (e) {
            next(e);
        }
    }

    deleteByShowId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {list} = req.query;
            await this._showService.deleteByShowId(req.userId, id, list);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    getShow = async (req, res, next) => {
        try {
            const {id} = req.params;
            const response = await this._showService.getShowById(req.userId, id);
            res.status(200).send(response);
        } catch (e) {
            next(e);
        }
    }

    getShows = async (req, res, next) => {
        try {
            const {title, status, friendId, platforms, countries, kinds} = req.query;
            const shows = await this._showService.getShows(req.userId, title, status, friendId, platforms, countries, kinds);
            res.status(200).json(shows);
        } catch (e) {
            next(e);
        }
    }

    addSeasonByShowId = async (req, res, next) => {
        try {
            const {id, num} = req.body;
            await this._showService.addSeason(req.userId, id, num);
            res.sendStatus(201);
        } catch (e) {
            next(e);
        }
    }

    getSeasonInfosByShowIdBySeason = async (req, res, next) => {
        try {
            const {id, num} = req.params;
            const infos = await this._showService.getSeasonInfosByShowIdBySeason(req.userId, id, num);
            res.status(200).json(infos);
        } catch (e) {
            next(e);
        }
    }

    updateByShowId = async (req, res, next) => {
        try {
            const {id} = req.params;
            const {favorite, watch, addedAt} = req.body;
            const result = await this._showService.updateByShowId(req.userId, id, favorite, watch, addedAt);
            res.status(200).json({"value": result});
        } catch (e) {
            next(e);
        }
    }
}