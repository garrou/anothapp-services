export default class UserUpdate {

    /**
     * @param {Object} obj
     */
    constructor(obj) {
        this.currentPassword = obj.currentPassword;
        this.newPassword = obj.newPassword;
        this.confirmPassword = obj.confirmPassword;
        this.email = obj.email;
        this.newEmail = obj.newEmail;
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
        return !!this.email && !!this.newEmail;
    }
}