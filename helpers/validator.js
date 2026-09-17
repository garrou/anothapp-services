import { ERROR_BAD_PASSWORD } from "../constants/errors.js";
import {
    EMAIL_PATTERN,
    IMAGE_PATTERN,
    MAX_PASSWORD,
    MAX_USERNAME,
    MIN_PASSWORD,
    MIN_USERNAME
} from "../constants/validation.js";

class ValidatorStatus {
    constructor(valid, message = "") {
        this.status = valid;
        this.message = message;
    }
}

export default class Validator {

    /**
     * @param {*} value
     * @returns {boolean}
     */
    static isString = (value) => typeof value === "string";

    /**
     * @param {*} value
     * @returns {boolean}
     */
    static isBoolean = (value) => typeof value === "boolean";

    /**
     * True for a non-null object that isn't an array - the shape `typeof x === "object"` alone
     * also accepts, since arrays and null are "object" too.
     * @param {*} value
     * @returns {boolean}
     */
    static isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

    /**
     * @param {string?} username
     * @returns {ValidatorStatus}
     */
    static isValidUsername = (username) => {
        if (!Validator.isString(username) || username.length < MIN_USERNAME || username.length > MAX_USERNAME) {
            return new ValidatorStatus(false, `Username incorrect (${MIN_USERNAME} - ${MAX_USERNAME})`);
        }
        return new ValidatorStatus(true);
    }

    /**
     * @param {string?} email
     * @returns {ValidatorStatus}
     */
    static isValidEmail = (email) => {
        if (!Validator.isString(email) || !EMAIL_PATTERN.test(email)) {
            return new ValidatorStatus(false, "Email incorrect");
        }
        return new ValidatorStatus(true);
    }

    /**
     * @param {string?} password
     * @param {string?} confirm
     * @returns {ValidatorStatus}
     */
    static isValidPassword = (password, confirm) => {
        if (!Validator.isString(password)) {
            return new ValidatorStatus(false, ERROR_BAD_PASSWORD);
        }
        if (password !== confirm) {
            return new ValidatorStatus(false, "Mots de passe différents");
        }
        if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
            return new ValidatorStatus(false, `Mot de passe incorrect (${MIN_PASSWORD} - ${MAX_PASSWORD})`);
        }
        return new ValidatorStatus(true);
    }

    /**
     * @param {string|undefined} oldPass
     * @param {string|undefined} newPass
     * @param {string|undefined} confPass
     * @returns {ValidatorStatus}
     */
    static isValidChangePassword = (oldPass, newPass, confPass) => {
        if (!Validator.isString(oldPass)) {
            return new ValidatorStatus(false, ERROR_BAD_PASSWORD);
        }
        if (oldPass === newPass) {
            return new ValidatorStatus(false, "Le nouveau mot de passe doit être différent de l'ancien ");
        }
        return this.isValidPassword(newPass, confPass);
    }

    /**
     * @param {string|undefined} oldEmail
     * @param {string|undefined} newEmail
     * @returns {ValidatorStatus}
     */
    static isValidChangeEmail = (oldEmail, newEmail) => {
        if (oldEmail === newEmail) {
            return new ValidatorStatus(false, "Le nouvel email doit être différent");
        }
        return this.isValidEmail(newEmail);
    }

    /**
     * @param {string?} image
     * @returns {boolean}
     */
    static isValidImage = (image) => {
        return Validator.isString(image)
            && image.length > 0
            && IMAGE_PATTERN.test(image);
    }

    /**
     * @param {string} date
     * @returns {boolean}
     */
    static isInFuture = (date) => new Date(date) > new Date();

    /**
     * @param {ApiShow} show
     * @returns {boolean}
     */
    static isValidShow = (show) => {
        const {id, title, kinds, seasons} = show;
        return !!id && !!title && Array.isArray(kinds) && !!kinds.length && !!seasons;
    }

    /**
     * Only `shows` is mandatory - the rest of the export (`user`, `playlists`, `favoriteActors`,
     * `platforms`) is optional so a hand-built or partial payload (as used throughout the test
     * suite) stays importable; when present, each is still checked for the right shape.
     * @param {Object} payload
     * @returns {boolean}
     */
    static isValidImportFile = (payload) => {
        return Validator.isPlainObject(payload)
            && Array.isArray(payload.shows)
            && (payload.user === undefined || Validator.isPlainObject(payload.user))
            && (payload.user?.episodeTrackingEnabled === undefined || Validator.isBoolean(payload.user.episodeTrackingEnabled))
            && (payload.playlists === undefined || Array.isArray(payload.playlists))
            && (payload.favoriteActors === undefined || Array.isArray(payload.favoriteActors))
            && (payload.platforms === undefined || Array.isArray(payload.platforms));
    }

    /**
     * @param {ExportShow} show
     * @returns {boolean}
     */
    static isValidImportedShow = (show) => {
        return Validator.isPlainObject(show) && Number.isInteger(show.id);
    }

    /**
     * @param {UserSeason} season
     * @returns {boolean}
     */
    static isValidImportedSeason = (season) => {
        return Validator.isPlainObject(season) && Number.isInteger(season.number);
    }

    /**
     * @param {UserEpisode} episode
     * @returns {boolean}
     */
    static isValidImportedEpisode = (episode) => {
        return Validator.isPlainObject(episode) && Number.isInteger(episode.episodeId);
    }

    /**
     * @param {ExportPlaylist} playlist
     * @returns {boolean}
     */
    static isValidImportedPlaylist = (playlist) => {
        return Validator.isPlainObject(playlist) && Validator.isString(playlist.name) && !!playlist.name;
    }

    /**
     * @param {Actor} actor
     * @returns {boolean}
     */
    static isValidImportedActor = (actor) => {
        return Validator.isPlainObject(actor) && Number.isInteger(actor.id);
    }

    /**
     * @param {number} platformId
     * @returns {boolean}
     */
    static isValidImportedPlatformId = (platformId) => Number.isInteger(platformId);
}