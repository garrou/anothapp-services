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
     * @param {string?} username
     * @returns {ValidatorStatus}
     */
    static isValidUsername = (username) => {
        if (typeof username !== "string" || username.length < MIN_USERNAME || username.length > MAX_USERNAME) {
            return new ValidatorStatus(false, `Username incorrect (${MIN_USERNAME} - ${MAX_USERNAME})`);
        }
        return new ValidatorStatus(true);
    }

    /**
     * @param {string?} email
     * @returns {ValidatorStatus}
     */
    static isValidEmail = (email) => {
        if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
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
        if (typeof password !== "string") {
            return new ValidatorStatus(false, "Mot de passe incorrect");
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
        if (typeof oldPass !== "string") {
            return new ValidatorStatus(false, "Mot de passe incorrect");
        }
        if (oldPass === newPass) {
            return new ValidatorStatus(false, "Le nouvel mot de passe doit être différent de l'ancien ");
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
            return new ValidatorStatus(false, "Le nouvel mail doit être différent");
        }
        return this.isValidEmail(newEmail);
    }

    /**
     * @param {string?} image
     * @returns {boolean}
     */
    static isValidImage = (image) => {
        return typeof image === "string"
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
}