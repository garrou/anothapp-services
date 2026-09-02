import ActorRepository from "../repositories/actorRepository.js";
import UserFavoriteActorRepository from "../repositories/userFavoriteActorRepository.js";
import SearchService from "./searchService.js";
import ServiceError from "../helpers/serviceError.js";
import {ERROR_INVALID_REQUEST} from "../constants/errors.js";
import eventBus from "../helpers/eventBus.js";

export default class ActorService {

    constructor() {
        this._actorRepository = new ActorRepository();
        this._userFavoriteActorRepository = new UserFavoriteActorRepository();
        this._searchService = new SearchService();
    }

    /**
     * @param {string} currentUserId
     * @param {number?} actorId
     * @returns {Promise<Actor>}
     */
    addFavorite = async (currentUserId, actorId) => {
        if (!actorId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const exists = await this._userFavoriteActorRepository.checkFavoriteExists(currentUserId, actorId);

        if (exists) {
            throw new ServiceError(409, "Cet acteur est déjà dans vos favoris");
        }
        let actor = await this._actorRepository.getActorById(actorId);

        if (!actor) {
            const person = await this._searchService.getPersonById(actorId);

            if (!person.id || !person.name) {
                throw new ServiceError(400, "Acteur invalide");
            }
            const created = await this._actorRepository.createActor(
                person.id, person.name, person.poster, person.birthday, person.deathday,
                person.nationality, person.description
            );

            if (!created) {
                throw new ServiceError(500, "Impossible de créer l'acteur");
            }
            actor = await this._actorRepository.getActorById(actorId);
        }
        const added = await this._userFavoriteActorRepository.create(currentUserId, actorId);

        if (!added) {
            throw new ServiceError(500, "Impossible d'ajouter l'acteur aux favoris");
        }
        eventBus.emit("actor.favorited", {
            actorUserId: currentUserId,
            metadata: {actorId: actor.id, actorName: actor.name, actorPicture: actor.picture}
        });
        return actor;
    }

    /**
     * @param {string} currentUserId
     * @param {number?} actorId
     * @returns {Promise<void>}
     */
    removeFavorite = async (currentUserId, actorId) => {
        if (!actorId) {
            throw new ServiceError(400, ERROR_INVALID_REQUEST);
        }
        const deleted = await this._userFavoriteActorRepository.deleteByUserIdActorId(currentUserId, actorId);

        if (!deleted) {
            throw new ServiceError(500, "Impossible de supprimer l'acteur des favoris");
        }
    }

    /**
     * @param {string} currentUserId
     * @returns {Promise<Actor[]>}
     */
    getFavorites = async (currentUserId) => {
        return this._userFavoriteActorRepository.getFavoritesByUserId(currentUserId);
    }
}
