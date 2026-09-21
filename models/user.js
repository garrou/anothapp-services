export default class User {
    /**
     * @param {Object} user
     */
    constructor(user) {
        this.id = user.id;
        this.picture = user.picture;
        this.username = user.username;
        this.lastExport = user["last_export"];
        this.episodeTrackingEnabled = user["episode_tracking_enabled"];
        this.createdAt = user["created_at"];
        this.deletedAt = user["deleted_at"];
    }

    /**
     * @param {string} field
     * @return boolean
     */
    static isValidField = (field) => {
        return ["picture", "last_export", "episode_tracking_enabled"].includes(field);
    }
}