export default class UserUpdate {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.currentPassword = obj.currentPassword;
        this.newPassword = obj.newPassword;
        this.confirmPassword = obj.confirmPassword;
        this.newEmail = obj.newEmail;
        this.confirmEmail = obj.confirmEmail;
        this.newUsername = obj.newUsername;
        this.confirmUsername = obj.confirmUsername;
        this.image = obj.image;
        this.lastExport = obj.lastExport;
    }

    /**
     * @returns {boolean}
     */
    isPasswordUpdate() {
        return !!this.currentPassword && !!this.newPassword && !!this.confirmPassword;
    }

    /**
     * @returns {boolean}
     */
    isEmailUpdate() {
        return !!this.newEmail && !!this.confirmEmail;
    }

    /**
     * @returns {boolean}
     */
    isUsernameUpdate() {
        return !!this.newUsername && !!this.confirmUsername;
    }
}