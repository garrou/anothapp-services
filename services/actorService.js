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
        let person = null;

        if (!actor || this.#isStubActor(actor)) {
            person = await this._searchService.getPersonById(actorId);

            if (!person.id || !person.name) {
                throw new ServiceError(400, "Acteur invalide");
            }
            actor = await this.#saveFullProfile(actorId, person, actor);
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
        if (person) {
            try {
                await this._actorRepository.linkShows(actorId, person.series.map(({id}) => id));
            } catch {
            }
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
     * @param {Actor} actor
     * @returns {boolean}
     */
    #isStubActor = (actor) => !actor.birthday && !actor.deathday && !actor.nationality && !actor.description;

    /**
     * @param {number} actorId
     * @param {{name: string, poster: string?, birthday: string?, deathday: string?, nationality: string?, description: string?}} person
     * @param {Actor|null} existing
     * @returns {Promise<Actor>}
     */
    #saveFullProfile = async (actorId, person, existing) => {
        const fields = {
            name: person.name || existing?.name,
            picture: person.poster ?? existing?.picture ?? null,
            birthday: person.birthday ?? existing?.birthday ?? null,
            deathday: person.deathday ?? existing?.deathday ?? null,
            nationality: person.nationality ?? existing?.nationality ?? null,
            description: person.description ?? existing?.description ?? null,
        };

        if (existing) {
            await this._actorRepository.updateActor(actorId, fields);
            return new Actor({id: actorId, ...fields});
        }
        try {
            const created = await this._actorRepository.createActor(
                actorId, fields.name, fields.picture, fields.birthday, fields.deathday,
                fields.nationality, fields.description
            );

            if (!created) {
                throw new ServiceError(500, "Impossible de créer l'acteur");
            }
            return new Actor({id: actorId, ...fields});
        } catch (err) {
            if (err.code !== DUPLICATE_ERROR_CODE) {
                throw err;
            }
            return await this._actorRepository.getActorById(actorId);
        }
    }
}
