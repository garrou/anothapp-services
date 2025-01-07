class ValidatorStatus {
    constructor(valid, message = "") {
        this.status = valid;
        this.message = message;
    }
}

export default class Validator {

    static get emailPattern() {
        return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$/
    }

    static get imagePattern() {
        return /^https:\/\/pictures\.betaseries\.com\/.*$/
    }

    static get maxPassword() {
        return 50;
    }

    static get minPassword() {
        return 8;
    }

    static get maxUsername() {
        return 25;
    }

    static get minUsername() {
        return 3;
    }

    static get passwordPattern() {
        return /^.{8,50}$/;
    }

    static get usernamePattern() {
        return /^[^@]{3,25}$/;
    }

    /**
     * @param {string?} username
     * @returns {ValidatorStatus}
     */
    static isValidUsername = (username) => {
        if (typeof username !== "string" || !this.usernamePattern.test(username)) {
            return new ValidatorStatus(false, `Username incorrect (${this.minUsername} - ${this.maxUsername})`);
        }
        return new ValidatorStatus(true);
    }

    /**
     * @param {string?} email
     * @returns {ValidatorStatus}
     */
    static isValidEmail = (email) => {
        if (typeof email !== "string" || !this.emailPattern.test(email)) {
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
        if (!this.passwordPattern.test(password)) {
            return new ValidatorStatus(false, `Mot de passe incorrect (${this.minPassword} - ${this.maxPassword})`);
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
            && this.imagePattern.test(image);
    }

    /**
     * @param {string?} name
     * @returns {boolean}
     */
    static isValidId = (name) => {
        return typeof name === "string";
    }

    /**
     * @param {ApiShow} show
     * @returns {boolean}
     */
    static idValidShow = (show) => {
        const {id, title, kinds, duration, seasons, country} = show;
        return id && title && Array.isArray(kinds) && kinds.length && duration && seasons && country;
    }
}