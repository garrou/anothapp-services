import ActorService from "../services/actorService.js";

export default class ActorController {

    constructor() {
        this._actorService = new ActorService();
    }

    addFavorite = async (req, res, next) => {
        try {
            const actor = await this._actorService.addFavorite(req.userId, parseInt(req.params.id));
            res.status(200).json(actor);
        } catch (e) {
            next(e);
        }
    }

    removeFavorite = async (req, res, next) => {
        try {
            await this._actorService.removeFavorite(req.userId, parseInt(req.params.id));
            res.sendStatus(204);
        } catch (e) {
            next(e);
        }
    }

    getFavorites = async (req, res, next) => {
        try {
            const {friendId} = req.query;
            const actors = await this._actorService.getFavorites(req.userId, friendId);
            res.status(200).json(actors);
        } catch (e) {
            next(e);
        }
    }
}
