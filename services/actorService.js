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
            // Only when we already fetched the full profile above (new or stub actor) - the
            // filmography comes for free in that response. When the actor was already fully
            // known, skip it rather than spend an extra API call just for this: the weekly
            // updateActors job re-links every favorited actor's shows anyway.
            try {
                await this._actorRepository.linkShows(actorId, person.series.map(({id}) => id));
            } catch {
                // Best-effort - must never block favoriting, the weekly job will catch up.
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
     * A row with only id/name/picture and nothing else - a leftover from before actors were
     * only ever created with a full profile fetched up front. Kept so any such row still around
     * gets enriched the next time someone favorites it, instead of staying incomplete forever.
     * @param {Actor} actor
     * @returns {boolean}
     */
    #isStubActor = (actor) => !actor.birthday && !actor.deathday && !actor.nationality && !actor.description;

    /**
     * Creates or enriches an actor row from a full profile fetched from the search API, falling
     * back to `existing`'s fields for anything the API doesn't return - same pattern as
     * schedule/tasks/updateActors.js's fetchActorUpdate, so a sparse response never wipes out a
     * value a prior profile already had.
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
            // Another concurrent favorite of the same new actor created it between our lookup
            // and this insert - enrich whatever it left behind instead of discarding the
            // profile we already fetched.
            const race = await this._actorRepository.getActorById(actorId);
            return this.#isStubActor(race) ? this.#saveFullProfile(actorId, person, race) : race;
        }
    }
}
