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
        this.episodeTrackingEnabled = obj.episodeTrackingEnabled;
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

    /**
     * @returns {boolean}
     */
    isEpisodeTrackingUpdate() {
        return typeof this.episodeTrackingEnabled === "boolean";
    }
}