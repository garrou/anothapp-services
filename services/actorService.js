import ActorRepository from "../repositories/actorRepository.js";
import UserFavoriteActorRepository from "../repositories/userFavoriteActorRepository.js";
import FriendRepository from "../repositories/friendRepository.js";
import SearchService from "./searchService.js";
import ServiceError from "../helpers/serviceError.js";
import Actor from "../models/actor.js";
import {DUPLICATE_ERROR_CODE, ERROR_ACTOR_ALREADY_FAVORITE, ERROR_INVALID_REQUEST, ERROR_NOT_FRIEND} from "../constants/errors.js";
import eventBus from "../helpers/eventBus.js";

export default class ActorService {

    constructor() {
        this._actorRepository = new ActorRepository();
        this._userFavoriteActorRepository = new UserFavoriteActorRepository();
        this._friendRepository = new FriendRepository();
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
            throw new ServiceError(409, ERROR_ACTOR_ALREADY_FAVORITE);
        }
        let actor = await this._actorRepository.getActorById(actorId);
        const existed = !!actor;

        if (!actor || this.#isStubActor(actor)) {
            const person = await this._searchService.getPersonById(actorId);

            if (!person.id || !person.name) {
                throw new ServiceError(400, "Acteur invalide");
            }
            const enriched = new Actor({
                id: person.id, name: person.name, picture: person.poster, birthday: person.birthday,
                deathday: person.deathday, nationality: person.nationality, description: person.description
            });

            if (existed) {
                // A stub row created by the shows_actors cast import only carries id/name/
                // picture - fill in the rest now that a user actually cares about this profile.
                await this._actorRepository.updateActor(actorId, enriched);
                actor = enriched;
            } else {
                try {
                    const created = await this._actorRepository.createActor(
                        person.id, person.name, person.poster, person.birthday, person.deathday,
                        person.nationality, person.description
                    );

                    if (!created) {
                        throw new ServiceError(500, "Impossible de créer l'acteur");
                    }
                    actor = enriched;
                } catch (err) {
                    if (err.code !== DUPLICATE_ERROR_CODE) {
                        throw err;
                    }
                    actor = await this._actorRepository.getActorById(actorId);
                }
            }
        }
        let added;
        try {
            added = await this._userFavoriteActorRepository.create(currentUserId, actorId);
        } catch (err) {
            if (err.code === DUPLICATE_ERROR_CODE) {
                throw new ServiceError(409, ERROR_ACTOR_ALREADY_FAVORITE);
            }
            throw err;
        }
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
     * @param {string?} friendId
     * @returns {Promise<Actor[]>}
     */
    getFavorites = async (currentUserId, friendId) => {
        if (friendId && !await this._friendRepository.checkIfAlreadyFriend(currentUserId, friendId)) {
            throw new ServiceError(400, ERROR_NOT_FRIEND);
        }
        return this._userFavoriteActorRepository.getFavoritesByUserId(friendId ?? currentUserId);
    }

    /**
     * A row created by the shows_actors cast import only has id/name/picture - no birthday,
     * nationality or bio, since fetching a full profile for every cast member would cost far
     * more BetaSeries calls than the cast import is meant to spend.
     * @param {Actor} actor
     * @returns {boolean}
     */
    #isStubActor = (actor) => !actor.birthday && !actor.deathday && !actor.nationality && !actor.description;
}
