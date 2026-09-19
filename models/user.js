export default class User {
    /**
     * @param {Object} user
     */
    constructor(user) {
        this.id = user.id;
        this.email = user.email;
        this.picture = user.picture;
        this.username = user.username;
        this.password = user.password;
        this.lastExport = user["last_export"];
        this.episodeTrackingEnabled = user["episode_tracking_enabled"];
        this.emailVerified = user["email_verified"];
        this.pendingEmail = user["pending_email"];
        this.loginCodeHash = user["login_code_hash"];
        this.loginCodeExpiresAt = user["login_code_expires_at"];
        this.loginCodeAttempts = user["login_code_attempts"];
        this.createdAt = user["created_at"];
        this.deletedAt = user["deleted_at"];
    }

    /**
     * @param {string} field
     * @return boolean
     */
    static isValidField = (field) => {
        return [
            "email", "password", "picture", "last_export", "episode_tracking_enabled", "email_verified",
            "pending_email"
        ].includes(field);
    }
}