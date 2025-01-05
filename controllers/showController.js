import ShowService from "../services/showService.js";

export default class ShowController {
    constructor() {
        this.showService = new ShowService();
    }

    addShow = async (req, res, next) => {
        try {
            const { id, list } = req.body;
            await this.showService.addShow(req.userId, id, list);
            res.sendStatus(201);
        } catch (e) {
            next(e);
        }
    }

    deleteByShowId = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { list } = req.query;
            await this.showService.deleteByShowId(req.userId, id, list);
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    getShow = async (req, res, next) => {
        try {
            const { id } = req.params;
            const response = await this.showService.getShowById(req.userId, id);
            res.status(200).send(response);
        } catch (e) {
            next(e);
        }
    }

    getShows = async (req, res, next) => {
        try {
            const { title, limit, status, friendId, platforms } = req.query;
            const shows = await this.showService.getShows(req.userId, title, limit, status, friendId, platforms);
            res.status(200).json(shows);
        } catch (e) {
            next(e);
        }
    }

    addSeasonByShowId = async (req, res, next) => {
        try {
            const { season, serie } = req.body;
            await this.showService.addSeasonByShowId(req.userId, serie, season);
            res.sendStatus(201);
        } catch (e) {
            next(e);
        }
    }

    getSeasonInfosByShowIdBySeason = async (req, res, next) => {
        try {
            const { id, num } = req.params;
            const infos = await this.showService.getSeasonInfosByShowIdBySeason(req.userId, id, num);
            res.status(200).json(infos);
        } catch (e) {
            next(e);
        }
    }

    updateByShowId = async (req, res, next) => {
        try {
            const { id } = req.params;
            const { favorite, watch } = req.body;
            const result = await this.showService.updateByShowId(req.userId, id, favorite, watch);
            res.status(200).json({ "value": result });
        } catch (e) {
            next(e);
        }
    }
}